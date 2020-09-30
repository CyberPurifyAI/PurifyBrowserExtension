/* global LRUMap */

(function (adguard) {
  /**
   * Cache with maxCacheSize stored in local storage, which automatically clears less recently used entries
   *
   * @param {string} storagePropertyName      Name of the local storage property.
   * @param {number} size                     Max cache size
   */
  function LruCache(storagePropertyName, size) {
    const CACHE_SIZE = 1000;

    const maxCacheSize = size || CACHE_SIZE;

    let cache;
    let cacheSize;

    function getCacheFromLocalStorage() {
      let entries = null;
      try {
        const json = adguard.localStorage.getItem(storagePropertyName);
        if (json) {
          const data = JSON.parse(json);
          entries = data.map((x) => [x.key, x.value]);
        }
      } catch (ex) {
        // ignore
        adguard.console.error(
          "Error read from {0} cache, cause: {1}",
          storagePropertyName,
          ex
        );
        adguard.localStorage.removeItem(storagePropertyName);
      }

      return new LRUMap(maxCacheSize, entries);
    }

    function saveCacheToLocalStorage() {
      try {
        adguard.localStorage.setItem(
          storagePropertyName,
          JSON.stringify(cache.toJSON())
        );
      } catch (ex) {
        adguard.console.error(
          "Error save to {0} cache, cause: {1}",
          storagePropertyName,
          ex
        );
      }
    }

    /**
     * Retrieves value from cache and checks if saved data is not expired yet.
     * @param {string} key
     * @returns {null|object} saved data
     */
    function getValue(key) {
      return cache.get(key);
    }

    const saveValue = function (key, data) {
      if (!key) {
        return;
      }

      cache.set(key, data);
      cacheSize += 1;

      if (cacheSize % 20 === 0) {
        saveCacheToLocalStorage();
      }
    };

    // Load cache
    cache = getCacheFromLocalStorage();
    cacheSize = cache.size;

    return {
      getValue,
      saveValue,
    };
  }

  adguard.utils.LruCache = LruCache;
})(adguard);
