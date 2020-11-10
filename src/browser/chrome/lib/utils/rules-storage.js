/**
 * ----------------------------------------------------------------------------------
 * PurifyBrowserExtension rules-storage.js
 * Licensed under MIT (https://github.com/CyberPurify/CyberPurify/blob/main/LICENSE)
 * ----------------------------------------------------------------------------------
 */

/**
 * Filter rules storage implementation
 */
purify.rulesStorageImpl = (function () {
  /**
   * Checks runtime.lastError and calls "callback" if so.
   *
   * @returns {boolean} true if operation caused error
   */
  const checkLastError = function (callback) {
    if (browser.runtime.lastError) {
      callback(browser.runtime.lastError);
      return true;
    }

    return false;
  };

  const read = function (path, callback) {
    try {
      browser.storage.local.get(path, (results) => {
        if (!checkLastError(callback)) {
          let lines = [];

          if (results && results[path] instanceof Array) {
            lines = results[path];
          }

          callback(null, lines);
        }
      });
    } catch (ex) {
      callback(ex);
    }
  };

  const write = function (path, data, callback) {
    const item = {};
    item[path] = data;
    try {
      browser.storage.local.set(item, () => {
        if (!checkLastError(callback)) {
          callback();
        }
      });
    } catch (ex) {
      callback(ex);
    }
  };

  const remove = function (path, successCallback) {
    browser.storage.local.remove(path, successCallback);
  };

  return {
    read,
    write,
    remove,
  };
})();
