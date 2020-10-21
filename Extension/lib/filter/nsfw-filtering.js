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

  let nsfwInstance = null;

  const Strictness = 50;
  const coefficient = 1 - Strictness / 100;

  const initialize = async function () {
    purify.console.info("Initializing Predict Image");
    nsfwInstance = await nsfwjs.load(NSFW_MODEL_PATH);
    nsfwImageCache.cache.object();
    nsfwUrlCache.cache.object();
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

  const loadImage = async function (requestUrl) {
    const image = new Image(IMAGE_SIZE, IMAGE_SIZE);

    return await new Promise((resolve, reject) => {
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

  const getPredictImage = async function (requestUrl, originUrl, tabId) {
    const hashUrl = createHash(requestUrl);
    const cacheValue = nsfwImageCache.cache.getValue(hashUrl);

    if (cacheValue !== undefined) {
      return cacheValue;
    } else {
      const image = await loadImage(requestUrl);

      if (GIF_REGEX.test(requestUrl)) {
        const prediction = await nsfwInstance.classifyGif(image);
        const { result, className, probability } = handlePrediction([
          prediction,
        ]);

        saveCache(hashUrl, requestUrl, originUrl, result);

        return Boolean(result);
      } else {
        const prediction = await nsfwInstance.classify(image, 2);
        const { result, className, probability } = handlePrediction([
          prediction,
        ]);

        saveCache(hashUrl, requestUrl, originUrl, result);

        purify.console.info(`${className} - ${probability} - ${result}`);

        return Boolean(result);
      }
    }
  };

  const saveCache = function (hashUrl, requestUrl, originUrl, result) {
    let urlCache = nsfwUrlCache.cache.getValue(originUrl);

    if (typeof urlCache === "undefined") {
      urlCache = [];
    }

    nsfwImageCache.cache.saveValue(hashUrl, result);

    if (result === true) {
      urlCache.push(requestUrl);
      const uniqueArr = urlCache.filter(uniqueArray);
      nsfwUrlCache.cache.saveValue(originUrl, uniqueArr);
    }
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

  return {
    initialize,
    getPredictImage,
    nsfwImageCache,
    nsfwUrlCache,
    createHash,
  };
})(purify, window);
