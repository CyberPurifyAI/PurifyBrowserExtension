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

  let queue = null;
  let requestMap = new Map();

  let activeTabId = DEFAULT_TAB_ID;
  let currentTabIdUrls = new Map([[DEFAULT_TAB_ID, `${DEFAULT_TAB_ID}`]]);

  const init = function () {
    queue = new purify.utils.concurrentQueue({
      concurrency: 2,
      timeout: 0,
      onProcess: onLoadingProcess,
      onSuccess: onLoadingSuccess,
      onFailure: onLoadingFailure,
      onDone: onLoadingDone,
      onDrain: onLoadingDrain,
    });
  };

  const _buildTabIdUrl = function (tab) {
    const tabIdUrl = {
      tabId: tab?.id ? tab.id : DEFAULT_TAB_ID,
      tabUrl: tab?.url ? tab?.url : `${DEFAULT_TAB_ID}`,
    };

    return tabIdUrl;
  };

  const predict = async function (requestUrl, originUrl, tabIdUrl) {
    return await new Promise((resolve, reject) => {
      const hashUrl = purify.nsfwFiltering.createHash(requestUrl);
      const cacheValue = nsfwImageCache.cache.getValue(hashUrl);

      if (cacheValue !== undefined) {
        resolve(cacheValue);
        return;
      }

      if (requestMap.has(requestUrl)) {
        requestMap.get(requestUrl)?.push([{ resolve, reject }]);
      } else {
        requestMap.set(requestUrl, [[{ resolve, reject }]]);
        queue.add({ requestUrl, originUrl, tabIdUrl });
      }
    });
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

  const onLoadingProcess = function (
    { requestUrl, originUrl, tabIdUrl },
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
        callback(undefined, { requestUrl, image, originUrl, tabIdUrl })
      )
      .catch((error) => callback({ requestUrl, error }, undefined));
  };

  const onLoadingSuccess = function ({
    requestUrl,
    image,
    originUrl,
    tabIdUrl,
  }) {
    if (!_checkUrlStatus(requestUrl)) return;

    if (!pauseFlag && purify.predictionQueue.queue.getTaskAmount() > 15) {
      pauseFlag = true;
      queue.pause();
    }

    purify.predictionQueue.queue.add({
      requestUrl,
      image,
      originUrl,
      tabIdUrl,
    });
  };

  const onLoadingFailure = function ({ requestUrl, error }) {
    if (!_checkUrlStatus(requestUrl)) return;

    for (const [{ reject }] of requestMap.get(requestUrl)) {
      reject(error);
    }

    cache.set(requestUrl, false);
    requestMap.delete(requestUrl);
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

  const onLoadingDone = function () {};

  const onLoadingDrain = function () {};

  return {
    init,
    loadImage,
    _buildTabIdUrl,
    predict,
    addTabIdUrl,
    updateTabIdUrl,
    clearByTabId,
    setActiveTabId,
    _checkUrlStatus,
    _checkCurrentTabIdUrlStatus,
  };
})(purify, window);
