/**
 * Global adguard object
 */
var adguard = (function () {
  // eslint-disable-line
  /**
   * This function allows cache property in object. Use with javascript getter.
   *
   * var Object = {
   *
   *      get someProperty(){
   *          return adguard.lazyGet(Object, 'someProperty', function() {
   *              return calculateSomeProperty();
   *          });
   *      }
   * }
   *
   * @param object Object
   * @param prop Original property name
   * @param calculateFunc Calculation function
   * @returns {*}
   */
  const lazyGet = function (object, prop, calculateFunc) {
    const cachedProp = `_${prop}`;
    if (cachedProp in object) {
      return object[cachedProp];
    }
    const value = calculateFunc.apply(object);
    object[cachedProp] = value;
    return value;
  };

  /**
   * Clear cached property
   * @param object Object
   * @param prop Original property name
   */
  const lazyGetClear = function (object, prop) {
    delete object[`_${prop}`];
  };

  function notImplemented() {
    return false;
  }

  const hitStatsModule = {
    addRuleHit: notImplemented,
    addDomainView: notImplemented,
    cleanup: notImplemented,
  };

  const filteringLogModule = {
    addHttpRequestEvent: notImplemented,
    clearEventsByTabId: notImplemented,
    isOpen: notImplemented,
  };

  const safebrowsingModule = {
    checkSafebrowsingFilter: notImplemented,
  };

  const syncModule = {
    settingsProvider: notImplemented(),
  };

  return {
    lazyGet,
    lazyGetClear,

    /**
     * Define dummy modules.
     * In case of simple adguard API, some modules aren't supported
     */
    hitStats: hitStatsModule,
    filteringLog: filteringLogModule,
    safebrowsing: safebrowsingModule,
    sync: syncModule,
  };
})();
