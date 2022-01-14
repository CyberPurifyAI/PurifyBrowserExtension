/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */

import 'babel-polyfill';
import * as tf from '@tensorflow/tfjs';
import { IMAGENET_CLASSES } from './imagenet_classes';
import { toxicClassifier } from './toxicity';
import md5 from 'md5';

// Where to load the model from.
const MOBILENET_MODEL_TFHUB_URL = chrome.extension.getURL("models/purify_mobilenet_tfjs/model.json");

// Size of the image expected by mobilenet.
const IMAGE_SIZE = 224;
// The minimum image size to consider classifying.  Below this limit the
// extension will refuse to classify the image.
const MIN_IMG_SIZE = 128;

// How many predictions to take.
const TOPK_PREDICTIONS = 7;
const FIVE_SECONDS_IN_MS = 5000;
var BLACKLIST = [];
var CP_BLACKLIST = [];
var CP_TOPLIST = [];

/**
 * Async loads a mobilenet on construction.  Subsequently handles
 * requests to classify images through the .analyzeImage API.
 * Successful requests will post a chrome message with
 * 'IMAGE_CLICK_PROCESSED' action, which the content.js can
 * hear and use to manipulate the DOM.
 */
class ImageClassifier {
    constructor() {
        this.loadModel();
    }

    /**
     * Loads mobilenet from URL and keeps a reference to it in the object.
     */
    async loadModel() {
        console.log('Loading model...');
        const startTime = performance.now();
        try {
            this.model =
                await tf.loadGraphModel(MOBILENET_MODEL_TFHUB_URL, { fromTFHub: false });
            // Warms up the model by causing intermediate tensor values
            // to be built and pushed to GPU.
            tf.tidy(() => {
                this.model.predict(tf.zeros([1, IMAGE_SIZE, IMAGE_SIZE, 3]));
            });
            const totalTime = Math.floor(performance.now() - startTime);
            console.log(`Model loaded and initialized in ${ totalTime } ms...`);
        } catch (error) {
            console.error(`Unable to load model from URL: ${ MOBILENET_MODEL_TFHUB_URL }`);
        }
    }

    /**
     * Triggers the model to make a prediction on the image referenced by url.
     * After a successful prediction a IMAGE_CLICK_PROCESSED message when
     * complete, for the content.js script to hear and update the DOM with the
     * results of the prediction.
     *
     * @param {string} url url of image to analyze.
     * @param {number} tabId which tab the request comes from.
     */
    async analyzeImage(srcUrl, srcType, tabId, repeat) {
        if (!tabId) {
            console.error('No tab.  No prediction.');
            return;
        }
        if (!this.model) {
            console.log('Waiting for model to load...');
            setTimeout(() => { this.analyzeImage(srcUrl, srcType, tabId, repeat) }, FIVE_SECONDS_IN_MS);
            return;
        }

        let message;
        this.loadImage(srcUrl, srcType, tabId, repeat).then(
            async(img) => {
                if (!img) {
                    console.error('Could not load image.  Either too small or unavailable.');
                    return;
                }
                const predictions = await this.predict(img);
                message = { action: 'predict', srcUrl, srcType, predictions };
                chrome.tabs.sendMessage(tabId, message);
            },
            (reason) => {
                console.error(`Failed to analyze: ${reason}`);
            });
    }

    /**
     * Creates a dom element and loads the image pointed to by the provided src.
     * @param {string} src URL of the image to load.
     */
    async loadImage(srcUrl, srcType, tabId, repeat) {
        return new Promise((resolve, reject) => {
            const img = document.createElement('img');
            img.crossOrigin = 'anonymous';
            img.onerror = function(e) {
                reject(`Could not load image from external source ${ srcUrl }.`);
                // return org status

                if (repeat < 5) {
                    repeat += 1;
                    // console.log("Try again " + repeat);
                    // var autoreload
                    setTimeout(() => {
                        imageClassifier.analyzeImage(srcUrl, srcType, tabId, repeat);
                    }, repeat * 750);
                } else {
                    chrome.tabs.sendMessage(tabId, { action: 'imgfail' });
                }
            };
            img.onload = function(e) {
                if ((img.height && img.height > MIN_IMG_SIZE) || (img.width && img.width > MIN_IMG_SIZE)) {
                    img.width = IMAGE_SIZE;
                    img.height = IMAGE_SIZE;
                    resolve(img);
                }
                /*
                 * Fail out if either dimension is less than MIN_IMG_SIZE.
                 */
                if (img.height && img.height <= MIN_IMG_SIZE || img.width && img.width <= MIN_IMG_SIZE) {
                    const predictions = [{ className: "Neutral", probability: 1 }];
                    chrome.tabs.sendMessage(tabId, { action: 'predict', srcUrl, srcType, predictions });
                }
                reject(`Image size too small. [${ img.height } x ${ img.width }] vs. minimum [${ MIN_IMG_SIZE } x ${ MIN_IMG_SIZE }]`);
            };
            img.src = srcUrl;
        });
    }

    /**
     * Sorts predictions by score and keeps only topK
     * @param {Tensor} logits A tensor with one element per predicatable class
     * type of mobilenet.  Return of executing model.predict on an Image.
     * @param {number} topK how many to keep.
     */
    async getTopKClasses(logits, topK) {
        const { values, indices } = tf.topk(logits, topK, true);
        const valuesArr = await values.data();
        const indicesArr = await indices.data();
        console.log(`indicesArr ${indicesArr}`);
        const topClassesAndProbs = [];
        for (let i = 0; i < topK; i++) {
            topClassesAndProbs.push({
                className: IMAGENET_CLASSES[indicesArr[i]],
                probability: valuesArr[i]
            })
        }
        return topClassesAndProbs;
    }

    /**
     * Executes the model on the input image, and returns the top predicted classes.
     * @param {HTMLElement} imgElement HTML element holding the image to predict from.
     * Should have the correct size ofr mobilenet.
     */
    async predict(imgElement) {
        console.log('Predicting...');
        // The first start time includes the time it takes to extract the image
        // from the HTML and preprocess it, in additon to the predict() call.
        const startTime1 = performance.now();
        // The second start time excludes the extraction and preprocessing and
        // includes only the predict() call.
        let startTime2;
        const logits = tf.tidy(() => {
            // Mobilenet expects images to be normalized between -1 and 1.
            const img = tf.browser.fromPixels(imgElement).toFloat();
            // const offset = tf.scalar(127.5);
            // const normalized = img.sub(offset).div(offset);
            // const normalized = img.div(tf.scalar(256.0));
            const normalized = tf.image.resizeBilinear(img.div(tf.scalar(256.0)), [224, 224], false);
            const batched = normalized.reshape([1, IMAGE_SIZE, IMAGE_SIZE, 3]);
            startTime2 = performance.now();
            const output = this.model.predict(batched);
            batched.dispose();
            normalized.dispose();
            img.dispose();
            imgElement = null;
            // console.log("Result "+JSON.stringify(output));
            return output;
            if (output.shape[output.shape.length - 1] === 1001) {
                // Remove the very first logit (background noise).
                return output.slice([0, 1], [-1, 1000]);
            } else if (output.shape[output.shape.length - 1] === 1000) {
                return output;
            } else {
                throw new Error('Unexpected shape...');
            }
        });

        // Convert logits to probabilities and class names.
        const classes = await this.getTopKClasses(logits, TOPK_PREDICTIONS);
        const totalTime1 = performance.now() - startTime1;
        const totalTime2 = performance.now() - startTime2;
        console.log(
            `Done in ${totalTime1.toFixed(1)} ms ` +
            `(not including preprocessing: ${Math.floor(totalTime2)} ms)`);
        // console.log(classes);
        return classes;
    }
}

const imageClassifier = new ImageClassifier();

/**
 *
 * @param {string} url
 * @returns string
 */
function extractHostname(url) {
    var hostname;
    // find & remove protocol (http, ftp, etc.) and get hostname

    if (url.indexOf("//") > -1)
        hostname = url.split('/')[2];
    else
        hostname = url.split('/')[0];

    //find & remove port number
    hostname = hostname.split(':')[0];
    //find & remove "?"
    hostname = hostname.split('?')[0];

    return hostname.replace("www.", "");
}

/**
 *
 * @param {string} url
 * @returns
 */
function extractRootDomain(url) {
    var domain = extractHostname(url),
        splitArr = domain.split('.'),
        arrLen = splitArr.length;

    // extracting the root domain here
    // if there is a subdomain
    if (arrLen > 2) {
        domain = splitArr[arrLen - 2] + '.' + splitArr[arrLen - 1];
        // check to see if it's using a Country Code Top Level Domain (ccTLD) (i.e. ".me.uk")
        if (splitArr[arrLen - 2].length == 2 && splitArr[arrLen - 1].length == 2) {
            // this is using a ccTLD
            domain = splitArr[arrLen - 3] + '.' + domain;
        }
    }
    return domain;
}

/**
 * * Kiểm tra domain có tồn tại BLACKLIST hoặc CP_BLACKLIST trong localStorage
 * @param {string} domain
 * @returns boolean
 */
function is_blacklist(domain) {
    return BLACKLIST.indexOf(domain) === -1 ? (CP_BLACKLIST.indexOf(domain) === -1 ? false : true) : true;
}

/**
 * * Kiểm tra domain có tồn tại trong WHITELIST
 * @param {string} domain
 * @returns true | false
 */
function is_toplist(domain) {
    // widecart thay vì phải declare cụ thể google.com với google.com.vn hay www.google.com thì chỉ cần google.com
    var d = extractHostname(domain);
    return CP_TOPLIST.indexOf(d) === -1 ? false : true;
}

chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
        switch (request.action) {
            case 'analyze':
            case 'predict':
                imageClassifier.analyzeImage(request.srcUrl, request.srcType, sender.tab.id, 0);
                break;

            case 'hidetab':
                let domain = extractHostname(request.url);
                if (CP_BLACKLIST.indexOf(md5(domain)) === -1 && is_toplist(domain) == false) {
                    CP_BLACKLIST.push(md5(domain));
                    localStorage.setItem("cp_blacklist", JSON.stringify(CP_BLACKLIST));
                }
                /*
                 * sync Blocked host to backend
                 */
                let messages = {
                    action: "domain_blacklist",
                    clientId: purify.utils.browser.getClientId(),
                    link: sender.tab.url,
                    POSITIVE_IMAGES: request.POSITIVE_IMAGES,
                    timestamp: performance.now(),
                    user_agent: navigator.userAgent,
                    client_lang: navigator.language,
                };
                purify.parentalControl.syncBlacklist(messages);

                chrome.tabs.update(sender.tab.id, { url: chrome.extension.getURL("pages/blocking-pages/adBlockedPage.html") });
                break;

            case 'checkdomain':
                if (BLACKLIST.length == 0) {
                    if (localStorage.getItem("cp_blacklist") != null) {
                        CP_BLACKLIST = JSON.parse(localStorage.getItem("cp_blacklist"));
                        // console.log("CP_BLACKLIST --> " + localStorage.getItem("cp_blacklist"));
                    }
                    BLACKLIST = purify.whitelist.getBlockListedDomains();
                    CP_TOPLIST = purify.whitelist.getUnBlockListedDomains();
                }

                // purify.console.info(BLACKLIST.length);
                // purify.console.info(CP_TOPLIST.length);

                chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
                    var domain = extractHostname(tabs[0].url);
                    // console.log("domain " + domain + " is_toplist " + is_toplist(domain));
                    // console.log(md5(domain), is_blacklist(md5(domain)), is_toplist(domain));
                    if ((is_blacklist(md5(domain)) == true) && is_toplist(domain) == false) {
                        chrome.tabs.update(sender.tab.id, { url: chrome.extension.getURL("pages/blocking-pages/adBlockedPage.html") });
                    }

                    // console.log(['background', request, sender, `${purify.hateSpeech.regexModelHateSpeech()}`]);
                    // chrome.tabs.sendMessage(sender.tab.id, { action: 'replace_hatespeech', regexModelHateSpeech: purify.hateSpeech.regexModelHateSpeech() });
                    sendResponse({ action: 'replace_hatespeech', regexModelHateSpeech: purify.hateSpeech.regexModelHateSpeech() });
                });
                break;

            case 'toxicity':
                toxicClassifier.classify(sendResponse, request.toxicContentPredict);
                break;
        }
        return true;
    }
);