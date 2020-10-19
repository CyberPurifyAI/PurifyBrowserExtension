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

  let nsfwInstance = null;

  const initialize = async function () {
    purify.console.info("Initializing Predict Image");
    nsfwInstance = await nsfwjs.load(NSFW_MODEL_PATH);
  };

  const nsfwImageCache = {
    get cache() {
      return purify.lazyGet(
        nsfwImageCache,
        "cache",
        () => new purify.utils.LruCache("nsfw-image-cache")
      );
    },
  };

  const nsfwUrlCache = {
    get cache() {
      return purify.lazyGet(
        nsfwUrlCache,
        "cache",
        () => new purify.utils.LruCache("nsfw-url-cache")
      );
    },
  };

  const loadImage = function (requestUrl) {
    const image = new Image(IMAGE_SIZE, IMAGE_SIZE);

    return new Promise((resolve, reject) => {
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

  const getPredictImage = function (requestUrl, originUrl) {
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
              const { result, className, probability } = handlePredictions([
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
              return true;
            });
        } else {
          return nsfwInstance
            .classify(image, 1)
            .then((prediction) => {
              const { result, className, probability } = handlePredictions([
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
              return true;
            });
        }
      })
      .catch((err) => {
        return true;
      });
  };

  const uniqueArray = function (value, index, self) {
    return self.indexOf(value) === index;
  };

  const handlePredictions = function (predictions) {
    const flattenArr = predictions.flat();

    const prediction = flattenArr.find(({ className, probability }) => {
      if (
        (["Hentai", "Porn"].includes(className) && probability > 0.4) ||
        (["Sexy"].includes(className) && probability > 0.9)
      ) {
        return { result: true, className, probability };
      }
    });

    if (prediction !== undefined) {
      return { result: true, ...prediction };
    }

    return {
      result: false,
      className: flattenArr[0].className,
      probability: flattenArr[0].probability,
    };
  };

  return {
    initialize,
    getPredictImage,
    nsfwImageCache,
    nsfwUrlCache,
    createHash,
  };
})(purify, window);
