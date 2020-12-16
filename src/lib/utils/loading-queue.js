/**
 * ----------------------------------------------------------------------------------
 * PurifyBrowserExtension loading-queue.js
 * Licensed under MIT (https://github.com/CyberPurify/CyberPurify/blob/main/LICENSE)
 * ----------------------------------------------------------------------------------
 */

/**
 * loading queue
 */
purify.loadingQueue = (function (purify) {
  "use strict";

  const LOADING_TIMEOUT = 5000;
  const DEFAULT_TAB_ID = 999999;
  const IMAGE_SIZE = 224;

  let queue = null;
  let requestMap = new Map();

  let activeTabId = DEFAULT_TAB_ID;
  let currentTabIdUrls = new Map([[DEFAULT_TAB_ID, `${DEFAULT_TAB_ID}`]]);

  const init = function () {
    queue = new purify.utils.concurrentQueue({
      concurrency: navigator.hardwareConcurrency * 1.5,
      timeout: 1000,
      onProcess: onLoadingProcess,
      onSuccess: onLoadingSuccess,
      onFailure: onLoadingFailure,
      onDone: undefined,
      onDrain: undefined,
    });
  };

  const predict = async function (requestUrl, tabIdUrl) {
    return await new Promise((resolve, reject) => {
      const hashUrl = purify.purifyFiltering.createHash(requestUrl);
      // const cacheValue = purify.purifyFiltering.purifyImageCache.cache.getValue(
      //   hashUrl
      // );

      // if (cacheValue !== undefined) {
      //   resolve(cacheValue);
      //   return;
      // }

      // if (requestMap.has(requestUrl)) {
      //   requestMap.get(requestUrl)?.push([{ resolve, reject }]);
      // } else {
      //   requestMap.set(requestUrl, [[{ resolve, reject }]]);
      //   queue.add({ requestUrl, hashUrl, tabIdUrl });
      // }

      requestMap.set(requestUrl, { resolve, reject });
      queue.add({ requestUrl, hashUrl, tabIdUrl });
    });
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
      image.onload = () => resolve(image);
      image.onerror = (err) => reject(err);
      image.src = requestUrl;
    });
  };

  const onLoadingProcess = function (
    { requestUrl, hashUrl, tabIdUrl },
    callback
  ) {
    if (!_checkCurrentTabIdUrlStatus(tabIdUrl)) {
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

    loadImage(requestUrl)
      .then((image) =>
        callback(undefined, { requestUrl, hashUrl, image, tabIdUrl })
      )
      .catch((error) => callback({ requestUrl, error }, undefined));
  };

  const onLoadingSuccess = function ({ requestUrl, hashUrl, image, tabIdUrl }) {
    if (!_checkUrlStatus(requestUrl)) {
      return;
    }

    if (
      !purify.predictionQueue.pauseFlag &&
      purify.predictionQueue.getQueue().getTaskAmount() > 15
    ) {
      purify.predictionQueue.pauseFlag = true;
      purify.predictionQueue.getQueue().pause();
    }

    purify.predictionQueue.getQueue().add({
      requestUrl,
      hashUrl,
      image,
      tabIdUrl,
    });
  };

  const onLoadingFailure = function ({ requestUrl, hashUrl, tabIdUrl }, error) {
    if (!_checkUrlStatus(requestUrl)) return;

    const { reject } = requestMap.get(requestUrl);

    reject(error);

    const { tabUrl } = tabIdUrl;

    purify.predictionQueue.saveCache({
      requestUrl,
      hashUrl,
      tabUrl,
      result: false,
    });
    requestMap.delete(requestUrl);
  };

  const addTabIdUrl = function (tabIdUrl) {
    const { tabId, tabUrl } = tabIdUrl;
    currentTabIdUrls.set(tabId, tabUrl);
  };

  const updateTabIdUrl = function (tabIdUrl) {
    const { tabId, tabUrl } = tabIdUrl;
    currentTabIdUrls.set(tabId, tabUrl);
  };

  const clearByTabId = function (tabId) {
    if (currentTabIdUrls.has(tabId)) {
      currentTabIdUrls.delete(tabId);
    }
  };

  const setActiveTabId = function (tabId) {
    activeTabId = tabId;
  };

  const _checkUrlStatus = function (requestUrl) {
    if (!requestMap.has(requestUrl)) {
      console.log(
        `Cannot find image in requestMap where requestUrl is ${requestUrl}`
      );
      return false;
    }

    return true;
  };

  const _checkCurrentTabIdUrlStatus = function ({ tabId, tabUrl }) {
    if (!currentTabIdUrls.has(tabId)) {
      return false; // user closed this tab id
    } else if (
      currentTabIdUrls.has(tabId) &&
      tabUrl !== currentTabIdUrls.get(tabId)
    ) {
      return false; // user's tab id matches current tab id, but url references to an another page
    } else {
      return true;
    }
  };

  const _buildTabIdUrl = function (tab) {
    const tabIdUrl = {
      tabId: tab?.tabId ? tab.tabId : DEFAULT_TAB_ID,
      tabUrl: tab?.url ? tab?.url : `${DEFAULT_TAB_ID}`,
    };

    return tabIdUrl;
  };

  const getQueue = function () {
    return queue;
  };

  const getRequestMap = function () {
    return requestMap;
  };

  return {
    getQueue,
    getRequestMap,
    init,
    loadImage,
    predict,
    addTabIdUrl,
    updateTabIdUrl,
    clearByTabId,
    setActiveTabId,
    _buildTabIdUrl,
    _checkUrlStatus,
    _checkCurrentTabIdUrlStatus,
  };
})(purify, window);
