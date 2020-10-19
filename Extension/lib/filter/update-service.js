/**
 * ----------------------------------------------------------------------------------
 * PurifyBrowserExtension update-service.js
 * Licensed under MIT (https://github.com/CyberPurify/CyberPurify/blob/main/LICENSE)
 * ----------------------------------------------------------------------------------
 */

/**
 * Service that manages extension version information and handles
 * extension update. For instance we may need to change storage schema on update.
 */
purify.applicationUpdateService = (function (purify) {
  /**
   * File storage adapter
   * @Deprecated Used now only to upgrade from versions older than v2.3.5
   */
  const FileStorage = {
    LINE_BREAK: "\n",
    FILE_PATH: "filters.ini",

    readFromFile(path, callback) {
      const successCallback = function (fs, fileEntry) {
        fileEntry.file((file) => {
          const reader = new FileReader();
          reader.onloadend = function () {
            if (reader.error) {
              callback(reader.error);
            } else {
              let lines = [];
              if (reader.result) {
                lines = reader.result.split(/[\r\n]+/);
              }
              callback(null, lines);
            }
          };

          reader.onerror = function (e) {
            callback(e);
          };

          reader.readAsText(file);
        }, callback);
      };

      this._getFile(path, true, successCallback, callback);
    },

    _getFile(path, create, successCallback, errorCallback) {
      path = path.replace(/^.*[\/\\]/, "");

      const requestFileSystem =
        window.requestFileSystem || window.webkitRequestFileSystem;
      requestFileSystem(
        window.PERSISTENT,
        1024 * 1024 * 1024,
        (fs) => {
          fs.root.getFile(
            path,
            { create },
            (fileEntry) => {
              successCallback(fs, fileEntry);
            },
            errorCallback
          );
        },
        errorCallback
      );
    },

    removeFile(path, successCallback, errorCallback) {
      this._getFile(
        path,
        false,
        (fs, fileEntry) => {
          fileEntry.remove(successCallback, errorCallback);
        },
        errorCallback
      );
    },
  };

  /**
   * Helper to execute deferred objects
   *
   * @param methods Methods to execute
   * @returns {Deferred}
   * @private
   */
  function executeMethods(methods) {
    const mainDfd = new purify.utils.Promise();

    var executeNextMethod = function () {
      if (methods.length === 0) {
        mainDfd.resolve();
      } else {
        const method = methods.shift();
        const dfd = method();
        dfd.then(executeNextMethod);
      }
    };

    executeNextMethod();

    return mainDfd;
  }

  /**
   * Updates filters storage - move from files to the storage API.
   *
   * Version 2.3.5
   * @returns {Promise}
   * @private
   */
  function onUpdateChromiumStorage() {
    purify.console.info("Call update to version 2.3.5");

    const dfd = new purify.utils.Promise();

    const filterId = purify.utils.filters.USER_FILTER_ID;
    const filePath = `filterrules_${filterId}.txt`;

    FileStorage.readFromFile(filePath, (e, rules) => {
      if (e) {
        purify.console.error(
          "Error while reading rules from file {0} cause: {1}",
          filePath,
          e
        );
        return;
      }

      const onTransferCompleted = function () {
        purify.console.info(
          "Rules have been transferred to local storage for filter {0}",
          filterId
        );

        FileStorage.removeFile(
          filePath,
          () => {
            purify.console.info("File removed for filter {0}", filterId);
          },
          () => {
            purify.console.error("File remove error for filter {0}", filterId);
          }
        );
      };

      if (rules) {
        purify.console.info(`Found rules:${rules.length}`);
      }

      purify.rulesStorage.write(filterId, rules, onTransferCompleted);
    });

    dfd.resolve();
    return dfd;
  }

  /**
   * Migrates from the storage.local to the indexedDB
   * Version > 2.7.3
   */
  function onUpdateFirefoxWebExtRulesStorage() {
    const dfd = new purify.utils.Promise();

    function writeFilterRules(keys, items) {
      if (keys.length === 0) {
        dfd.resolve();
      } else {
        const key = keys.shift();
        const lines = items[key] || [];
        const linesLength = lines.length;
        purify.rulesStorageImpl.write(key, lines, () => {
          purify.console.info(
            'Purify filter "{0}" has been migrated. Rules: {1}',
            key,
            linesLength
          );
          browser.storage.local.remove(key);
          writeFilterRules(keys, items);
        });
      }
    }

    function migrate() {
      purify.console.info(
        "Call update to use indexedDB instead of storage.local for Firefox browser"
      );

      browser.storage.local.get(null, (items) => {
        const keys = [];
        for (const key in items) {
          if (items.hasOwnProperty(key) && key.indexOf("filterrules_") === 0) {
            keys.push(key);
          }
        }

        writeFilterRules(keys, items);
      });
    }

    if (purify.rulesStorageImpl.isIndexedDB) {
      // Switch implementation to indexedDB
      migrate();
    } else {
      // indexedDB initialization failed, doing nothing
      dfd.resolve();
    }

    return dfd;
  }

  /**
   * Edge supports unlimitedStorage since Creators update.
   * Previously, we keep filter rules in localStorage, and now we have to migrate this rules to browser.storage.local
   * See https://github.com/CyberPurify/PurifyBrowserExtension/issues/566
   */
  function onUpdateEdgeRulesStorage() {
    const dfd = new purify.utils.Promise();

    const fixProperty = `edge-storage-local-fix-build${purify.utils.browser.EDGE_CREATORS_UPDATE}`;
    if (purify.localStorage.getItem(fixProperty)) {
      dfd.resolve();
      return dfd;
    }

    purify.console.info("Call update to use storage.local for Edge browser");

    const keys = [];
    for (const key in localStorage) {
      if (
        localStorage.hasOwnProperty(key) &&
        key.indexOf("filterrules_") === 0
      ) {
        keys.push(key);
      }
    }

    function writeFilterRules() {
      if (keys.length === 0) {
        purify.localStorage.setItem(fixProperty, true);
        dfd.resolve();
      } else {
        const key = keys.shift();
        let lines = [];
        const value = localStorage.getItem(key);
        if (value) {
          lines = value.split(/[\r\n]+/);
        }
        purify.rulesStorageImpl.write(key, lines, () => {
          localStorage.removeItem(key);
          writeFilterRules();
        });
      }
    }

    writeFilterRules();

    return dfd;
  }

  function handleUndefinedGroupStatuses() {
    const dfd = new purify.utils.Promise();

    const filters = purify.subscriptions.getFilters();

    const filtersState = purify.filtersState.getFiltersState();

    const enabledFilters = filters.filter((filter) => {
      const { filterId } = filter;
      return !!(filtersState[filterId] && filtersState[filterId].enabled);
    });

    const groupState = purify.filtersState.getGroupsState();

    enabledFilters.forEach((filter) => {
      const { groupId } = filter;
      if (typeof groupState[groupId] === "undefined") {
        purify.filters.enableGroup(filter.groupId);
      }
    });

    dfd.resolve();

    return dfd;
  }

  function handleDefaultUpdatePeriodSetting() {
    const dfd = new purify.utils.Promise();
    const previousDefaultValue = 6 * 60 * 60 * 1000; // 6 hours  // Old 48 * 60 * 60 * 1000 = 48 hours

    const currentUpdatePeriod = purify.settings.getFiltersUpdatePeriod();

    if (currentUpdatePeriod === previousDefaultValue) {
      purify.settings.setFiltersUpdatePeriod(
        purify.settings.DEFAULT_FILTERS_UPDATE_PERIOD
      );
    }

    dfd.resolve();

    return dfd;
  }

  /**
   * Function removes obsolete filters from the storage
   * @returns {Promise<any>}
   */
  function handleObsoleteFiltersRemoval() {
    const dfd = new purify.utils.Promise();

    const filtersStateInfo = purify.filtersState.getFiltersState();
    const allFiltersMetadata = purify.subscriptions.getFilters();

    const installedFiltersIds = Object.keys(filtersStateInfo).map((filterId) =>
      Number.parseInt(filterId, 10)
    );

    const existingFiltersIds = installedFiltersIds.filter((filterId) => {
      return allFiltersMetadata.find((f) => f.filterId === filterId);
    });

    const filtersIdsToRemove = installedFiltersIds.filter((id) => {
      return !existingFiltersIds.includes(id);
    });

    filtersIdsToRemove.forEach((filterId) =>
      purify.filtersState.removeFilter(filterId)
    );

    const removePromises = filtersIdsToRemove.map(
      (filterId) =>
        new Promise((resolve) => {
          purify.rulesStorage.remove(filterId, () => {
            purify.console.info(
              `Filter with id: ${filterId} removed from the storage`
            );
            resolve();
          });
          resolve();
        })
    );

    Promise.all(removePromises).then(() => {
      dfd.resolve();
    });

    return dfd;
  }

  /**
   * Async returns extension run info
   *
   * @param callback Run info callback with passed object {{isFirstRun: boolean, isUpdate: (boolean|*), currentVersion: (Prefs.version|*), prevVersion: *}}
   */
  const getRunInfo = function (callback) {
    const prevVersion = purify.utils.browser.getAppVersion();
    const currentVersion = purify.app.getVersion();
    purify.utils.browser.setAppVersion(currentVersion);

    const isFirstRun = currentVersion !== prevVersion && !prevVersion;
    const isUpdate = !!(currentVersion !== prevVersion && prevVersion);

    callback({
      isFirstRun,
      isUpdate,
      currentVersion,
      prevVersion,
    });
  };

  /**
   * Handle extension update
   * @param runInfo   Run info
   * @param callback  Called after update was handled
   */
  const onUpdate = function (runInfo, callback) {
    const methods = [];
    if (
      purify.utils.browser.isGreaterVersion("2.3.5", runInfo.prevVersion) &&
      purify.utils.browser.isChromium()
    ) {
      methods.push(onUpdateChromiumStorage);
    }
    if (
      purify.utils.browser.isEdgeBrowser() &&
      !purify.utils.browser.isEdgeBeforeCreatorsUpdate()
    ) {
      methods.push(onUpdateEdgeRulesStorage);
    }
    if (
      purify.utils.browser.isGreaterVersion("2.7.4", runInfo.prevVersion) &&
      purify.utils.browser.isFirefoxBrowser() &&
      typeof browser !== "undefined"
    ) {
      methods.push(onUpdateFirefoxWebExtRulesStorage);
    }
    if (purify.utils.browser.isGreaterVersion("3.0.3", runInfo.prevVersion)) {
      methods.push(handleUndefinedGroupStatuses);
    }
    if (purify.utils.browser.isGreaterVersion("3.3.5", runInfo.prevVersion)) {
      methods.push(handleDefaultUpdatePeriodSetting);
    }

    // On every update remove if necessary obsolete filters
    methods.push(handleObsoleteFiltersRemoval);

    const dfd = executeMethods(methods);
    dfd.then(callback);
  };

  return {
    getRunInfo,
    onUpdate,
  };
})(purify);
