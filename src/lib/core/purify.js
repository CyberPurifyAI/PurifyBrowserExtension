/**
 * ----------------------------------------------------------------------------------
 * PurifyBrowserExtension purify.js
 * Licensed under MIT (https://github.com/CyberPurify/CyberPurify/blob/main/LICENSE)
 * ----------------------------------------------------------------------------------
 */

/**
 * Global purify object
 */
var purify = (function() {
    // eslint-disable-line
    /**
     * This function allows cache property in object. Use with javascript getter.
     *
     * var Object = {
     *
     *      get someProperty(){
     *          return purify.lazyGet(Object, 'someProperty', function() {
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
    const lazyGet = function(object, prop, calculateFunc) {
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
    const lazyGetClear = function(object, prop) {
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

    const safebrowsingModule = {
        checkSafebrowsingFilter: notImplemented,
    };

    return {
        lazyGet,
        lazyGetClear,

        /**
         * Define dummy modules.
         * In case of simple purify API, some modules aren't supported
         */
        hitStats: hitStatsModule,
        safebrowsing: safebrowsingModule,
    };
})();