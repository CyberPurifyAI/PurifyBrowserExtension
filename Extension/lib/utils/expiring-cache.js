

(function (purify) {
  /**
   * Cache with maxCacheSize stored in local storage, which automatically clears expired values
   *
   * @param {string} storagePropertyName      Name of the local storage property.
   * @param {number} size                     Max cache size
   */
  function ExpiringCache(storagePropertyName, size) {
    const CACHE_SIZE = 1000;

    const maxCacheSize = size || CACHE_SIZE;

    let cache;
    let cacheSize;

    function getCacheFromLocalStorage() {
      let data = Object.create(null);
      try {
        const json = purify.localStorage.getItem(storagePropertyName);
        if (json) {
          data = JSON.parse(json);
        }
      } catch (ex) {
        // ignore
        purify.console.error(
          "Error read from {0} cache, cause: {1}",
          storagePropertyName,
          ex
        );
        purify.localStorage.removeItem(storagePropertyName);
      }
      return data;
    }

    function saveCacheToLocalStorage() {
      try {
        purify.localStorage.setItem(
          storagePropertyName,
          JSON.stringify(cache)
        );
      } catch (ex) {
        purify.console.error(
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
      const value = cache[key];
      if (value !== undefined) {
        const expires = value.expires - 0;
        if (Date.now() >= expires) {
          return null;
        }
        return value.data;
      }
      return null;
    }

    function cleanup() {
      const keys = Object.keys(cache);
      for (let i = 0; i < keys.length; i += 1) {
        const key = keys[i];
        const foundItem = getValue(key);
        if (!foundItem) {
          delete cache[key];
          cacheSize -= 1;
        }
      }
      if (cacheSize > maxCacheSize / 2) {
        const keys = Object.keys(cache);
        for (let i = 0; i < keys.length; i += 1) {
          const key = keys[i];
          delete cache[key];
          cacheSize -= 1;
          if (cacheSize <= maxCacheSize / 2) {
            break;
          }
        }
      }
      saveCacheToLocalStorage();
    }

    const saveValue = function (key, data, expires) {
      if (!key) {
        return;
      }
      if (cacheSize > maxCacheSize) {
        cleanup();
      }
      cache[key] = {
        data,
        expires,
      };
      cacheSize += 1;

      if (cacheSize % 20 === 0) {
        saveCacheToLocalStorage();
      }
    };

    // Load cache
    cache = getCacheFromLocalStorage();
    cacheSize = Object.keys(cache).length;

    cleanup();

    return {
      getValue,
      saveValue,
    };
  }

  purify.utils.ExpiringCache = ExpiringCache;
})(purify);
