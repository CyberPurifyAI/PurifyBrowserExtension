/**
 * ----------------------------------------------------------------------------------
 * PurifyBrowserExtension api.js
 * Licensed under MIT (https://github.com/CyberPurify/CyberPurify/blob/main/LICENSE)
 * ----------------------------------------------------------------------------------
 */

/**
 * Purify simple api
 * @type {{start, stop, configure}}
 */
(function (purify, global) {
  "use strict";

  function noOpFunc() {}

  /**
   * Validates configuration
   * @param configuration Configuration object
   */
  function validateConfiguration(configuration) {
    if (!configuration) {
      throw new Error('"configuration" parameter is required');
    }
    validateFiltersConfiguration(configuration.filters);
    validateDomains(configuration.whitelist, "whitelist");
    validateDomains(configuration.blacklist, "blacklist");
  }

  /**
   * Validates filters identifiers
   * @param filters Array
   */
  function validateFiltersConfiguration(filters) {
    if (!filters || filters.length === 0) {
      return;
    }
    for (var i = 0; i < filters.length; i++) {
      var filterId = filters[i];
      if (typeof filterId !== "number") {
        throw new Error(filterId + " is not a number");
      }
    }
  }

  /**
   * Validate domains
   * @param domains Array
   * @param prop Property name (whitelist or blacklist)
   */
  function validateDomains(domains, prop) {
    if (!domains || domains.length === 0) {
      return;
    }
    for (var i = 0; i < domains.length; i++) {
      var domain = domains[i];
      if (typeof domain !== "string") {
        throw new Error(
          "Domain " +
            domain +
            " at position " +
            i +
            " in " +
            prop +
            " is not a string"
        );
      }
    }
  }

  /**
   * Configures white and black lists.
   * If blacklist is not null filtration will be in inverted mode, otherwise in default mode.
   * @param configuration Configuration object: {whitelist: [], blacklist: []}
   */
  function configureWhiteBlackLists(configuration) {
    if (
      !configuration.force &&
      !configuration.blacklist &&
      !configuration.whitelist
    ) {
      return;
    }

    var domains;
    if (configuration.blacklist) {
      purify.whitelist.changeDefaultWhiteListMode(false);
      domains = configuration.blacklist;
    } else {
      purify.whitelist.changeDefaultWhiteListMode(true);
      domains = configuration.whitelist;
    }
    purify.whitelist.updateWhiteListDomains(domains || []);
  }

  /**
   * Configures enabled filters
   * @param configuration Configuration object: {filters: [...]}
   * @param callback
   */
  function configureFilters(configuration, callback) {
    if (!configuration.force && !configuration.filters) {
      callback();
      return;
    }

    var filterIds = (configuration.filters || []).slice(0);
    for (var i = filterIds.length - 1; i >= 0; i--) {
      var filterId = filterIds[i];
      var filter = purify.subscriptions.getFilter(filterId);
      if (!filter) {
        purify.console.error(
          "Filter with id {0} not found. Skip it...",
          filterId
        );
        filterIds.splice(i, 1);
      }
    }

    purify.filters.addAndEnableFilters(filterIds, function () {
      var enabledFilters = purify.filters.getEnabledFilters();
      for (var i = 0; i < enabledFilters.length; i++) {
        var filter = enabledFilters[i];
        if (filterIds.indexOf(filter.filterId) < 0) {
          purify.filters.disableFilters([filter.filterId]);
        }
      }

      var listernerId = purify.listeners.addListener(function (event) {
        if (event === purify.listeners.REQUEST_FILTER_UPDATED) {
          purify.listeners.removeListener(listernerId);
          callback();
        }
      });
    });
  }

  /**
   * Configures custom (user) rules
   * @param configuration Configuration object: {rules: [...]}
   */
  function configureCustomRules(configuration) {
    if (!configuration.force && !configuration.rules) {
      return;
    }

    var content = (configuration.rules || []).join("\r\n");
    purify.userrules.updateUserRulesText(content);
  }

  /**
   * Configures backend's URLs
   * @param configuration Configuration object: {filtersMetadataUrl: '...', filterRulesUrl: '...'}
   */
  function configureFiltersUrl(configuration) {
    if (
      !configuration.force &&
      !configuration.filtersMetadataUrl &&
      !configuration.filterRulesUrl
    ) {
      return;
    }
    purify.backend.configure({
      filtersMetadataUrl: configuration.filtersMetadataUrl,
      filterRulesUrl: configuration.filterRulesUrl,
    });
  }

  /**
   * Start filtration.
   * Also perform installation on first run.
   * @param configuration Configuration object
   * @param callback Callback function
   */
  var start = function (configuration, callback) {
    validateConfiguration(configuration);

    callback = callback || noOpFunc;

    // Force apply all configuration fields
    configuration.force = true;

    purify.rulesStorage.init(function () {
      purify.localStorage.init(function () {
        purify.filters.start({}, function () {
          configure(configuration, callback);
        });
      });
    });
  };

  /**
   * Stop filtration
   * @param callback Callback function
   */
  var stop = function (callback) {
    purify.filters.stop(callback || noOpFunc);
  };

  /**
   * Configure current filtration settings
   * @param configuration Filtration configuration: {filters: [], whitelist: [], blacklist: []}
   * @param callback
   */
  var configure = function (configuration, callback) {
    if (!purify.filters.isInitialized()) {
      throw new Error("Applications is not initialized. Use 'start' method.");
    }
    validateConfiguration(configuration);

    callback = callback || noOpFunc;

    configureFiltersUrl(configuration);
    configureWhiteBlackLists(configuration);
    configureCustomRules(configuration);
    configureFilters(configuration, callback);
  };

  purify.backend.configure({
    localFiltersFolder: "purify",
    redirectSourcesFolder: "purify",
    localFilterIds: [],
  });

  global.purifyApi = {
    start: start,
    stop: stop,
    configure: configure,
    /**
     *  Fired when a request is blocked
     *  var onBlocked = function (details) {console.log(details);};
     *  purifyApi.onRequestBlocked.addListener(onBlocked);
     *  purifyApi.onRequestBlocked.removeListener(onBlocked);
     *  details = {
     *      tabId: ...,
     *      requestUrl: "...",
     *      referrerUrl: "...",
     *      requestType: "...", see purify.RequestTypes
     *      rule: "..." // Rule text
     *      filterId: ... // Filter identifier
     *   };
     */
    onRequestBlocked: purify.webRequestService.onRequestBlocked,
  };
})(purify, window);
