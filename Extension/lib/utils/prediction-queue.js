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
    { requestUrl, image, originUrl, tabIdUrl },
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

  const onSuccess = function ({ requestUrl, result }) {
    if (!purify.loadingQueue._checkUrlStatus(requestUrl)) return;

    // cache.set(requestUrl, result);

    for (const [{ resolve }] of requestMap.get(requestUrl)) {
      resolve(result);
    }

    if (pauseFlag && predictionQueue.getTaskAmount() <= 5) {
      pauseFlag = false;
      purify.loadingQueue.queue.resume();
    }
  };

  const onFailure = function ({ requestUrl, errMessage }) {
    if (!purify.loadingQueue._checkUrlStatus(requestUrl)) return;

    cache.set(requestUrl, false);

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

  return {
    init,
  };
})(purify);
