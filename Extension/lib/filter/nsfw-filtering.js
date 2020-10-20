/**
 * ----------------------------------------------------------------------------------
 * PurifyBrowserExtension nsfw-filtering.js
 * Licensed under MIT (https://github.com/CyberPurify/CyberPurify/blob/main/LICENSE)
 * ----------------------------------------------------------------------------------
 */

/**
 * nsfw filtering
 */
purify.nsfwFiltering = (function (purify, global) {
  "use strict";

  const NSFW_MODEL_PATH = "../models/quant_nsfw_mobilenet/";
  const IMAGE_SIZE = 224;
  const GIF_REGEX = /^.*(.gif)($|W.*$)/;
  const LOADING_TIMEOUT = 5000;
  const FILTER_LIST = new Set(["Hentai", "Porn", "Sexy"]);
  const DEFAULT_TAB_ID = 999999;

  let nsfwInstance = null;
  let requestQueue = null;
  let activeTabs = new Set([DEFAULT_TAB_ID]);

  const Strictness = 50;
  const coefficient = 1 - Strictness / 100;

  const initialize = async function () {
    purify.console.info("Initializing Predict Image");
    nsfwInstance = await nsfwjs.load(NSFW_MODEL_PATH);
    nsfwImageCache.cache.object();
    nsfwUrlCache.cache.object();
    requestQueue = new Map();
  };

  const nsfwImageCache = {
    get cache() {
      return purify.lazyGet(
        nsfwImageCache,
        "cache",
        () => new purify.utils.LruCache("nsfw-image-cache", 200)
      );
    },
  };

  const nsfwUrlCache = {
    get cache() {
      return purify.lazyGet(
        nsfwUrlCache,
        "cache",
        () => new purify.utils.LruCache("nsfw-url-cache", 100)
      );
    },
  };

  const loadImage = function (requestUrl) {
    const image = new Image(IMAGE_SIZE, IMAGE_SIZE);

    return new Promise((resolve, reject) => {
      setTimeout(
        reject,
        LOADING_TIMEOUT,
        new Error(`Image timeout ${requestUrl}`)
      );

      image.crossOrigin = "anonymous";
      image.onload = () => {
        return resolve(image);
      };
      image.onerror = (err) => {
        return reject(err);
      };
      image.src = requestUrl;
    });
  };

  const createHash = function (host) {
    return global.SHA256.hash(`${host}`);
  };

  const getPredictImage = function (requestUrl, originUrl, tabId) {
    let urlCache = nsfwUrlCache.cache.getValue(originUrl);

    if (typeof urlCache === "undefined") {
      urlCache = [];
    }

    return loadImage(requestUrl)
      .then((image) => {
        if (GIF_REGEX.test(requestUrl)) {
          return nsfwInstance
            .classifyGif(image)
            .then((prediction) => {
              const { result, className, probability } = handlePrediction([
                prediction,
              ]);

              // purify.console.info(`${className} - ${probability} - ${result}`);
              const hash = createHash(requestUrl);
              nsfwImageCache.cache.saveValue(hash, result);

              if (result) {
                urlCache.push(requestUrl);
                const uniqueArr = urlCache.filter(uniqueArray);
                nsfwUrlCache.cache.saveValue(originUrl, uniqueArr);
              }

              return Boolean(result);
            })
            .catch((err) => {
              console.log(err);
              return true;
            });
        } else {
          return nsfwInstance
            .classify(image, 2)
            .then((prediction) => {
              const { result, className, probability } = handlePrediction([
                prediction,
              ]);

              // purify.console.info(`${className} - ${probability} - ${result}`);
              const hash = createHash(requestUrl);
              nsfwImageCache.cache.saveValue(hash, result);

              if (result) {
                urlCache.push(requestUrl);
                const uniqueArr = urlCache.filter(uniqueArray);
                nsfwUrlCache.cache.saveValue(originUrl, uniqueArr);
              }

              return Boolean(result);
            })
            .catch((err) => {
              console.log(err);
              return true;
            });
        }
      })
      .catch((err) => {
        console.log(err);
        return true;
      });
  };

  const uniqueArray = function (value, index, self) {
    return self.indexOf(value) === index;
  };

  const handlePrediction = function ([prediction]) {
    try {
      const [
        { className: cn1, probability: pb1 },
        { className: cn2, probability: pb2 },
      ] = prediction;

      const MIN1 = cn1 === "Porn" ? 33 : 45;
      const MAX1 = 98;
      const MIN2 = cn1 === "Porn" ? 12 : 20;
      const MAX2 = 50;
      const threshold1 =
        Strictness === 100 ? MIN1 : coefficient * (MAX1 - MIN1) + MIN1;
      const threshold2 =
        Strictness === 100 ? MIN2 : coefficient * (MAX2 - MIN2) + MIN2;

      const result1 =
        FILTER_LIST.has(cn1) &&
        pb1 > Math.round((threshold1 / 100) * 10000) / 10000;
      if (result1) {
        return { result: result1, className: cn1, probability: pb1 };
      }

      const result2 =
        FILTER_LIST.has(cn2) &&
        pb2 > Math.round((threshold2 / 100) * 10000) / 10000;
      if (result2) {
        return { result: result2, className: cn2, probability: pb2 };
      }

      return { result: result1, className: cn1, probability: pb1 };
    } catch (error) {
      return { result: true, className: null, probability: null };
    }
  };

  const predictionQueue = function (requestUrl, _tabId) {
    var promiseProducer = function () {
      // Your code goes here.
      // If there is work left to be done, return the next work item as a promise.
      // Otherwise, return null to indicate that all promises have been created.
      // Scroll down for an example.
    };

    // The number of promises to process simultaneously.
    var concurrency = 3;

    var pool = new PromisePool(promiseProducer, concurrency);

    var poolPromise = pool.start();

    poolPromise.then(
      function () {
        console.log("All promises fulfilled");
      },
      function (error) {
        console.log("Some promise rejected: " + error.message);
      }
    );
  };

  return {
    initialize,
    getPredictImage,
    nsfwImageCache,
    nsfwUrlCache,
    createHash,
    predictionQueue,
  };
})(purify, window);
