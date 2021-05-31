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

// Where to load the model from.
const MOBILENET_MODEL_TFHUB_URL = chrome.extension.getURL("models/purify_mobilenet_tfjs/model.json");
const ADGUARD_FILTERLIST_URL = chrome.extension.getURL("filters/filter_21.txt");
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
var TOPLIST = ["youtube.com", "google.com", "apple.com", "microsoft.com", "cloudflare.com", "blogger.com", "support.google.com", "play.google.com", "wordpress.org", "mozilla.org", "maps.google.com", "en.wikipedia.org", "linkedin.com", "youtu.be", "docs.google.com", "plus.google.com", "drive.google.com", "sites.google.com", "europa.eu", "vimeo.com", "accounts.google.com", "adobe.com", "googleusercontent.com", "istockphoto.com", "cnn.com", "bp.blogspot.com", "bbc.co.uk", "amazon.com", "es.wikipedia.org", "facebook.com", "uol.com.br", "vk.com", "line.me", "pt.wikipedia.org", "github.com", "wikimedia.org", "forbes.com", "yahoo.com", "t.me", "creativecommons.org", "fr.wikipedia.org", "google.de", "imdb.com", "dropbox.com", "live.com", "google.co.jp", "hugedomains.com", "myspace.com", "reuters.com", "mail.ru", "whatsapp.com", "jimdofree.com", "brandbucket.com", "medium.com", "google.com.br", "slideshare.net", "news.google.com", "mail.google.com", "msn.com", "w3.org", "nytimes.com", "theguardian.com", "abril.com.br", "gstatic.com", "google.es", "policies.google.com", "dailymotion.com", "developers.google.com", "globo.com", "opera.com", "bbc.com", "nih.gov", "paypal.com", "issuu.com", "weebly.com", "feedburner.com", "get.google.com", "who.int", "gov.uk", "apache.org", "latimes.com", "steampowered.com", "bit.ly", "cdc.gov", "news.yahoo.com", "wikia.com", "nasa.gov", "twitter.com", "aboutads.info", "un.org", "books.google.com", "time.com", "change.org", "draft.blogger.com", "webmd.com", "fandom.com", "rakuten.co.jp", "google.it", "tools.google.com", "buydomains.com", "myaccount.google.com", "translate.google.com", "independent.co.uk", "dailymail.co.uk", "google.co.uk", "networkadvertising.org", "thesun.co.uk", "booking.com", "hatena.ne.jp", "pinterest.com", "cpanel.com", "cpanel.net", "ebay.com", "archive.org", "telegraph.co.uk", "gravatar.com", "de.wikipedia.org", "marketingplatform.google.com", "washingtonpost.com", "wired.com", "plesk.com", "search.google.com", "namecheap.com", "fb.com", "files.wordpress.com", "mediafire.com", "google.pl", "android.com", "aol.com", "telegram.me", "picasaweb.google.com", "dan.com", "abcnews.go.com", "it.wikipedia.org", "wsj.com", "google.fr", "scribd.com", "youronlinechoices.com", "usatoday.com", "samsung.com", "goo.gl", "lefigaro.fr", "terra.com.br", "amazon.co.jp", "cnet.com", "id.wikipedia.org", "huffingtonpost.com", "huffpost.com", "ig.com.br", "office.com", "businessinsider.com", "4shared.com", "wa.me", "amazon.co.uk", "bloomberg.com", "ok.ru", "amazon.de", "harvard.edu", "foxnews.com", "photos.google.com", "aliexpress.com", "elpais.com", "google.ru", "tinyurl.com", "academia.edu", "twitch.tv", "surveymonkey.com", "rambler.ru", "stanford.edu", "wikihow.com", "eventbrite.com", "disney.com", "wiley.com", "welt.de", "indiatimes.com", "pl.wikipedia.org", "nginx.com", "cbc.ca", "spotify.com", "xbox.com", "repubblica.it", "deezer.com", "alibaba.com", "mega.nz", "usnews.com", "enable-javascript.com", "icann.org", "picasa.google.com", "lemonde.fr", "themeforest.net", "imageshack.com", "ziddu.com", "sedo.com", "sciencedaily.com", "netflix.com", "storage.googleapis.com", "sputniknews.com", "imageshack.us", "theatlantic.com", "php.net", "loc.gov", "disqus.com", "news.com.au", "goodreads.com", "photobucket.com", "lycos.com", "forms.gle", "qq.com", "ikea.com", "ea.com", "trustpilot.com", "biglobe.ne.jp", "clickbank.net", "cambridge.org", "mirror.co.uk", "nikkei.com", "abc.net.au", "ign.com", "walmart.com", "metro.co.uk", "bandcamp.com", "m.wikipedia.org", "ipv4.google.com", "depositfiles.com", "wp.com", "stackoverflow.com", "oup.com", "amazon.es", "ietf.org", "hp.com", "bund.de", "secureserver.net", "cornell.edu", "techcrunch.com", "buzzfeed.com", "britannica.com", "yahoo.co.jp", "gofundme.com", "ft.com", "alexa.com", "ytimg.com", "abc.es", "npr.org", "kickstarter.com", "shutterstock.com", "columbia.edu", "google.nl", "instagram.com", "researchgate.net", "my.yahoo.com", "unesco.org", "urbandictionary.com", "bloglovin.com", "google.com.tw", "umich.edu", "chicagotribune.com", "list-manage.com", "ted.com", "playstation.com", "ovh.com", "psychologytoday.com", "privacyshield.gov", "ggpht.com", "groups.google.com", "pixabay.com", "yandex.ru", "dw.com", "addtoany.com", "code.google.com", "instructables.com", "quora.com", "gizmodo.com", "huawei.com", "weibo.com", "nypost.com", "rottentomatoes.com", "discord.com", "netvibes.com", "mozilla.com", "noaa.gov", "economist.com", "google.co.in", "ovh.net", "newsweek.com", "sapo.pt", "nydailynews.com", "ibm.com", "fda.gov", "hm.com", "addthis.com", "nginx.org", "ovh.co.uk", "guardian.co.uk", "ria.ru", "gnu.org", "cbsnews.com", "wix.com", "yelp.com", "asus.com", "amazon.fr", "search.yahoo.com", "20minutos.es", "discord.gg", "ja.wikipedia.org", "express.co.uk", "espn.com", "doubleclick.net", "naver.com", "google.co.id", "shopify.com", "digg.com", "bitly.com", "pbs.org", "mit.edu", "t.co", "sciencemag.org", "sciencedirect.com", "soundcloud.com", "engadget.com", "tripadvisor.com", "blackberry.com", "oracle.com", "nbcnews.com", "gmail.com", "smh.com.au", "mashable.com", "thetimes.co.uk", "bing.com", "wikipedia.org", "sfgate.com", "berkeley.edu", "ca.gov", "adssettings.google.com", "washington.edu", "afternic.com", "nationalgeographic.com", "akamaihd.net", "whitehouse.gov", "spiegel.de", "rapidshare.com", "finance.yahoo.com", "e-monsite.com", "detik.com", "elmundo.es", "box.com", "rt.com", "orange.fr", "nature.com", "cnbc.com", "godaddy.com", "sendspace.com", "theverge.com", "about.com", "mysql.com", "variety.com", "ru.wikipedia.org", "googleblog.com", "over-blog.com", "yadi.sk", "google.ca", "zendesk.com", "livejournal.com", "utexas.edu", "so-net.ne.jp", "thestar.com", "feedburner.google.com", "sina.com.cn", "kotaku.com", "insider.com", "corriere.it", "axs.com", "mystrikingly.com", "airbnb.com", "debian.org", "ed.gov", "venturebeat.com", "teamviewer.com", "thenextweb.com", "mixcloud.com", "archives.gov", "cmu.edu", "thehill.com", "amazon.it", "mail.yahoo.com", "plos.org", "coursera.org", "howstuffworks.com", "fastcompany.com", "pcmag.com", "a8.net", "com.com", "vice.com", "eonline.com", "gooyaabitemplates.com", "slate.com", "weforum.org", "goo.ne.jp", "businessinsider.com.au", "000webhost.com", "dell.com", "cam.ac.uk", "house.gov", "nokia.com", "cbslocal.com", "dot.tk", "dreniq.com", "jstor.org", "freepik.com", "behance.net", "searchenginejournal.com", "intel.com", "yale.edu", "bp3.blogger.com", "thefreedictionary.com", "sports.yahoo.com", "entrepreneur.com", "zeit.de", "ndtv.com", "udemy.com", "about.me", "pastebin.com", "nhk.or.jp", "nifty.com", "e-recht24.de", "greenpeace.org", "arstechnica.com", "zoom.us", "steamcommunity.com", "amzn.to", "stores.jp", "people.com", "example.com", "dictionary.com", "netlify.app", "adweek.com", "megaupload.com", "pinterest.co.uk", "home.pl", "nps.gov", "elsevier.com", "iubenda.com", "sky.com", "photos1.blogger.com", "state.gov", "histats.com", "marketwatch.com", "standard.co.uk", "usgs.gov", "oecd.org", "dribbble.com", "wiktionary.org", "undeveloped.com", "calendar.google.com", "amazon.ca", "etsy.com", "newyorker.com", "symantec.com", "target.com", "thedailybeast.com", "xing.com", "zdnet.com", "tmz.com", "fifa.com", "bp2.blogger.com", "doi.org", "over-blog-kiwi.com", "ucla.edu", "fortune.com", "bp1.blogger.com", "cointernet.com.co", "excite.co.jp", "tabelog.com", "theglobeandmail.com", "home.neustar", "stuff.co.nz", "answers.com", "rollingstone.com", "oreilly.com", "inc.com", "offset.com", "rediff.com", "weather.com", "liveinternet.ru", "sony.com", "channel4.com", "eff.org", "storage.canalblog.com", "uiuc.edu", "lonelyplanet.com", "answers.yahoo.com", "reverbnation.com", "video.google.com", "digitaltrends.com", "scoop.it", "nba.com", "lifehacker.com", "snapchat.com", "boston.com", "cia.gov", "go.co"];

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

                if (repeat < 20) {
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
                // Fail out if either dimension is less than MIN_IMG_SIZE.
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
     *   type of mobilenet.  Return of executing model.predict on an Image.
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
     * Executes the model on the input image, and returns the top predicted
     * classes.
     * @param {HTMLElement} imgElement HTML element holding the image to predict
     *     from.  Should have the correct size ofr mobilenet.
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

function loadBlacklist() {
    console.log('Loading blacklist...');
    const startTime = performance.now();

    try {
        var rawFile = new XMLHttpRequest();
        rawFile.open("GET", ADGUARD_FILTERLIST_URL, false);
        rawFile.onreadystatechange = function() {
            if (rawFile.readyState === 4) {
                if (rawFile.status === 200 || rawFile.status === 0) {
                    var allText = rawFile.responseText.split('||');
                    for (var i = 1; i < allText.length; i++) {
                        var ex = allText[i].split('^$document');
                        BLACKLIST.push(ex[0]);
                    }
                    console.log("BLACKLIST --> " + BLACKLIST.length);
                }
            }
        };
        rawFile.send(null);

        var allText = localStorage.getItem("cp_blacklist");
        if (allText != null) {
            CP_BLACKLIST = JSON.parse(allText);
            console.log("CP_BLACKLIST --> " + allText);
        }

        const totalTime = Math.floor(performance.now() - startTime);
        console.log(`Blacklist loaded and initialized in ${ totalTime } ms...`);
    } catch (error) {
        console.error(`Unable to load blacklist from URL: ${ ADGUARD_FILTERLIST_URL }`);
    }
}

function extractHostname(url) {
    var hostname;
    // find & remove protocol (http, ftp, etc.) and get hostname

    if (url.indexOf("//") > -1) {
        hostname = url.split('/')[2];
    } else {
        hostname = url.split('/')[0];
    }

    //find & remove port number
    hostname = hostname.split(':')[0];
    //find & remove "?"
    hostname = hostname.split('?')[0];

    return hostname;
}


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

function is_toplist(domain) {
    // widecart thay vì phải declare cụ thể google.com với google.com.vn hay www.google.com thì chỉ cần google.com
    // Hàm chạy tạm, cần cải thiện sau thay vì loop như thế này
    var d = extractHostname(domain);
    for (var i = 0; i < TOPLIST.length; i++) {
        var id = d.indexOf(TOPLIST[i]);
        if (id != -1) {
            return id;
        }
    }
    return -1;
}

chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
        // console.log(sender.tab ?
        //             "from a content script:" + sender.tab.url :
        //             "from the extension");
        switch (request.action) {
            case 'predict':
                imageClassifier.analyzeImage(request.srcUrl, request.srcType, sender.tab.id, 0);
                break;
            case 'analyze':
                imageClassifier.analyzeImage(request.srcUrl, request.srcType, sender.tab.id, 0);
                break;
            case 'hidetab':
                chrome.tabs.update(sender.tab.id, { url: chrome.extension.getURL("pages/blocking-pages/adBlockedPage.html") });

                var domain = extractHostname(request.url);
                if (CP_BLACKLIST.indexOf(domain) == -1 && is_toplist(domain) == -1) {
                    CP_BLACKLIST.push(domain);
                    localStorage.setItem("cp_blacklist", JSON.stringify(CP_BLACKLIST));
                }
                // req to server
                var messages = {
                    clientId: purify.utils.browser.getClientId(),
                    link: sender.tab.url,
                    POSITIVE_IMAGES: request.POSITIVE_IMAGES
                };
                // console.log(messages);
                break;
            case 'checkdomain':
                if (BLACKLIST.length == 0) {
                    loadBlacklist();
                }

                chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
                    var domain = extractHostname(tabs[0].url);
                    // console.log("domain " + domain + " is_toplist " + is_toplist(domain));
                    if ((BLACKLIST.indexOf(domain) >= 0 || CP_BLACKLIST.indexOf(domain) >= 0) && is_toplist(domain) == -1) {
                        chrome.tabs.update(sender.tab.id, { url: chrome.extension.getURL("pages/blocking-pages/adBlockedPage.html") });
                    }
                })
                break;
        }
    }
);

// chrome.webNavigation.onHistoryStateUpdated.addListener(function(details) {
//   console.log("details "+JSON.stringify(details));
//     // chrome.tabs.executeScript(null,{file:"src/content.js"});
// });

// chrome.webRequest.onBeforeRequest.addListener(
//   function(details) {

//       if(details.url.indexOf(".png") != -1 || details.url.indexOf(".jpg") != -1 || details.url.indexOf(".gif") != -1){
//          console.log("details.url "+details.url);
//          // srcUrl=details.url;
//          // srcType="img";
//          // chrome.tabs.sendMessage(tabId, {action: 'blurimage', srcUrl,srcType});
//       }
//   },
//   {urls: ["<all_urls>"]

//   },
//     ["blocking"]
// );

// chrome.webRequest.onBeforeRequest.addListener(
//   function(details) {

//     if(details.url.indexOf(".png") != -1 || details.url.indexOf(".jpg") != -1 || details.url.indexOf(".gif") != -1){
//       console.log("details.url "+details.url);
//     }
//     return {cancel: details.url.indexOf("doubleclick") != -1 || details.url.indexOf("eclick") != -1};
//   },
//   {urls: ["<all_urls>"],
//   types: ["script"]

//   },
//     ["blocking"]
// );