/**
 * ----------------------------------------------------------------------------------
 * PurifyBrowserExtension nsfw-filtering.js
 * Licensed under MIT (https://github.com/cyberpurify/CyberPurify/blob/main/LICENSE)
 * ----------------------------------------------------------------------------------
 */

/**
 * nsfw filtering
 */
purify.nsfwFiltering = (function (purify) {
  "use strict";

  const NSFW_MODEL_PATH = "../models/quant_nsfw_mobilenet/";
  const IMAGE_SIZE = 224;
  const FILTER_LIST = ["Hentai", "Porn", "Sexy"];
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

  const getPredictImage = function (requestUrl, originUrl) {
    let urlCache = nsfwImageCache.cache.getValue(originUrl);

    if (typeof urlCache === "undefined") {
      nsfwImageCache.cache.saveValue(originUrl, []);
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

              // purify.console.info(
              //   `${className} - ${probability} - ${result}`
              // );

              if (result) {
                nsfwImageCache.cache.saveValue(requestUrl, result);
                urlCache.push(requestUrl);
                nsfwImageCache.cache.saveValue(originUrl, urlCache);

                return Boolean(result);
              } else {
                return false;
              }
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

              // purify.console.info(
              //   `${className} - ${probability} - ${result}`
              // );

              if (result) {
                nsfwImageCache.cache.saveValue(requestUrl, result);
                urlCache.push(requestUrl);
                nsfwImageCache.cache.saveValue(originUrl, urlCache);

                return Boolean(result);
              } else {
                return false;
              }
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

  const handlePredictions = function (predictions) {
    const flattenArr = predictions.flat();

    const prediction = flattenArr.find(({ className, probability }) => {
      return FILTER_LIST.includes(className) && probability > 0.4;
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
  };
})(purify);
