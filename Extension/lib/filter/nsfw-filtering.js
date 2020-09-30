/**
 * nsfw filter
 */
adguard.nsfwFiltering = (function (adguard) {
  "use strict";

  const NSFW_MODEL_PATH = "../models/quant_nsfw_mobilenet/";
  const IMAGE_SIZE = 224;
  const FILTER_LIST = ["Hentai", "Porn", "Sexy"];
  const GIF_REGEX = /^.*(.gif)($|W.*$)/;

  let nsfwInstance = null;

  const initialize = async function () {
    adguard.console.info("Initializing NSFW Model");
    nsfwInstance = await nsfwjs.load(NSFW_MODEL_PATH);
  };

  const loadImage = async function (requestUrl) {
    const image = new Image(IMAGE_SIZE, IMAGE_SIZE);

    return await new Promise((resolve, reject) => {
      image.src = requestUrl;
      image.crossOrigin = "anonymous";
      image.onload = () => {
        return resolve(image);
      };
      image.onerror = (err) => {
        return reject(err);
      };
    });
  };

  const predictImage = async function (requestUrl) {
    const image = await loadImage(requestUrl);

    const prediction = await nsfwInstance.classify(image, 1);
    const { result, className, probability } = handlePredictions([prediction]);

    if (result) {
      // adguard.console.info(`IMG ${className} - ${probability} - ${requestUrl}`);
      return result;
    }

    if (GIF_REGEX.test(requestUrl)) {
      try {
        const predictionGIF = await nsfwInstance.classifyGif(image);

        const { result, className, probability } = handlePredictions(
          predictionGIF
        );
        // adguard.console.info(
        //   `GIF ${className} - ${probability} - ${requestUrl}`
        // );
        return result;
      } catch (e) {
        return false;
      }
    }

    return Boolean(result);
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

  async function getNSFWStatus(
    tabId,
    requestFrameId,
    requestUrl,
    referrerUrl,
    requestType,
    collapseElement
  ) {
    try {
      const nsfwStatus = await predictImage(requestUrl);

      if (nsfwStatus) {
        collapseElement(
          tabId,
          requestFrameId,
          requestUrl,
          referrerUrl,
          requestType
        );
      }
    } catch (e) {
      // console.log(e);
    }
  }

  return {
    initialize,
    loadImage,
    predictImage,
    handlePredictions,
    getNSFWStatus,
  };
})(adguard);
