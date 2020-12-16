/**
 * ----------------------------------------------------------------------------------
 * PurifyBrowserExtension prediction-queue.js
 * Licensed under MIT (https://github.com/CyberPurify/CyberPurify/blob/main/LICENSE)
 * ----------------------------------------------------------------------------------
 */

/**
 * prediction queue
 */
purify.predictionQueue = (function (purify) {
  "use strict";

  let requestQueue = new Map();
  let pauseFlag = false;
  let queue = null;

  const init = function () {
    queue = new purify.utils.concurrentQueue({
      concurrency: navigator.hardwareConcurrency * 1.5,
      timeout: 0,
      onProcess: onProcess,
      onSuccess: onSuccess,
      onFailure: onFailure,
      onDone: onDone,
      onDrain: onDrain,
    });
  };

  const onProcess = async function (
    { requestUrl, hashUrl, image, tabIdUrl },
    callback
  ) {
    if (!purify.loadingQueue._checkCurrentTabIdUrlStatus(tabIdUrl)) {
      callback(
        {
          requestUrl,
          error: new Error(
            "User closed tab or page where this requestUrl located"
          ),
        },
        undefined
      );
      return;
    }

    purify.purifyFiltering
      .getPredictImage(requestUrl, image)
      .then((result) =>
        callback(undefined, { requestUrl, hashUrl, tabIdUrl, result })
      )
      .catch((error) =>
        callback({ requestUrl, errMessage: error.message }, undefined)
      );
  };

  const onSuccess = function ({ requestUrl, hashUrl, tabIdUrl, result }) {
    if (!purify.loadingQueue._checkUrlStatus(requestUrl)) {
      return;
    }

    const { resolve } = purify.loadingQueue.getRequestMap().get(requestUrl);

    resolve(result);

    const { tabUrl } = tabIdUrl;

    saveCache({ requestUrl, hashUrl, tabUrl, result });

    if (pauseFlag && predictionQueue.getTaskAmount() <= 5) {
      pauseFlag = false;
      purify.loadingQueue.getQueue().resume();
    }
  };

  const onFailure = function ({ requestUrl, hashUrl, tabIdUrl, errMessage }) {
    if (!purify.loadingQueue._checkUrlStatus(requestUrl)) {
      return;
    }

    const { reject } = purify.loadingQueue.getRequestMap().get(requestUrl);

    reject(errMessage);

    const { tabUrl } = tabIdUrl;

    saveCache({ requestUrl, hashUrl, tabUrl, result: false });
  };

  const onDone = function ({ requestUrl }) {
    requestQueue.delete(requestUrl);
  };

  const onDrain = function () {
    pauseFlag = false;
    purify.loadingQueue.getQueue().resume();
  };

  const saveCache = function ({ requestUrl, hashUrl, tabUrl, result }) {
    let urlCache = purify.purifyFiltering.purifyUrlCache.cache.getValue(tabUrl);

    if (typeof urlCache === "undefined") {
      urlCache = [];
    }

    purify.purifyFiltering.purifyImageCache.cache.saveValue(hashUrl, result);

    if (result === true) {
      urlCache.push(requestUrl);
      const uniqueArr = urlCache.filter(uniqueArray);
      purify.purifyFiltering.purifyUrlCache.cache.saveValue(tabUrl, uniqueArr);
    }
  };

  const uniqueArray = function (value, index, self) {
    return self.indexOf(value) === index;
  };

  const getQueue = function () {
    return queue;
  };

  return {
    getQueue,
    pauseFlag,
    init,
    saveCache,
  };
})(purify, window);
