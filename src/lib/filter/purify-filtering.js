/**
 * ----------------------------------------------------------------------------------
 * PurifyBrowserExtension purify-filtering.js
 * Licensed under MIT (https://github.com/CyberPurify/CyberPurify/blob/main/LICENSE)
 * ----------------------------------------------------------------------------------
 */

/**
 * purify filtering
 */
purify.purifyFiltering = (function(purify, global) {
    "use strict";

    const PURIFY_MODEL_PATH = "../models/purify_mobilenet_tfjs/";
    const GIF_REGEX = /^.*(.gif)($|W.*$)/;
    // const FILTER_LIST = new Set(["Horror_aug", "Gory_aug", "Porn"]);

    // const RANGE_REJECT = {
    //   Gory_aug: { max: 0.4, min: 0.2 },
    //   Horror_aug: { max: 0.4, min: 0.2 },
    //   Heroin_aug: { max: 0.7, min: 0.5 },
    //   Drugs_aug: { max: 0.7, min: 0.5 },
    //   Neutral: { max: 0.4, min: 0.2 },
    //   Porn: { max: 0.9, min: 0.7 },
    //   Sexy: { max: 0.8, min: 0.6 },
    // };

    let purifyInstance = null;

    // const Strictness = 20;
    // const coefficient = 1 - Strictness / 100;

    const init = async function() {
        purify.console.info("Initializing Predict Image");
        purifyInstance = await purifyjs.load(PURIFY_MODEL_PATH, { type: 'graph' });
        purifyImageCache.cache.object();
        purifyUrlCache.cache.object();
    };

    const purifyImageCache = {
        get cache() {
            return purify.lazyGet(
                purifyImageCache,
                "cache",
                () => new purify.utils.LruCache("purify-image-cache", 100)
            );
        },
    };

    const purifyUrlCache = {
        get cache() {
            return purify.lazyGet(
                purifyUrlCache,
                "cache",
                () => new purify.utils.LruCache("purify-url-cache", 50)
            );
        },
    };

    const createHash = function(host) {
        return global.SHA256.hash(`${host}`);
    };

    const getPredictImage = async function(requestUrl, image) {
        if (GIF_REGEX.test(requestUrl)) {
            const prediction = await purifyInstance.classifyGif(image);
            // image.dispose();
            const { result, score } = handlePrediction([prediction]);
            // purify.console.info(`Result GIF: ${score} - ${requestUrl}`);

            return Boolean(result);
        } else {
            const prediction = await purifyInstance.classify(image, 7);
            // image.dispose();
            const { result, score } = handlePrediction([prediction]);
            // purify.console.info(`Result: ${score} - ${requestUrl}`);

            return Boolean(result);
        }
    };

    const Ruler = function(classes) {
        let labels = [];
        let Neutral_position = 7;

        for (let i = 0; i < classes.length; i++) {
            labels[classes[i].className] =
                Math.round(classes[i].probability * 100) / 100;

            if (classes[i].className == "Neutral") {
                Neutral_position = i;
            }
        }

        if (labels["Horror_aug"] >= 0.78) {
            return 1;
        } else if (labels["Gory_aug"] >= 0.75) {
            return 2;
        } else if (
            labels["Gory_aug"] + labels["Horror_aug"] >= 0.79 &&
            Neutral_position > 1
        ) {
            return 3;
        } else if (labels["Porn"] >= 0.7) {
            return 4;
        } else if (
            labels["Porn"] + labels["Sexy"] >= 0.75 &&
            Neutral_position > 1
        ) {
            return 5;
        } else if (
            labels["Porn"] + labels["Horror"] >= 0.75 &&
            Neutral_position > 1
        ) {
            return 6;
        } else if (
            labels["Porn"] + labels["Gory_aug"] >= 0.77 &&
            Neutral_position > 1
        ) {
            return 7;
        } else if (
            labels["Horror_aug"] + labels["Sexy"] >= 0.75 &&
            Neutral_position > 1
        ) {
            return 8;
        } else {
            return 0;
        }
    };

    // const Ruler = function(classes) {
    //     labels = []
    //     Neutral_position = 7;
    //     for (var i = 0; i < classes.length; i++) {
    //         labels[classes[i].className] = (Math.round(classes[i].probability * 100) / 100);
    //         if (classes[i].className == "Neutral") { Neutral_position = i; }
    //     }
    //     if (labels["Horror_aug"] >= 0.78) {
    //         return 1;
    //     } else if (labels["Gory_aug"] >= 0.75) {
    //         return 2;
    //     } else if (labels["Porn"] >= 0.7) {
    //         return 4;
    //     } else if (labels["Sexy"] >= 0.8) {
    //         return 9;
    //     } else if (
    //         (labels["Gory_aug"] + labels["Horror_aug"]) >= 0.79 &&
    //         Neutral_position > 1
    //     ) {
    //         return 3;
    //     } else if (
    //         (labels["Porn"] + labels["Sexy"]) >= 0.75 &&
    //         Neutral_position > 1
    //     ) {
    //         return 5;
    //     } else if (
    //         (labels["Porn"] + labels["Horror_aug"]) >= 0.75 &&
    //         Neutral_position > 1
    //     ) {
    //         return 6;
    //     } else if (
    //         (labels["Porn"] + labels["Gory_aug"]) >= 0.77 &&
    //         Neutral_position > 1
    //     ) {
    //         return 7;
    //     } else if (
    //         (labels["Horror_aug"] + labels["Sexy"]) >= 0.75 &&
    //         Neutral_position > 1
    //     ) {
    //         return 8;
    //     } else {
    //         return 0;
    //     }
    // }

    const handlePrediction = function([prediction]) {
        try {
            const score = Ruler(prediction);

            if (score > 0) {
                return { result: true, score };
            } else {
                return { result: false, score };
            }

            // const [
            //   { className: cn1, probability: pb1 },
            //   { className: cn2, probability: pb2 },
            // ] = prediction;
            // purify.console.info(`${cn1} - ${cn2} - ${pb1} - ${pb2}`);
            // const MIN1 = RANGE_REJECT[cn1].min * 100;
            // const MAX1 = RANGE_REJECT[cn1].max * 100;
            // const MIN2 = RANGE_REJECT[cn2].min * 100;
            // const MAX2 = RANGE_REJECT[cn2].max * 100;
            // const threshold1 =
            //   Strictness === 100 ? MIN1 : coefficient * (MAX1 - MIN1) + MIN1;
            // const threshold2 =
            //   Strictness === 100 ? MIN2 : coefficient * (MAX2 - MIN2) + MIN2;
            // const result1 =
            //   FILTER_LIST.has(cn1) &&
            //   pb1 > Math.round((threshold1 / 100) * 10000) / 10000;
            // if (result1) {
            //   return { result: result1, className: cn1, probability: pb1 };
            // }
            // const result2 =
            //   FILTER_LIST.has(cn2) &&
            //   pb2 > Math.round((threshold2 / 100) * 10000) / 10000;
            // if (result2) {
            //   return { result: result2, className: cn2, probability: pb2 };
            // }
            // return { result: result1, className: cn1, probability: pb1 };
        } catch (error) {
            return { result: true, className: null, probability: null };
        }
    };

    return {
        init,
        getPredictImage,
        purifyImageCache,
        purifyUrlCache,
        createHash,
    };
})(purify, window);