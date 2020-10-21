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
  const concurrentQueue = 3;

  let limitQueue = 0;
  let waitingQueue = [];
  let requestQueue = new Map();
  let activeTabs = new Set([DEFAULT_TAB_ID]);

  const addMessage = function (message) {
    const hasChannel = limitQueue < concurrentQueue;

    if (hasChannel) {
      nextMessage(message);
      return;
    }

    waitingQueue.push(message);
  };

  const nextMessage = function (message) {
    limitQueue++;

    onProcess(message, (err, result) => {
      if (err !== undefined) {
        onFailure(err);
      } else {
        onSuccess(result);
      }

      onDone(err !== undefined ? err : result);

      limitQueue--;

      if (waitingQueue.length > 0) {
        const message = waitingQueue.shift();
        setTimeout(() => nextMessage(message), 0);
        return;
      }

      if (limitQueue === 0 && waitingQueue.length === 0) {
        onDrain();
      }
    });
  };

  const onProcess = async function (
    { requestUrl, originUrl, tabId },
    callback
  ) {
    if (activeTabs.has(tabId)) {
      purify.nsfwFiltering
        .getPredictImage(requestUrl, originUrl)
        .then((result) => callback(undefined, { requestUrl, result }))
        .catch((error) =>
          callback({ requestUrl, errMessage: error.message }, undefined)
        );
    } else {
      callback({ requestUrl, errMessage: "User closed tab" }, undefined);
    }
  };

  const onSuccess = function ({ requestUrl, result }) {
    if (requestQueue.has(requestUrl)) {
      for (const [{ resolve }] of requestQueue.get(requestUrl)) {
        resolve(result);
      }
    } else {
      onFailure({
        requestUrl,
        errMessage: "Cannot find values in requestQueue",
      });
    }
  };

  const onFailure = function ({ requestUrl, errMessage }) {
    if (requestQueue.has(requestUrl)) {
      for (const [{ reject }] of requestQueue.get(requestUrl)) {
        reject(errMessage);
      }
    } else {
      purify.console.info(`Cannot find ${requestUrl}`);
    }
  };

  const onDone = function ({ requestUrl }) {
    requestQueue.delete(requestUrl);
  };

  const onDrain = function () {};

  const clearQueueByTabId = function (tabId) {
    activeTabs.delete(tabId);
  };

  const Producer = async function (requestUrl, originUrl, _tabId) {
    return await new Promise((resolve, reject) => {
      const tabId = _tabId === undefined ? DEFAULT_TAB_ID : _tabId;
      if (!activeTabs.has(tabId)) {
        activeTabs.add(tabId);
      }

      if (requestQueue.has(requestUrl)) {
        requestQueue.get(requestUrl)?.push([{ resolve, reject }]);
      } else {
        requestQueue.set(requestUrl, [[{ resolve, reject, tabId }]]);
        addMessage({ requestUrl, originUrl, tabId, resolve, reject });
      }
    });
  };

  return {
    addMessage,
    nextMessage,
    clearQueueByTabId,
    Producer,
  };
})(purify);
