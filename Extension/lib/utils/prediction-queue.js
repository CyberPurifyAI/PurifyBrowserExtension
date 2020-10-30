/**
 * ----------------------------------------------------------------------------------
 * PurifyBrowserExtension prediction-queue.js
 * Licensed under MIT (https://github.com/CyberPurify/CyberPurify/blob/main/LICENSE)
 * ----------------------------------------------------------------------------------
 */

/**
 * prediction queue
 */
purify.predictionQueue = (function (purify, global) {
  "use strict";

  const DEFAULT_TAB_ID = 999999;

  let requestQueue = new Map();
  let activeTabId = DEFAULT_TAB_ID;
  let pauseFlag = false;
  let queue = null;

  const init = function () {
    queue = new purify.utils.concurrentQueue({
      concurrency: 1,
      timeout: 0,
      onProcess: onProcess,
      onSuccess: onSuccess,
      onFailure: onFailure,
      onDone: onDone,
      onDrain: onDrain,
    });
  };

  const onProcess = async function (
    { requestUrl, hashUrl, image, originUrl, tabIdUrl },
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

    purify.nsfwFiltering
      .getPredictImage(requestUrl, image, originUrl)
      .then((result) => callback(undefined, { requestUrl, result }))
      .catch((error) =>
        callback({ requestUrl, errMessage: error.message }, undefined)
      );
  };

  const onSuccess = function ({ requestUrl, hashUrl, originUrl, result }) {
    if (!purify.loadingQueue._checkUrlStatus(requestUrl)) return;

    saveCache(requestUrl, hashUrl, originUrl, result);

    for (const [{ resolve }] of requestMap.get(requestUrl)) {
      resolve(result);
    }

    if (pauseFlag && predictionQueue.getTaskAmount() <= 5) {
      pauseFlag = false;
      purify.loadingQueue.queue.resume();
    }
  };

  const onFailure = function ({ requestUrl, hashUrl, originUrl, errMessage }) {
    if (!purify.loadingQueue._checkUrlStatus(requestUrl)) return;

    saveCache(requestUrl, hashUrl, originUrl, false);

    for (const [{ reject }] of requestMap.get(requestUrl)) {
      reject(errMessage);
    }
  };

  const onDone = function ({ requestUrl }) {
    requestQueue.delete(requestUrl);
  };

  const onDrain = function () {
    pauseFlag = false;
    purify.loadingQueue.queue.resume();
  };

  const saveCache = function (requestUrl, hashUrl, originUrl, result) {
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

  return {
    init,
  };
})(purify);
