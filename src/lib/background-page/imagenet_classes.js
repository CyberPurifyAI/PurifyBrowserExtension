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

const IMAGENET_CLASSES = {
    0: "Drugs_aug",
    1: "Gory_aug",
    2: "Heroin_aug",
    3: "Horror_aug",
    4: "Neutral",
    5: "Porn",
    6: "Sexy"
};

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
        console.log('Loading ImageClassifier ...');
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
     * @param {*} callback
     * @param {object} input
     * @returns
     */
    async analyzeImage(callback, inputs) {
        if (!this.model) {
            console.log('Waiting for model to load...');
            setTimeout(() => { this.analyzeImage(callback, inputs) }, FIVE_SECONDS_IN_MS);
            return;
        }

        Promise.all(inputs.imagePredict.map(async(input) => {
            input.repeat = 0;
            input.predictions = await this.loadImage(callback, input)
                .then(
                    async(img) => {
                        if (!img) {
                            console.error('Could not load image.  Either too small or unavailable.');
                            return;
                        }
                        return await this.predict(img);
                    },
                    (reason) => {
                        console.error(`Failed to analyze: ${reason}`);
                        return input.predictions;
                    }
                );
            return input;
        })).then((results) => {
            console.log(results);
            callback({
                action: 'image_predicted',
                predicted: results
            });
        });

    }

    /**
     * * Creates a dom element and loads the image pointed to by the provided src.
     * @param {*} callback
     * @param {object} input
     * @returns
     */
    async loadImage(callback, input) {
        return new Promise((resolve, reject) => {
            const img = document.createElement('img');
            img.crossOrigin = 'anonymous';
            img.onerror = function(e) {
                reject(`Could not load image from external source ${ input.src }. Train again ${ input.repeat }`);
                input.predictions = [{ className: "Neutral", probability: 1 }];

                // if (input.repeat < 5) {
                //     input.repeat += 1;
                //     setTimeout(() => {
                //         imageClassifier.loadImage(callback, input);
                //     }, input.repeat * 750);
                // }
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
                    input.predictions = [{ className: "Neutral", probability: 1 }];
                }
                reject(`Image size too small. [${ img.height } x ${ img.width }] vs. minimum [${ MIN_IMG_SIZE } x ${ MIN_IMG_SIZE }]`);
            };
            img.src = input.src;
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
        // console.log(`indicesArr ${indicesArr}`);
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
        // console.log('Predicting...');
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
            // console.log("Result " + JSON.stringify(output));
            return output;
        });

        // Convert logits to probabilities and class names.
        const classes = await this.getTopKClasses(logits, TOPK_PREDICTIONS);
        // const totalTime1 = performance.now() - startTime1;
        // const totalTime2 = performance.now() - startTime2;
        // console.log(
        //     `Done in ${totalTime1.toFixed(1)} ms ` +
        //     `(not including preprocessing: ${Math.floor(totalTime2)} ms)`);
        return classes;
    }
}

export const imageClassifier = new ImageClassifier();