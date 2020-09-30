/**
 * ----------------------------------------------------------------------------------
 * PurifyBrowserExtension storage.js
 * Licensed under MIT (https://github.com/cyberpurify/CyberPurify/blob/main/LICENSE)
 * ----------------------------------------------------------------------------------
 */

/**
 * localStorage interface. Implementation depends on browser
 */
purify.localStorageImpl =
  purify.localStorageImpl ||
  (function () {
    function notImplemented() {
      throw new Error("Not implemented");
    }

    return {
      getItem: notImplemented,
      setItem: notImplemented,
      removeItem: notImplemented,
      hasItem: notImplemented,
    };
  })();

/**
 * This class manages local storage
 */
purify.localStorage = (function (purify, impl) {
  const getItem = function (key) {
    return impl.getItem(key);
  };

  const setItem = function (key, value) {
    try {
      impl.setItem(key, value);
    } catch (ex) {
      purify.console.error(
        `Error while saving item ${key} to the localStorage: ${ex}`
      );
    }
  };

  const removeItem = function (key) {
    impl.removeItem(key);
  };

  const hasItem = function (key) {
    return impl.hasItem(key);
  };

  const init = function (callback) {
    if (typeof impl.init === "function") {
      impl.init(callback);
    } else {
      callback();
    }
  };

  const isInitialized = function () {
    // WebExtension storage has async initialization
    if (typeof impl.isInitialized === "function") {
      return impl.isInitialized();
    }
    return true;
  };

  return {
    getItem,
    setItem,
    removeItem,
    hasItem,
    init,
    isInitialized,
  };
})(purify, purify.localStorageImpl);

/**
 * Rules storage interface. Implementation depends on browser
 */
purify.rulesStorageImpl =
  purify.rulesStorageImpl ||
  (function () {
    function notImplemented() {
      throw new Error("Not implemented");
    }

    return {
      read: notImplemented,
      write: notImplemented,
    };
  })();

/**
 * This class manages storage for filters.
 */
purify.rulesStorage = (function (purify, impl) {
  function getFilePath(filterId) {
    return `filterrules_${filterId}.txt`;
  }

  /**
   * Loads filter from the storage
   *
   * @param filterId  Filter identifier
   * @param callback  Called when file content has been loaded
   */
  const read = function (filterId, callback) {
    const filePath = getFilePath(filterId);
    impl.read(filePath, (e, rules) => {
      if (e) {
        purify.console.error(
          `Error while reading rules from file ${filePath} cause: ${e}`
        );
      }
      callback(rules);
    });
  };

  /**
   * Saves filter rules to storage
   *
   * @param filterId      Filter identifier
   * @param filterRules   Filter rules
   * @param callback      Called when save operation is finished
   */
  const write = function (filterId, filterRules, callback) {
    const filePath = getFilePath(filterId);
    impl.write(filePath, filterRules, (e) => {
      if (e) {
        purify.console.error(
          `Error writing filters to file ${filePath}. Cause: ${e}`
        );
      }
      callback();
    });
  };

  /**
   * Removes filter from storage
   * @param filterId
   * @param callback
   */
  const remove = (filterId, callback) => {
    const filePath = getFilePath(filterId);
    impl.remove(filePath, (e) => {
      if (e) {
        purify.console.error(`Error removing filter ${filePath}. Cause: ${e}`);
      }
      callback();
    });
  };

  /**
   * IndexedDB implementation of the rules storage requires async initialization.
   * Also in some cases IndexedDB isn't supported, so we have to replace implementation
   * with the browser.storage
   *
   * @param callback
   */
  const init = function (callback) {
    if (typeof impl.init === "function") {
      impl.init((api) => {
        impl = api;
        callback();
      });
    } else {
      callback();
    }
  };

  return {
    read,
    write,
    remove,
    init,
  };
})(purify, purify.rulesStorageImpl);
