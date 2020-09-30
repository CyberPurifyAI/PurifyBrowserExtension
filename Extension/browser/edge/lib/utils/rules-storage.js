/**
 * ----------------------------------------------------------------------------------
 * PurifyBrowserExtension rules-storage.js
 * Licensed under MIT (https://github.com/cyberpurify/CyberPurify/blob/main/LICENSE)
 * ----------------------------------------------------------------------------------
 */

/* global browser */

/**
 * Filter rules storage implementation.
 *
 * Unfortunately we have to use this strange logic due to Edge API incompatibilities:
 * unlimitedStorage permission isn't supported in the Anniversary update. Also, in this update (and of course before) Edge storage has a weird 1MB limit per value.
 * These issues will be fixed in the Creators update.
 *
 * See for details: https://github.com/CyberPurify/PurifyBrowserExtension/issues/566
 */

purify.rulesStorageImpl = (function (purify) {
  // TODO[Edge]: Remove this 'if' condition, when Insider build 15063 will be applied widely.
  if (purify.utils.browser.isEdgeBeforeCreatorsUpdate()) {
    return (function () {
      var read = function (path, callback) {
        try {
          var value = localStorage.getItem(path);
          var lines = [];
          if (value) {
            lines = value.split(/[\r\n]+/);
          }
          callback(null, lines);
        } catch (ex) {
          callback(ex);
        }
      };

      var write = function (path, data, callback) {
        var value = data.join("\n");
        try {
          localStorage.setItem(path, value);
          callback();
        } catch (ex) {
          callback(ex);
        }
      };

      var remove = function (path, successCallback) {
        localStorage.removeItem(path);
        successCallback();
      };

      return {
        write: write,
        read: read,
        remove: remove,
      };
    })();
  } else {
    return (function () {
      /**
       * Checks runtime.lastError and calls "callback" if so.
       *
       * @returns true if operation caused error
       */
      var checkLastError = function (callback) {
        if (browser.runtime.lastError) {
          callback(browser.runtime.lastError);
          return true;
        }

        return false;
      };

      var read = function (path, callback) {
        try {
          browser.storage.local.get(path, function (results) {
            if (!checkLastError(callback)) {
              var lines = [];

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

      var write = function (path, data, callback) {
        var item = {};
        item[path] = data;
        try {
          browser.storage.local.set(item, function () {
            if (!checkLastError(callback)) {
              callback();
            }
          });
        } catch (ex) {
          callback(ex);
        }
      };

      var remove = function (path, successCallback) {
        browser.storage.local.remove(path, successCallback);
      };

      return {
        read: read,
        write: write,
        remove: remove,
      };
    })();
  }
})(purify);
