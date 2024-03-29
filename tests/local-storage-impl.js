/**
 * ----------------------------------------------------------------------------------
 * PurifyBrowserExtension local-storage-impl.js
 * Licensed under MIT (https://github.com/cyberpurify/CyberPurify/blob/main/LICENSE)
 * ----------------------------------------------------------------------------------
 */

/**
 * `purify.localStorageImpl` implementation contains chrome API, so we can't use it in tests.
 *  As the decision, we write implementation for `purify.localStorageImpl`
 *  using wingow.localStorage
 */
purify.localStorageImpl = (function () {
  const getItem = function (key) {
    return localStorage.getItem(key);
  };

  const setItem = function (key, value) {
    localStorage.setItem(key, value);
  };

  const removeItem = function (key) {
    localStorage.removeItem(key);
  };

  const hasItem = function (key) {
    return key in localStorage;
  };

  return {
    getItem,
    setItem,
    removeItem,
    hasItem,
  };
})();
