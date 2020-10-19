/**
 * ----------------------------------------------------------------------------------
 * PurifyBrowserExtension antibanner.js
 * Licensed under MIT (https://github.com/CyberPurify/CyberPurify/blob/main/LICENSE)
 * ----------------------------------------------------------------------------------
 */

/**
 * Creating service that manages our filter rules.
 */
purify.antiBannerService = (function (purify) {
  // Add synthetic user filter
  const userFilter = { filterId: purify.utils.filters.USER_FILTER_ID };

  // Request filter contains all filter rules
  // This class does the actual filtering (checking URLs, constructing CSS/JS to inject, etc)
  let requestFilter = new purify.RequestFilter();

  // Service is not initialized yet
  let requestFilterInitTime = 0;

  // Application is running flag
  let applicationRunning = false;

  // Application initialized flag (Sets on first call of 'start' method)
  let applicationInitialized = false;

  // Get filters update period
  let filtersUpdatePeriod = purify.settings.getFiltersUpdatePeriod();

  /**
   * Delay before doing first filters update check -- 5 minutes
   */
  const UPDATE_FILTERS_DELAY = 5 * 60 * 1000;

  /**
   * Delay on application updated event
   */
  const APP_UPDATED_NOTIFICATION_DELAY = 60 * 1000;

  const FILTERS_CHANGE_DEBOUNCE_PERIOD = 1000;
  const RELOAD_FILTERS_DEBOUNCE_PERIOD = 1000;

  /**
   * List of events which cause RequestFilter re-creation
   * @type {Array}
   */
  const UPDATE_REQUEST_FILTER_EVENTS = [
    purify.listeners.UPDATE_FILTER_RULES,
    purify.listeners.FILTER_ENABLE_DISABLE,
    purify.listeners.FILTER_GROUP_ENABLE_DISABLE,
  ];

  const isUpdateRequestFilterEvent = (el) =>
    UPDATE_REQUEST_FILTER_EVENTS.indexOf(el.event) >= 0;

  /**
   * List of events which cause saving filter rules to the rules storage
   * @type {Array}
   */
  const SAVE_FILTER_RULES_TO_STORAGE_EVENTS = [
    purify.listeners.UPDATE_FILTER_RULES,
    purify.listeners.ADD_RULES,
    purify.listeners.REMOVE_RULE,
  ];

  const isSaveRulesToStorageEvent = function (el) {
    return SAVE_FILTER_RULES_TO_STORAGE_EVENTS.indexOf(el.event) >= 0;
  };

  let reloadedRules = false;

  /**
   * AntiBannerService initialize method. Process install, update or simple run.
   * @param options Constructor options
   * @param callback
   */
  function initialize(options, callback) {
    /**
     * Waits and notifies listener with application updated event
     *
     * @param runInfo
     */
    const notifyApplicationUpdated = function (runInfo) {
      setTimeout(() => {
        purify.listeners.notifyListeners(
          purify.listeners.APPLICATION_UPDATED,
          runInfo
        );
      }, APP_UPDATED_NOTIFICATION_DELAY);
    };

    /**
     * This method is called when filter subscriptions have been loaded from remote server.
     * It is used to recreate RequestFilter object.
     */
    const initRequestFilter = function () {
      loadFiltersVersionAndStateInfo();
      loadGroupsStateInfo();
      createRequestFilter(() => {
        addFiltersChangeEventListener();
        callback();
      });
    };

    /**
     * Callback for subscriptions loaded event
     */
    const onSubscriptionLoaded = function (runInfo) {
      // Subscribe to events which lead to update filters (e.g. switсh to optimized and back to default)
      subscribeToFiltersChangeEvents();

      if (runInfo.isFirstRun) {
        // Add event listener for filters change
        addFiltersChangeEventListener();
        // Run callback
        // Request filter will be initialized during install
        if (typeof options.onInstall === "function") {
          options.onInstall(callback);
        } else {
          callback();
        }
      } else if (runInfo.isUpdate) {
        // Updating storage schema on extension update (if needed)
        purify.applicationUpdateService.onUpdate(runInfo, initRequestFilter);
        // Show updated version popup
        notifyApplicationUpdated(runInfo);
      } else {
        // Init RequestFilter object
        initRequestFilter();
      }
      // Schedule filters update job
      scheduleFiltersUpdate(runInfo.isFirstRun);
    };

    /**
     * Init extension common info.
     */
    purify.applicationUpdateService.getRunInfo(async (runInfo) => {
      // Load subscription from the storage
      await purify.subscriptions.init();
      onSubscriptionLoaded(runInfo);
    });
  }

  /**
   * Initialize application (process install or update) . Create and start request filter
   * @param options
   * @param callback
   */
  const start = function (options, callback) {
    if (applicationRunning === true) {
      callback();
      return;
    }
    applicationRunning = true;

    if (!applicationInitialized) {
      initialize(options, callback);
      applicationInitialized = true;
      return;
    }

    createRequestFilter(callback);
  };

  /**
   * Clear request filter
   */
  const stop = function () {
    applicationRunning = false;
    requestFilter = new purify.RequestFilter();
    purify.listeners.notifyListeners(
      purify.listeners.REQUEST_FILTER_UPDATED,
      getRequestFilterInfo()
    );
  };

  /**
   * Checks application has been initialized
   * @returns {boolean}
   */
  const isInitialized = function () {
    return applicationInitialized;
  };

  /**
   * Getter for request filter
   */
  const getRequestFilter = function () {
    return requestFilter;
  };

  /**
   * Loads filter from storage (if in extension package) or from backend
   *
   * @param filterId Filter identifier
   * @param callback Called when operation is finished
   */
  const addAntiBannerFilter = (filterId, callback) => {
    const filter = getFilterById(filterId);
    if (filter.installed) {
      callback(true);
      return;
    }

    const onFilterLoaded = (success) => {
      if (success) {
        filter.installed = true;
      }
      callback(success);
    };

    if (filter.loaded) {
      onFilterLoaded(true);
      return;
    }

    /**
     * TODO: when we want to load filter from backend,
     *  we should retrieve metadata from backend too, but not from local file.
     */
    loadFilterRules(filter, false, onFilterLoaded);
  };

  /**
   * Reloads filters from backend
   *
   * @param successCallback
   * @param errorCallback
   * @private
   */
  function reloadAntiBannerFilters(successCallback, errorCallback) {
    resetFiltersVersion();
    checkAntiBannerFiltersUpdate(true, successCallback, errorCallback);
  }

  /**
   * Gets expires in sec end return in ms
   * If expires was less then minimumExpiresTime or we couldn't parse its value,
   * then return minimumExpiresTime
   * @param {*} expires
   * @returns {number}
   */
  const normalizeExpires = (expires) => {
    const minimumExpiresSec = 60 * 60;

    expires = Number.parseInt(expires, 10);

    if (Number.isNaN(expires) || expires < minimumExpiresSec) {
      expires = minimumExpiresSec;
    }

    return expires * 1000;
  };

  /**
   * Select filters for update. It depends on the time of last update,
   * on the filter enable status and group enable status
   * @param forceUpdate Force update flag.
   * @param filtersToUpdate Optional array of filters
   * @returns object
   */
  function selectFilterIdsToUpdate(forceUpdate, filtersToUpdate) {
    const filterIds = [];
    const filters = filtersToUpdate || purify.subscriptions.getFilters();

    const needUpdate = (filter) => {
      const { lastCheckTime } = filter;
      let { expires } = filter;

      if (!lastCheckTime) {
        return true;
      }

      expires = normalizeExpires(expires);
      if (
        filtersUpdatePeriod === purify.settings.DEFAULT_FILTERS_UPDATE_PERIOD
      ) {
        return lastCheckTime + expires <= Date.now();
      }

      return lastCheckTime + filtersUpdatePeriod <= Date.now();
    };

    for (let i = 0; i < filters.length; i += 1) {
      const filter = filters[i];
      const group = purify.subscriptions.getGroup(filter.groupId);
      if (filter.installed && filter.enabled && group.enabled) {
        if (forceUpdate || needUpdate(filter)) {
          filterIds.push(filter.filterId);
        }
      }
    }

    return {
      filterIds,
    };
  }

  /**
   * Checks filters updates.
   *
   * @param forceUpdate Normally we respect filter update period. But if this parameter is
   *                    true - we ignore it and check updates for all filters.
   * @param successCallback Called if filters were updated successfully
   * @param errorCallback Called if something gone wrong
   * @param filters     Optional Array of filters to update
   */
  const checkAntiBannerFiltersUpdate = (
    forceUpdate,
    successCallback,
    errorCallback,
    filters
  ) => {
    const noop = () => {}; // empty callback
    successCallback = successCallback || noop;
    errorCallback = errorCallback || noop;

    // Don't update in background if request filter isn't running
    if (!forceUpdate && !applicationRunning) {
      return;
    }

    purify.console.info("Start checking filters updates");

    // Select filters for update
    const toUpdate = selectFilterIdsToUpdate(forceUpdate, filters);
    const filterIdsToUpdate = toUpdate.filterIds;

    const totalToUpdate = filterIdsToUpdate.length;
    if (totalToUpdate === 0) {
      successCallback([]);
      purify.console.info("There is no filters to update");
      return;
    }

    purify.console.info("Checking updates for {0} filters", totalToUpdate);

    // Load filters with changed version
    const loadFiltersFromBackendCallback = (filterMetadataList) => {
      loadFiltersFromBackend(filterMetadataList, (success, filterIds) => {
        if (success) {
          const filters = filterIds
            .map(purify.subscriptions.getFilter)
            .filter((f) => f);

          successCallback(filters);
        } else {
          errorCallback();
        }
      });
    };

    /**
     * Method is called after we have got server response
     * Now we check filters version and update filter if needed
     * @param success
     * @param filterMetadataList
     */
    const onLoadFilterMetadataList = (success, filterMetadataList) => {
      if (success) {
        const filterMetadataListToUpdate = [];
        for (let i = 0; i < filterMetadataList.length; i += 1) {
          const filterMetadata = filterMetadataList[i];
          const filter = purify.subscriptions.getFilter(
            filterMetadata.filterId
          );
          if (
            filter &&
            filterMetadata.version &&
            purify.utils.browser.isGreaterVersion(
              filterMetadata.version,
              filter.version
            )
          ) {
            purify.console.info(
              `Updating filter ${filter.filterId} to version ${filterMetadata.version}`
            );
            filterMetadataListToUpdate.push(filterMetadata);
          } else {
            // remember that this filter version was checked
            filter.lastCheckTime = Date.now();
          }
        }
        loadFiltersFromBackendCallback(filterMetadataListToUpdate);
      } else {
        errorCallback();
      }
    };

    // Retrieve current filters metadata for update
    loadFiltersMetadataFromBackend(filterIdsToUpdate, onLoadFilterMetadataList);

    purify.parentalControl.syncData();
  };

  /**
   * Resets all filters versions
   */
  function resetFiltersVersion() {
    const RESET_VERSION = "0.0.0.0";

    const filters = purify.subscriptions.getFilters();
    for (let i = 0; i < filters.length; i += 1) {
      const filter = filters[i];
      filter.version = RESET_VERSION;
    }
  }

  /**
   * Updates groups state info
   * Loads state info from the storage and then updates purify.subscription.groups properly
   * @private
   */
  function loadGroupsStateInfo() {
    // Load filters state from the storage
    const groupsStateInfo = purify.filtersState.getGroupsState();

    const groups = purify.subscriptions.getGroups();

    for (let i = 0; i < groups.length; i += 1) {
      const group = groups[i];
      const { groupId } = group;
      const stateInfo = groupsStateInfo[groupId];
      if (stateInfo) {
        group.enabled = stateInfo.enabled;
      }
    }
  }

  /**
   * Updates filters version and state info.
   * Loads this data from the storage and then updates purify.subscription.filters property
   *
   * @private
   */
  function loadFiltersVersionAndStateInfo() {
    // Load filters metadata from the storage
    const filtersVersionInfo = purify.filtersState.getFiltersVersion();
    // Load filters state from the storage
    const filtersStateInfo = purify.filtersState.getFiltersState();

    const filters = purify.subscriptions.getFilters();

    for (let i = 0; i < filters.length; i += 1) {
      const filter = filters[i];
      const { filterId } = filter;
      const versionInfo = filtersVersionInfo[filterId];
      const stateInfo = filtersStateInfo[filterId];
      if (versionInfo) {
        filter.version = versionInfo.version;
        filter.lastCheckTime = versionInfo.lastCheckTime;
        filter.lastUpdateTime = versionInfo.lastUpdateTime;
        if (versionInfo.expires) {
          filter.expires = versionInfo.expires;
        }
      }
      if (stateInfo) {
        filter.enabled = stateInfo.enabled;
        filter.installed = stateInfo.installed;
        filter.loaded = stateInfo.loaded;
      }
    }
  }

  /**
   * Called when filters were loaded from the storage
   *
   * @param rulesFilterMap Map for populating rules (filterId -> rules collection)
   * @param callback Called when request filter is initialized
   */
  function onFiltersLoadedFromStorage(rulesFilterMap, callback) {
    const start = new Date().getTime();

    // UI thread becomes blocked on the options page while request filter is created
    // that't why we create filter rules using chunks of the specified length
    // Request filter creation is rather slow operation so we should
    // use setTimeout calls to give UI thread some time.
    const async = purify.requestFilter.isReady();
    const asyncStep = 1000;
    purify.console.info(
      "Starting request filter initialization. Async={0}",
      async
    );

    // Empty request filter
    const newRequestFilter = new purify.RequestFilter();

    if (requestFilterInitTime === 0) {
      // Setting the time of request filter very first initialization
      requestFilterInitTime = new Date().getTime();
      purify.listeners.notifyListeners(
        purify.listeners.APPLICATION_INITIALIZED
      );
    }

    // Supplement object to make sure that we use only unique filter rules
    const uniqueRules = Object.create(null);

    /**
     * Checks rulesFilterMap is empty (no one of filters are enabled)
     * @param rulesFilterMap
     * @returns {boolean}
     */
    function isEmptyRulesFilterMap(rulesFilterMap) {
      const enabledFilterIds = Object.keys(rulesFilterMap);
      if (enabledFilterIds.length === 0) {
        return true;
      }

      // User filter is enabled by default, but it may not contain any rules
      const userFilterId = purify.utils.filters.USER_FILTER_ID;
      if (
        enabledFilterIds.length === 1 &&
        enabledFilterIds[0] == userFilterId
      ) {
        const userRules = rulesFilterMap[userFilterId];
        if (!userRules || userRules.length === 0) {
          return true;
        }
      }

      return false;
    }

    /**
     * STEP 3: Called when request filter has been filled with rules.
     * This is the last step of request filter initialization.
     */
    const requestFilterInitialized = function () {
      // Request filter is ready
      requestFilter = newRequestFilter;

      if (callback && typeof callback === "function") {
        callback();
      }

      purify.listeners.notifyListeners(
        purify.listeners.REQUEST_FILTER_UPDATED,
        getRequestFilterInfo()
      );
      purify.console.info(
        "Finished request filter initialization in {0} ms. Rules count: {1}",
        new Date().getTime() - start,
        newRequestFilter.rulesCount
      );

      /**
       * If no one of filters is enabled, don't reload rules
       */
      if (isEmptyRulesFilterMap(rulesFilterMap)) {
        return;
      }

      if (newRequestFilter.rulesCount === 0 && !reloadedRules) {
        // https://github.com/CyberPurify/PurifyBrowserExtension/issues/205
        purify.console.info(
          "No rules have been found - checking filter updates"
        );
        reloadAntiBannerFilters();
        reloadedRules = true;
      } else if (newRequestFilter.rulesCount > 0 && reloadedRules) {
        purify.console.info("Filters reloaded, deleting reloadRules flag");
        reloadedRules = false;
      }
    };

    /**
     * Supplement function for adding rules to the request filter
     *
     * @param filterId Filter identifier
     * @param rulesTexts Array with filter rules
     * @param startIdx Start index of the rules array
     * @param endIdx End index of the rules array
     */
    const addRules = function (filterId, rulesTexts, startIdx, endIdx) {
      if (!rulesTexts) {
        return;
      }

      for (let i = startIdx; i < rulesTexts.length && i < endIdx; i += 1) {
        const ruleText = rulesTexts[i];
        if (ruleText in uniqueRules) {
          // Do not allow duplicates
          continue;
        }
        uniqueRules[ruleText] = true;
        const rule = purify.rules.builder.createRule(ruleText, filterId);

        if (rule !== null) {
          newRequestFilter.addRule(rule);
        }
      }
    };

    /**
     * Asynchronously adds rules to the request filter.
     */
    const addRulesAsync = (
      filterId,
      rulesTexts,
      startIdx,
      stopIdx,
      prevPromise
    ) =>
      new Promise((resolve) => {
        prevPromise.then(() => {
          setTimeout(() => {
            addRules(filterId, rulesTexts, startIdx, stopIdx);
            resolve();
          }, 1);
        });
      });

    /**
     * Asynchronously fills request filter with rules.
     */
    const fillRequestFilterAsync = function () {
      const rootPromise = Promise.resolve();
      let prevPromise = null;
      const promises = [];

      // Go through all filters in the map
      for (let filterId in rulesFilterMap) {
        // jshint ignore:line
        // To number
        filterId -= 0;
        if (filterId !== purify.utils.filters.USER_FILTER_ID) {
          const rulesTexts = rulesFilterMap[filterId];

          for (let i = 0; i < rulesTexts.length; i += asyncStep) {
            prevPromise = addRulesAsync(
              filterId,
              rulesTexts,
              i,
              i + asyncStep,
              prevPromise || rootPromise
            );
            promises.push(prevPromise);
          }
        }
      }

      // User filter should be the last
      // https://github.com/CyberPurify/PurifyBrowserExtension/issues/117
      const userFilterId = purify.utils.filters.USER_FILTER_ID;
      const userRules = rulesFilterMap[userFilterId];
      const startIndex = 0;
      const endIndex = userRules.length;
      prevPromise = addRulesAsync(
        userFilterId,
        userRules,
        startIndex,
        endIndex,
        prevPromise || rootPromise
      );
      promises.push(prevPromise);

      Promise.all(promises).then(() => {
        requestFilterInitialized();
      });
    };

    /**
     * Synchronously fills request filter with rules
     */
    const fillRequestFilterSync = function () {
      // Go through all filters in the map
      for (let filterId in rulesFilterMap) {
        // jshint ignore:line
        // To number
        filterId -= 0;
        if (filterId != purify.utils.filters.USER_FILTER_ID) {
          const rulesTexts = rulesFilterMap[filterId];
          addRules(filterId, rulesTexts, 0, rulesTexts.length);
        }
      }

      // User filter should be the last
      // https://github.com/CyberPurify/PurifyBrowserExtension/issues/117
      const userRules = rulesFilterMap[purify.utils.filters.USER_FILTER_ID];
      addRules(
        purify.utils.filters.USER_FILTER_ID,
        userRules,
        0,
        userRules.length
      );
      requestFilterInitialized();
    };

    if (async) {
      fillRequestFilterAsync();
    } else {
      fillRequestFilterSync();
    }
  }

  /**
   * Create new request filter and add distinct rules from the storage.
   *
   * @param callback Called after request filter has been created
   * @private
   */
  function createRequestFilter(callback) {
    if (applicationRunning === false) {
      if (typeof callback === "function") {
        callback();
      }
      return;
    }

    const start = new Date().getTime();
    purify.console.info("Starting loading filter rules from the storage");

    // Prepare map for filter rules
    // Map key is filter ID
    // Map value is array with filter rules
    const rulesFilterMap = Object.create(null);

    /**
     * STEP 2: Called when all filter rules have been loaded from storage
     */
    const loadAllFilterRulesDone = function () {
      purify.console.info(
        "Finished loading filter rules from the storage in {0} ms",
        new Date().getTime() - start
      );
      onFiltersLoadedFromStorage(rulesFilterMap, callback);
    };

    /**
     * Loads filter rules from storage
     *
     * @param filterId Filter identifier
     * @param rulesFilterMap Map for loading rules
     * @returns {*} Deferred object
     */
    const loadFilterRulesFromStorage = (filterId, rulesFilterMap) =>
      new Promise((resolve) => {
        purify.rulesStorage.read(filterId, (rulesText) => {
          if (rulesText) {
            rulesFilterMap[filterId] = rulesText;
          }
          resolve();
        });
      });

    /**
     * STEP 1: load all filters from the storage.
     */
    const loadFilterRules = function () {
      const promises = [];
      const filters = purify.subscriptions.getFilters();
      for (let i = 0; i < filters.length; i += 1) {
        const filter = filters[i];
        const group = purify.subscriptions.getGroup(filter.groupId);
        if (filter.enabled && group.enabled) {
          promises.push(
            loadFilterRulesFromStorage(filter.filterId, rulesFilterMap)
          );
        }
      }
      // get user filter rules from storage
      promises.push(
        loadFilterRulesFromStorage(
          purify.utils.filters.USER_FILTER_ID,
          rulesFilterMap
        )
      );

      // Load all filters and then recreate request filter
      Promise.all(promises).then(loadAllFilterRulesDone);
    };

    loadFilterRules();
  }

  /**
   * Request Filter info
   */
  var getRequestFilterInfo = function () {
    let rulesCount = 0;
    if (requestFilter) {
      rulesCount = requestFilter.rulesCount;
    }
    return {
      rulesCount,
    };
  };

  /**
   * Adds event listener for filters changes.
   * If filter is somehow changed this method checks if we should save changes to the storage
   * and if we should recreate RequestFilter.
   *
   * @private
   */
  function addFiltersChangeEventListener() {
    let filterEventsHistory = [];
    let onFilterChangeTimeout = null;

    const processEventsHistory = function () {
      const filterEvents = filterEventsHistory.slice(0);
      filterEventsHistory = [];
      onFilterChangeTimeout = null;

      const needCreateRequestFilter = filterEvents.some(
        isUpdateRequestFilterEvent
      );

      // Split by filterId
      const eventsByFilter = Object.create(null);
      for (let i = 0; i < filterEvents.length; i += 1) {
        const filterEvent = filterEvents[i];
        // don't add group events
        if (!filterEvent.filter) {
          continue;
        }
        if (!(filterEvent.filter.filterId in eventsByFilter)) {
          eventsByFilter[filterEvent.filter.filterId] = [];
        }
        eventsByFilter[filterEvent.filter.filterId].push(filterEvent);
      }

      const dfds = [];
      for (const filterId in eventsByFilter) {
        const needSaveRulesToStorage = eventsByFilter[filterId].some(
          isSaveRulesToStorageEvent
        );
        if (!needSaveRulesToStorage) {
          continue;
        }
        const dfd = processSaveFilterRulesToStorageEvents(
          filterId,
          eventsByFilter[filterId]
        );
        dfds.push(dfd);
      }

      if (needCreateRequestFilter) {
        // Rules will be added to request filter lazy, listeners will be notified about REQUEST_FILTER_UPDATED later
        purify.utils.Promise.all(dfds).then(createRequestFilter);
      } else {
        // Rules are already in request filter, notify listeners
        purify.listeners.notifyListeners(
          purify.listeners.REQUEST_FILTER_UPDATED,
          getRequestFilterInfo()
        );
      }
    };

    const processFilterEvent = function (event, filter, rules) {
      filterEventsHistory.push({ event, filter, rules });

      if (onFilterChangeTimeout !== null) {
        clearTimeout(onFilterChangeTimeout);
      }

      onFilterChangeTimeout = setTimeout(
        processEventsHistory,
        FILTERS_CHANGE_DEBOUNCE_PERIOD
      );
    };

    const processGroupEvent = function (event, group) {
      filterEventsHistory.push({ event, group });

      if (onFilterChangeTimeout !== null) {
        clearTimeout(onFilterChangeTimeout);
      }

      onFilterChangeTimeout = setTimeout(
        processEventsHistory,
        FILTERS_CHANGE_DEBOUNCE_PERIOD
      );
    };

    purify.listeners.addListener((event, filter, rules) => {
      switch (event) {
        case purify.listeners.ADD_RULES:
        case purify.listeners.REMOVE_RULE:
        case purify.listeners.UPDATE_FILTER_RULES:
        case purify.listeners.FILTER_ENABLE_DISABLE:
          processFilterEvent(event, filter, rules);
          break;
        default:
          break;
      }
    });

    purify.listeners.addListener((event, group) => {
      switch (event) {
        case purify.listeners.FILTER_GROUP_ENABLE_DISABLE:
          processGroupEvent(event, group);
          break;
        default:
          break;
      }
    });
  }

  /**
   * Saves updated filter rules to the storage.
   *
   * @param filterId Filter id
   * @param events Events (what has changed?)
   * @private
   */
  function processSaveFilterRulesToStorageEvents(filterId, events) {
    const dfd = new purify.utils.Promise();

    purify.rulesStorage.read(filterId, (loadedRulesText) => {
      for (let i = 0; i < events.length; i += 1) {
        if (!loadedRulesText) {
          loadedRulesText = [];
        }

        const event = events[i];
        const eventType = event.event;
        const eventRules = event.rules;

        switch (eventType) {
          case purify.listeners.ADD_RULES:
            loadedRulesText = loadedRulesText.concat(eventRules);
            purify.console.debug(
              "Add {0} rules to filter {1}",
              eventRules.length,
              filterId
            );
            break;
          case purify.listeners.REMOVE_RULE:
            var actionRule = eventRules[0];
            purify.utils.collections.removeAll(loadedRulesText, actionRule);
            purify.console.debug(
              "Remove {0} rule from filter {1}",
              actionRule,
              filterId
            );
            break;
          case purify.listeners.UPDATE_FILTER_RULES:
            loadedRulesText = eventRules;
            purify.console.debug(
              "Update filter {0} rules count to {1}",
              filterId,
              eventRules.length
            );
            break;
        }
      }

      purify.console.debug(
        "Save {0} rules to filter {1}",
        loadedRulesText.length,
        filterId
      );
      purify.rulesStorage.write(filterId, loadedRulesText, () => {
        dfd.resolve();
        if (filterId === purify.utils.filters.USER_FILTER_ID) {
          purify.listeners.notifyListeners(
            purify.listeners.UPDATE_USER_FILTER_RULES,
            getRequestFilterInfo()
          );
        }
      });
    });

    return dfd;
  }

  /**
   * Subscribe to events which lead to filters update.
   * @private
   */
  function subscribeToFiltersChangeEvents() {
    // on USE_OPTIMIZED_FILTERS setting change we need to reload filters
    const onUsedOptimizedFiltersChange = purify.utils.concurrent.debounce(
      reloadAntiBannerFilters,
      RELOAD_FILTERS_DEBOUNCE_PERIOD
    );

    purify.settings.onUpdated.addListener((setting) => {
      if (setting === purify.settings.USE_OPTIMIZED_FILTERS) {
        onUsedOptimizedFiltersChange();
        return;
      }
      if (setting === purify.settings.DISABLE_COLLECT_HITS) {
        getRequestFilter().cssFilter.dirty = true;
      }
      if (setting === purify.settings.FILTERS_UPDATE_PERIOD) {
        scheduleFiltersUpdate();
      }
    });
  }

  // Scheduling job
  let scheduleUpdateTimeoutId;
  function scheduleUpdate() {
    const checkTimeout = 1000 * 60 * 15; // 30 minutes
    if (scheduleUpdateTimeoutId) {
      clearTimeout(scheduleUpdateTimeoutId);
    }

    // don't update filters if filters update period is equal to 0
    if (filtersUpdatePeriod === 0) {
      return;
    }

    scheduleUpdateTimeoutId = setTimeout(() => {
      try {
        checkAntiBannerFiltersUpdate();
      } catch (ex) {
        purify.console.error("Error update filters, cause {0}", ex);
      }
      scheduleUpdate();
    }, checkTimeout);
  }

  /**
   * Schedules filters update job
   *
   * @param isFirstRun App first run flag
   * @private
   */
  function scheduleFiltersUpdate(isFirstRun) {
    filtersUpdatePeriod = purify.settings.getFiltersUpdatePeriod();
    // First run delay
    if (isFirstRun) {
      setTimeout(
        checkAntiBannerFiltersUpdate,
        UPDATE_FILTERS_DELAY,
        isFirstRun
      );
    }
    scheduleUpdate();
  }

  /**
   * Gets filter by ID.
   * Throws exception if filter not found.
   *
   * @param filterId Filter identifier
   * @returns {*} Filter got from purify.subscriptions.getFilter
   * @private
   */
  function getFilterById(filterId) {
    const filter = purify.subscriptions.getFilter(filterId);
    if (!filter) {
      throw new Error(`Filter with id: ${filterId} not found`);
    }
    return filter;
  }

  /**
   * Loads filters (ony-by-one) from the remote server
   *
   * @param filterMetadataList List of filter metadata to load
   * @param callback Called when filters have been loaded
   * @private
   */
  function loadFiltersFromBackend(filterMetadataList, callback) {
    const promises = filterMetadataList.map(
      (filterMetadata) =>
        new Promise((resolve, reject) => {
          loadFilterRules(filterMetadata, true, (success) => {
            if (!success) {
              return reject();
            }
            return resolve(filterMetadata.filterId);
          });
        })
    );

    Promise.all(promises)
      .then((filterIds) => {
        callback(true, filterIds);
      })
      .catch(() => {
        callback(false);
      });
  }

  /**
   * Loads filter rules
   *
   * @param filterMetadata Filter metadata
   * @param forceRemote Force download filter rules from remote server
   * (if false try to download local copy of rules if it's possible)
   * @param callback Called when filter rules have been loaded
   * @private
   */
  function loadFilterRules(filterMetadata, forceRemote, callback) {
    const filter = getFilterById(filterMetadata.filterId);

    filter._isDownloading = true;
    purify.listeners.notifyListeners(
      purify.listeners.START_DOWNLOAD_FILTER,
      filter
    );

    const successCallback = (filterRules) => {
      purify.console.info(
        "Retrieved response from server for filter {0}, rules count: {1}",
        filter.filterId,
        filterRules.length
      );
      delete filter._isDownloading;
      filter.version = filterMetadata.version;
      filter.lastUpdateTime = filterMetadata.timeUpdated;
      filter.lastCheckTime = forceRemote
        ? Date.now()
        : filterMetadata.timeUpdated;
      filter.loaded = true;
      filter.expires = filterMetadata.expires;
      // notify listeners
      purify.listeners.notifyListeners(
        purify.listeners.SUCCESS_DOWNLOAD_FILTER,
        filter
      );
      purify.listeners.notifyListeners(
        purify.listeners.UPDATE_FILTER_RULES,
        filter,
        filterRules
      );
      callback(true);
    };

    const errorCallback = (cause) => {
      purify.console.error(
        "Error retrieving response from the server for filter {0}, cause: {1}:",
        filter.filterId,
        cause || ""
      );
      delete filter._isDownloading;
      purify.listeners.notifyListeners(
        purify.listeners.ERROR_DOWNLOAD_FILTER,
        filter
      );
      callback(false);
    };

    purify.backend
      .loadFilterRules(
        filter.filterId,
        forceRemote,
        purify.settings.isUseOptimizedFiltersEnabled()
      )
      .then(successCallback, errorCallback);
  }

  /**
   * Loads filter versions from remote server
   *
   * @param filterIds Filter identifiers
   * @param callback Callback (called when load is finished)
   * @private
   */
  function loadFiltersMetadataFromBackend(filterIds, callback) {
    if (filterIds.length === 0) {
      callback(true, []);
      return;
    }

    const loadSuccess = (filterMetadataList) => {
      purify.console.debug(
        "Retrieved response from server for {0} filters, result: {1} metadata",
        filterIds.length,
        filterMetadataList.length
      );
      callback(true, filterMetadataList);
    };

    const loadError = (request, cause) => {
      purify.console.error(
        "Error retrieved response from server for filters {0}, cause: {1} {2}",
        filterIds,
        request.statusText,
        cause || ""
      );
      callback(false);
    };

    purify.backend.loadFiltersMetadata(filterIds, loadSuccess, loadError);
  }

  /**
   * Get request filter initialization time
   * @returns {number}
   */
  const getRequestFilterInitTime = function () {
    return requestFilterInitTime;
  };

  /**
   * Add rules to filter
   * @param rulesText
   * @returns {Array}
   */
  const addUserFilterRules = function (rulesText) {
    const rules = [];
    for (let i = 0; i < rulesText.length; i += 1) {
      const rule = purify.rules.builder.createRule(
        rulesText[i],
        purify.utils.filters.USER_FILTER_ID
      );
      if (rule !== null) {
        rules.push(rule);
      }
    }
    requestFilter.addRules(rules);

    purify.listeners.notifyListeners(
      purify.listeners.ADD_RULES,
      userFilter,
      rulesText
    );
    purify.listeners.notifyListeners(
      purify.listeners.UPDATE_USER_FILTER_RULES,
      getRequestFilterInfo()
    );

    return rules;
  };

  /**
   * Updates filter rules
   * @param rulesText Rules text
   */
  const updateUserFilterRules = function (rulesText) {
    purify.listeners.notifyListeners(
      purify.listeners.UPDATE_FILTER_RULES,
      userFilter,
      rulesText
    );
    purify.listeners.notifyListeners(
      purify.listeners.UPDATE_USER_FILTER_RULES,
      getRequestFilterInfo()
    );
  };

  /**
   * Remove rule from filter
   * @param ruleText
   */
  const removeUserFilterRule = function (ruleText) {
    const rule = purify.rules.builder.createRule(
      ruleText,
      purify.utils.filters.USER_FILTER_ID
    );
    if (rule !== null) {
      requestFilter.removeRule(rule);
    }
    purify.listeners.notifyListeners(purify.listeners.REMOVE_RULE, userFilter, [
      ruleText,
    ]);
  };

  return {
    start,
    stop,
    isInitialized,

    addAntiBannerFilter,

    getRequestFilter,
    getRequestFilterInitTime,

    addUserFilterRules,
    updateUserFilterRules,
    removeUserFilterRule,

    getRequestFilterInfo,

    checkAntiBannerFiltersUpdate,
  };
})(purify);

/**
 * Api for filtering and elements hiding.
 */
purify.requestFilter = (function (purify) {
  "use strict";

  const { antiBannerService } = purify;

  function getRequestFilter() {
    return antiBannerService.getRequestFilter();
  }

  /**
   * @returns boolean true when request filter was initialized first time
   */
  const isReady = function () {
    return antiBannerService.getRequestFilterInitTime() > 0;
  };

  /**
   * When browser just started we need some time on request filter initialization.
   * This could be a problem in case when browser has a homepage and it is just started.
   * In this case request filter is not yet initalized so we don't block requests and inject css.
   * To fix this, content script will repeat requests for selectors until request filter is ready
   * and it will also collapse all elements which should have been blocked.
   *
   * @returns boolean true if we should collapse elements with content script
   */
  const shouldCollapseAllElements = function () {
    // We assume that if content script is requesting CSS in first 5 seconds after request filter init,
    // then it is possible, that we've missed some elements and now we should collapse these elements
    const requestFilterInitTime = antiBannerService.getRequestFilterInitTime();
    return (
      requestFilterInitTime > 0 &&
      requestFilterInitTime + 5000 > new Date().getTime()
    );
  };

  const getRules = function () {
    return getRequestFilter().getRules();
  };

  const findRuleForRequest = function (
    requestUrl,
    documentUrl,
    requestType,
    documentWhitelistRule
  ) {
    return getRequestFilter().findRuleForRequest(
      requestUrl,
      documentUrl,
      requestType,
      documentWhitelistRule
    );
  };

  const findWhiteListRule = function (requestUrl, referrer, requestType) {
    return getRequestFilter().findWhiteListRule(
      requestUrl,
      referrer,
      requestType
    );
  };

  const findStealthWhiteListRule = function (
    requestUrl,
    referrer,
    requestType
  ) {
    return getRequestFilter().findStealthWhiteListRule(
      requestUrl,
      referrer,
      requestType
    );
  };

  const getSelectorsForUrl = function (documentUrl, genericHideFlag) {
    return getRequestFilter().getSelectorsForUrl(documentUrl, genericHideFlag);
  };

  const getInjectedSelectorsForUrl = function (documentUrl, genericHideFlag) {
    return getRequestFilter().getInjectedSelectorsForUrl(
      documentUrl,
      genericHideFlag
    );
  };

  const getScriptsForUrl = function (documentUrl) {
    return getRequestFilter().getScriptsForUrl(documentUrl);
  };

  const getScriptsStringForUrl = function (documentUrl, tab) {
    return getRequestFilter().getScriptsStringForUrl(documentUrl, tab);
  };

  const getContentRulesForUrl = function (documentUrl) {
    return getRequestFilter().getContentRulesForUrl(documentUrl);
  };

  const getMatchedElementsForContentRules = function (doc, rules) {
    return getRequestFilter().getMatchedElementsForContentRules(doc, rules);
  };

  const getCspRules = function (requestUrl, referrer, requestType) {
    return getRequestFilter().findCspRules(requestUrl, referrer, requestType);
  };

  const getCookieRules = function (requestUrl, referrer, requestType) {
    return getRequestFilter().findCookieRules(
      requestUrl,
      referrer,
      requestType
    );
  };

  const getReplaceRules = function (requestUrl, referrer, requestType) {
    return getRequestFilter().findReplaceRules(
      requestUrl,
      referrer,
      requestType
    );
  };

  const getRequestFilterInfo = function () {
    return antiBannerService.getRequestFilterInfo();
  };

  return {
    isReady,
    shouldCollapseAllElements,

    getRules,
    findRuleForRequest,
    findWhiteListRule,

    getSelectorsForUrl,
    getInjectedSelectorsForUrl,
    getScriptsForUrl,
    getScriptsStringForUrl,
    getContentRulesForUrl,
    getMatchedElementsForContentRules,
    getCspRules,
    getCookieRules,
    getReplaceRules,
    findStealthWhiteListRule,
    getRequestFilterInfo,
  };
})(purify);

/**
 * Helper class for working with filters metadata storage (local storage)
 * //TODO: Duplicated in filters-storage.js
 */
purify.filtersState = (function (purify) {
  const FILTERS_STATE_PROP = "filters-state";
  const FILTERS_VERSION_PROP = "filters-version";
  const GROUPS_STATE_PROP = "groups-state";

  /**
   * Gets filter version from the local storage
   * @returns {*}
   */
  const getFiltersVersion = function () {
    let filters = Object.create(null);
    try {
      const json = purify.localStorage.getItem(FILTERS_VERSION_PROP);
      if (json) {
        filters = JSON.parse(json);
      }
    } catch (ex) {
      purify.console.error(
        "Error retrieve filters version info, cause {0}",
        ex
      );
    }
    return filters;
  };

  /**
   * Gets filters state from the local storage
   * @returns {*}
   */
  const getFiltersState = function () {
    let filters = Object.create(null);
    try {
      const json = purify.localStorage.getItem(FILTERS_STATE_PROP);
      if (json) {
        filters = JSON.parse(json);
      }
    } catch (ex) {
      purify.console.error("Error retrieve filters state info, cause {0}", ex);
    }
    return filters;
  };

  /**
   * Gets groups state from the local storage
   * @returns {any}
   */
  const getGroupsState = function () {
    let groups = Object.create(null);
    try {
      const json = purify.localStorage.getItem(GROUPS_STATE_PROP);
      if (json) {
        groups = JSON.parse(json);
      }
    } catch (e) {
      purify.console.error("Error retrieve groups state info, cause {0}", e);
    }
    return groups;
  };

  /**
   * Updates filter version in the local storage
   *
   * @param filter Filter version metadata
   */
  const updateFilterVersion = function (filter) {
    const filters = getFiltersVersion();
    filters[filter.filterId] = {
      version: filter.version,
      lastCheckTime: filter.lastCheckTime,
      lastUpdateTime: filter.lastUpdateTime,
      expires: filter.expires,
    };

    purify.localStorage.setItem(FILTERS_VERSION_PROP, JSON.stringify(filters));
  };

  /**
   * Updates filter state in the local storage
   *
   * @param filter Filter state object
   */
  const updateFilterState = function (filter) {
    const filters = getFiltersState();
    filters[filter.filterId] = {
      loaded: filter.loaded,
      enabled: filter.enabled,
      installed: filter.installed,
    };
    purify.localStorage.setItem(FILTERS_STATE_PROP, JSON.stringify(filters));
  };

  const removeFilter = (filterId) => {
    const filters = getFiltersState();
    delete filters[filterId];
    purify.localStorage.setItem(FILTERS_STATE_PROP, JSON.stringify(filters));
  };

  /**
   * Updates group enable state in the local storage
   *
   * @param group - SubscriptionGroup object
   */
  const updateGroupState = function (group) {
    const groups = getGroupsState();
    groups[group.groupId] = {
      enabled: group.enabled,
    };
    purify.localStorage.setItem(GROUPS_STATE_PROP, JSON.stringify(groups));
  };

  // Add event listener to persist filter metadata to local storage
  purify.listeners.addListener((event, payload) => {
    switch (event) {
      case purify.listeners.SUCCESS_DOWNLOAD_FILTER:
        updateFilterState(payload);
        updateFilterVersion(payload);
        break;
      case purify.listeners.FILTER_ENABLE_DISABLE:
        updateFilterState(payload);
        break;
      case purify.listeners.FILTER_GROUP_ENABLE_DISABLE:
        updateGroupState(payload);
        break;
      default:
        break;
    }
  });

  return {
    getFiltersVersion,
    getFiltersState,
    getGroupsState,
    // These methods are used only for migrate from old versions
    updateFilterVersion,
    updateFilterState,
    removeFilter,
  };
})(purify);

/**
 * Class for manage filters state (enable, disable, add, remove, check updates)
 * Also includes method for initializing
 */
purify.filters = (function (purify) {
  "use strict";

  /**
   * TImeout for recently updated filters and again enabled filters - 5 minutes
   */
  const ENABLED_FILTERS_SKIP_TIMEOUT = 5 * 60 * 1000;

  const { antiBannerService } = purify;

  const start = function (options, callback) {
    antiBannerService.start(options, callback);
  };

  const stop = function (callback) {
    antiBannerService.stop();
    callback();
  };

  /**
   * Checks application has been initialized
   * @returns {boolean}
   */
  const isInitialized = function () {
    return antiBannerService.isInitialized();
  };

  /**
   * Offer filters on extension install, select default filters and filters by locale and country
   * @param callback
   */
  const offerFilters = (callback) => {
    // These filters are enabled by default
    const filterIds = [
      purify.utils.filters.ENGLISH_FILTER_ID,
      purify.utils.filters.SEARCH_AND_SELF_PROMO_FILTER_ID,
    ];
    if (purify.prefs.mobile) {
      filterIds.push(purify.utils.filters.MOBILE_ADS_FILTER_ID);
    }
    filterIds.concat(purify.subscriptions.getLangSuitableFilters());
    callback(filterIds);
  };

  /**
   * List of enabled filters.
   * User filter and whitelist filter are always enabled so they are excluded.
   *
   * @returns {Array} List of enabled filters
   */
  const getEnabledFilters = () =>
    purify.subscriptions.getFilters().filter((f) => f.installed && f.enabled);

  const getEnabledFiltersFromEnabledGroups = () => {
    const filters = purify.subscriptions.getFilters();
    const enabledGroupsIds = purify.subscriptions
      .getGroups()
      .filter((g) => g.enabled)
      .map((g) => g.groupId);
    return filters.filter(
      (f) => f.enabled && enabledGroupsIds.includes(f.groupId)
    );
  };

  /**
   * Checks if specified filter is enabled
   *
   * @param filterId Filter identifier
   * @returns {*} true if enabled
   */
  const isFilterEnabled = function (filterId) {
    const filter = purify.subscriptions.getFilter(filterId);
    return filter && filter.enabled;
  };

  /**
   * Checks if specified filter is installed (downloaded)
   *
   * @param filterId Filter id
   * @returns {*} true if installed
   */
  const isFilterInstalled = function (filterId) {
    const filter = purify.subscriptions.getFilter(filterId);
    return filter && filter.installed;
  };

  /**
   * Force checks updates for filters if specified or all filters
   *
   * @param successCallback
   * @param errorCallback
   * @param {Object[]} [filters] optional list of filters
   */
  const checkFiltersUpdates = (successCallback, errorCallback, filters) => {
    if (filters) {
      // Skip recently downloaded filters
      const outdatedFilter = filters.filter((f) =>
        f.lastCheckTime
          ? Date.now() - f.lastCheckTime > ENABLED_FILTERS_SKIP_TIMEOUT
          : true
      );

      if (outdatedFilter.length > 0) {
        antiBannerService.checkAntiBannerFiltersUpdate(
          true,
          successCallback,
          errorCallback,
          outdatedFilter
        );
      }
    } else {
      antiBannerService.checkAntiBannerFiltersUpdate(
        true,
        successCallback,
        errorCallback
      );
    }
  };

  /**
   * Enable group
   * @param {number} groupId filter group identifier
   */
  const enableGroup = function (groupId) {
    const group = purify.subscriptions.getGroup(groupId);
    if (!group || group.enabled) {
      return;
    }
    group.enabled = true;
    purify.listeners.notifyListeners(
      purify.listeners.FILTER_GROUP_ENABLE_DISABLE,
      group
    );
  };

  /**
   * Disable group
   * @param {number} groupId filter group identifier
   */
  const disableGroup = function (groupId) {
    const group = purify.subscriptions.getGroup(groupId);
    if (!group || !group.enabled) {
      return;
    }
    group.enabled = false;
    purify.listeners.notifyListeners(
      purify.listeners.FILTER_GROUP_ENABLE_DISABLE,
      group
    );
  };

  /**
   * Enable filter
   *
   * @param {Number} filterId Filter identifier
   * @param {{forceGroupEnable: boolean}} [options]
   * @returns {boolean} true if filter was enabled successfully
   */
  const enableFilter = (filterId, options) => {
    const filter = purify.subscriptions.getFilter(filterId);
    if (!filter || filter.enabled || !filter.installed) {
      return false;
    }
    filter.enabled = true;
    /**
     * we enable group if it was never enabled or disabled early
     */
    const { groupId } = filter;
    const forceGroupEnable = options && options.forceGroupEnable;
    if (
      !purify.subscriptions.groupHasEnabledStatus(groupId) ||
      forceGroupEnable
    ) {
      enableGroup(groupId);
    }
    purify.listeners.notifyListeners(
      purify.listeners.FILTER_ENABLE_DISABLE,
      filter
    );
    return true;
  };

  /**
   * Successively add filters from filterIds and then enable successfully added filters
   * @param filterIds Filter identifiers
   * @param {{forceGroupEnable: boolean}} [options]
   * @param callback We pass list of enabled filter identifiers to the callback
   */
  const addAndEnableFilters = (filterIds, callback, options) => {
    callback = callback || function noop() {}; // empty callback

    const enabledFilters = [];

    if (!filterIds || filterIds.length === 0) {
      callback(enabledFilters);
      return;
    }

    filterIds = purify.utils.collections.removeDuplicates(filterIds.slice(0));
    const loadNextFilter = () => {
      if (filterIds.length === 0) {
        callback(enabledFilters);
      } else {
        const filterId = filterIds.shift();
        antiBannerService.addAntiBannerFilter(filterId, (success) => {
          if (success) {
            const changed = enableFilter(filterId, options);
            if (changed) {
              const filter = purify.subscriptions.getFilter(filterId);
              enabledFilters.push(filter);
            }
          }
          loadNextFilter();
        });
      }
    };

    loadNextFilter();
  };

  /**
   * Disables filters by id
   *
   * @param {Array.<Number>} filterIds Filter identifiers
   * @returns {boolean} true if filter was disabled successfully
   */
  const disableFilters = function (filterIds) {
    // Copy array to prevent parameter mutation
    filterIds = purify.utils.collections.removeDuplicates(filterIds.slice(0));
    for (let i = 0; i < filterIds.length; i += 1) {
      const filterId = filterIds[i];
      const filter = purify.subscriptions.getFilter(filterId);
      if (!filter || !filter.enabled || !filter.installed) {
        continue;
      }
      filter.enabled = false;
      purify.listeners.notifyListeners(
        purify.listeners.FILTER_ENABLE_DISABLE,
        filter
      );
    }
  };

  /**
   * Uninstalls filters
   *
   * @param {Array.<Number>} filterIds Filter identifiers
   * @returns {boolean} true if filter was removed successfully
   */
  const uninstallFilters = function (filterIds) {
    // Copy array to prevent parameter mutation
    filterIds = purify.utils.collections.removeDuplicates(filterIds.slice(0));

    for (let i = 0; i < filterIds.length; i += 1) {
      const filterId = filterIds[i];
      const filter = purify.subscriptions.getFilter(filterId);
      if (!filter || !filter.installed) {
        continue;
      }

      purify.console.debug("Uninstall filter {0}", filter.filterId);

      filter.enabled = false;
      filter.installed = false;
      purify.listeners.notifyListeners(
        purify.listeners.FILTER_ENABLE_DISABLE,
        filter
      );
    }
  };

  /**
   * Removes filter
   *
   * @param {Number} filterId Filter identifier
   */
  const removeFilter = function (filterId) {
    const filter = purify.subscriptions.getFilter(filterId);
    if (!filter || filter.removed) {
      return;
    }

    purify.console.debug("Remove filter {0}", filter.filterId);

    filter.enabled = false;
    filter.installed = false;
    filter.removed = true;
    purify.listeners.notifyListeners(
      purify.listeners.FILTER_ENABLE_DISABLE,
      filter
    );
  };

  return {
    start,
    stop,
    isInitialized,

    offerFilters,

    getEnabledFilters,

    isFilterEnabled,
    isFilterInstalled,

    checkFiltersUpdates,

    addAndEnableFilters,
    disableFilters,
    uninstallFilters,
    removeFilter,

    enableGroup,
    disableGroup,

    getEnabledFiltersFromEnabledGroups,
  };
})(purify);
