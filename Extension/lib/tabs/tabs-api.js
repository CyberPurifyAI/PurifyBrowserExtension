/**
 * ----------------------------------------------------------------------------------
 * PurifyBrowserExtension tabs-api.js
 * Licensed under MIT (https://github.com/cyberpurify/CyberPurify/blob/main/LICENSE)
 * ----------------------------------------------------------------------------------
 */

(function (purify) {
  "use strict";

  purify.windowsImpl =
    purify.windowsImpl ||
    function () {
      function noOpFunc() {
        throw new Error("Not implemented");
      }

      const emptyListener = {
        addListener: noOpFunc,
        removeListener: noOpFunc,
      };

      return {
        onCreated: emptyListener, // callback (purifyWin, nativeWin)
        onRemoved: emptyListener, // callback (windowId, nativeWin)
        onUpdated: emptyListener, // callback (purifyWin, nativeWin, type) (Defined only for Firefox)

        create: noOpFunc,
        getLastFocused: noOpFunc, // callback (windowId, nativeWin)
        forEachNative: noOpFunc, // callback (nativeWin, purifyWin)
      };
    };

  purify.windows = (function (windowsImpl) {
    // eslint-disable-next-line no-unused-vars
    const PurifyWin = {
      windowId: 1,
      type: "normal", // 'popup'
    };

    function noOpFunc() {}

    const purifyWindows = Object.create(null); // windowId => PurifyWin

    windowsImpl.forEachNative((nativeWin, purifyWin) => {
      purifyWindows[purifyWin.windowId] = purifyWin;
    });

    const onCreatedChannel = purify.utils.channels.newChannel();
    const onRemovedChannel = purify.utils.channels.newChannel();

    windowsImpl.onCreated.addListener((purifyWin) => {
      purifyWindows[purifyWin.windowId] = purifyWin;
      onCreatedChannel.notify(purifyWin);
    });

    windowsImpl.onRemoved.addListener((windowId) => {
      const purifyWin = purifyWindows[windowId];
      if (purifyWin) {
        onRemovedChannel.notify(purifyWin);
        delete purifyWindows[windowId];
      }
    });

    const create = function (createData, callback) {
      windowsImpl.create(createData, callback || noOpFunc);
    };

    const getLastFocused = function (callback) {
      windowsImpl.getLastFocused((windowId) => {
        const metadata = purifyWindows[windowId];
        if (metadata) {
          callback(metadata[0]);
        }
      });
    };

    return {
      onCreated: onCreatedChannel, // callback(purifyWin)
      onRemoved: onRemovedChannel, // callback(purifyWin)

      create,
      getLastFocused, // callback (purifyWin)
    };
  })(purify.windowsImpl);

  purify.tabsImpl =
    purify.tabsImpl ||
    (function () {
      function noOpFunc() {
        throw new Error("Not implemented");
      }

      const emptyListener = {
        addListener: noOpFunc,
        removeListener: noOpFunc,
      };

      return {
        onCreated: emptyListener, // callback(tab)
        onRemoved: emptyListener, // callback(tabId)
        onUpdated: emptyListener, // callback(tab)
        onActivated: emptyListener, // callback(tabId)

        create: noOpFunc, // callback(tab)
        remove: noOpFunc, // callback(tabId)
        activate: noOpFunc, // callback(tabId)
        reload: noOpFunc,
        sendMessage: noOpFunc,
        getAll: noOpFunc, // callback(tabs)
        getActive: noOpFunc, // callback(tabId),
        get: noOpFunc, // callback(tab)
      };
    })();

  purify.tabs = (function (tabsImpl) {
    // eslint-disable-next-line no-unused-vars
    const PurifyTab = {
      tabId: 1,
      url: "url",
      title: "Title",
      incognito: false,
      status: null, // 'loading' or 'complete'
      frames: null, // Collection of frames inside tab
      metadata: null, // Contains info about white list rule is applied to tab.
    };

    // eslint-disable-next-line no-unused-vars
    const PurifyTabFrame = {
      frameId: 1,
      url: "url",
      domainName: "domainName",
    };

    function noOpFunc() {}

    const tabs = Object.create(null);

    // Fired when a tab is created. Note that the tab's URL may not be set at the time
    // this event fired, but you can listen to onUpdated events to be notified when a URL is set.
    const onCreatedChannel = purify.utils.channels.newChannel();

    // Fired when a tab is closed.
    const onRemovedChannel = purify.utils.channels.newChannel();

    // Fired when a tab is updated.
    const onUpdatedChannel = purify.utils.channels.newChannel();

    // Fires when the active tab in a window changes.
    const onActivatedChannel = purify.utils.channels.newChannel();

    /**
     * Saves tab to collection and notify listeners
     * @param aTab
     */
    function onTabCreated(aTab) {
      const tab = tabs[aTab.tabId];
      if (tab) {
        // Tab has been already synchronized
        return;
      }
      tabs[aTab.tabId] = aTab;
      onCreatedChannel.notify(aTab);
    }

    // Synchronize opened tabs
    tabsImpl.getAll((aTabs) => {
      for (let i = 0; i < aTabs.length; i++) {
        const aTab = aTabs[i];
        tabs[aTab.tabId] = aTab;
      }
    });

    tabsImpl.onCreated.addListener(onTabCreated);

    tabsImpl.onRemoved.addListener((tabId) => {
      const tab = tabs[tabId];
      if (tab) {
        onRemovedChannel.notify(tab);
        delete tabs[tabId];
      }
    });

    tabsImpl.onUpdated.addListener((aTab) => {
      const tab = tabs[aTab.tabId];
      if (tab) {
        tab.url = aTab.url;
        tab.title = aTab.title;
        tab.status = aTab.status;
        // If the tab was updated it means that it wasn't used to send requests in the background
        tab.synthetic = false;
        onUpdatedChannel.notify(tab);
      }
    });

    tabsImpl.onActivated.addListener((tabId) => {
      const tab = tabs[tabId];
      if (tab) {
        onActivatedChannel.notify(tab);
      }
    });

    // --------- Actions ---------

    // Creates a new tab.
    const create = function (details, callback) {
      tabsImpl.create(details, callback || noOpFunc);
    };

    // Closes tab.
    const remove = function (tabId, callback) {
      tabsImpl.remove(tabId, callback || noOpFunc);
    };

    // Activates tab (Also makes tab's window in focus).
    const activate = function (tabId, callback) {
      tabsImpl.activate(tabId, callback || noOpFunc);
    };

    // Reloads tab.
    const reload = function (tabId, url) {
      tabsImpl.reload(tabId, url);
    };

    // Updates tab url
    const updateUrl = (tabId, url) => {
      tabsImpl.updateUrl(tabId, url);
    };

    // Sends message to tab
    const sendMessage = function (tabId, message, responseCallback, options) {
      tabsImpl.sendMessage(tabId, message, responseCallback, options);
    };

    // Gets all opened tabs
    const getAll = function (callback) {
      tabsImpl.getAll((aTabs) => {
        const result = [];
        for (let i = 0; i < aTabs.length; i++) {
          const aTab = aTabs[i];
          let tab = tabs[aTab.tabId];
          if (!tab) {
            // Synchronize state
            tabs[aTab.tabId] = tab = aTab;
          }
          result.push(tab);
        }
        callback(result);
      });
    };

    const forEach = function (callback) {
      tabsImpl.getAll((aTabs) => {
        for (let i = 0; i < aTabs.length; i++) {
          const aTab = aTabs[i];
          let tab = tabs[aTab.tabId];
          if (!tab) {
            // Synchronize state
            tabs[aTab.tabId] = tab = aTab;
          }
          callback(tab);
        }
      });
    };

    // Gets active tab
    const getActive = function (callback) {
      tabsImpl.getActive((tabId) => {
        const tab = tabs[tabId];
        if (tab) {
          callback(tab);
        } else {
          // Tab not found in the local state, but we are sure that this tab exists. Sync...
          // TODO[Edge]: Relates to Edge Bug https://github.com/CyberPurify/PurifyBrowserExtension/issues/481
          tabsImpl.get(tabId, (tab) => {
            onTabCreated(tab);
            callback(tab);
          });
        }
      });
    };

    const isIncognito = function (tabId) {
      const tab = tabs[tabId];
      return tab && tab.incognito === true;
    };

    // Records tab's frame
    const recordTabFrame = function (tabId, frameId, url, domainName) {
      let tab = tabs[tabId];
      if (!tab && frameId === 0) {
        // Sync tab for that 'onCreated' event was missed.
        // https://github.com/CyberPurify/PurifyBrowserExtension/issues/481
        tab = {
          tabId,
          url,
          status: "loading",
          // We mark this tabs as synthetic because actually they may not exists
          synthetic: true,
        };
        onTabCreated(tab);
      }
      if (tab) {
        if (!tab.frames) {
          tab.frames = Object.create(null);
        }
        tab.frames[frameId] = {
          url,
          domainName,
        };
      }
    };

    const clearTabFrames = function (tabId) {
      const tab = tabs[tabId];
      if (tab) {
        tab.frames = null;
      }
    };

    // Gets tab's frame by id
    const getTabFrame = function (tabId, frameId) {
      const tab = tabs[tabId];
      if (tab && tab.frames) {
        return tab.frames[frameId || 0];
      }
      return null;
    };

    /**
     * Checks if the tab is new tab for popup or not
     * May be false positive for FF at least because new tab url in FF is "about:blank" too
     * @param tabId
     * @returns {boolean}
     */
    const isNewPopupTab = (tabId) => {
      const tab = tabs[tabId];
      if (!tab) {
        return false;
      }
      return !!(tab.url === "" || tab.url === "about:blank");
    };

    // Update tab metadata
    const updateTabMetadata = function (tabId, values) {
      const tab = tabs[tabId];
      if (tab) {
        if (!tab.metadata) {
          tab.metadata = Object.create(null);
        }
        for (const key in values) {
          if (values.hasOwnProperty && values.hasOwnProperty(key)) {
            tab.metadata[key] = values[key];
          }
        }
      }
    };

    // Gets tab metadata
    const getTabMetadata = function (tabId, key) {
      const tab = tabs[tabId];
      if (tab && tab.metadata) {
        return tab.metadata[key];
      }
      return null;
    };

    const clearTabMetadata = function (tabId) {
      const tab = tabs[tabId];
      if (tab) {
        tab.metadata = null;
      }
    };

    // Injecting resources to tabs
    const { insertCssCode } = tabsImpl;
    const { executeScriptCode } = tabsImpl;
    const { executeScriptFile } = tabsImpl;

    return {
      // Events
      onCreated: onCreatedChannel,
      onRemoved: onRemovedChannel,
      onUpdated: onUpdatedChannel,
      onActivated: onActivatedChannel,

      // Actions
      create,
      remove,
      activate,
      reload,
      sendMessage,
      getAll,
      forEach,
      getActive,
      isIncognito,
      updateUrl,

      // Frames
      recordTabFrame,
      clearTabFrames,
      getTabFrame,
      isNewPopupTab,

      // Other
      updateTabMetadata,
      getTabMetadata,
      clearTabMetadata,

      insertCssCode,
      executeScriptCode,
      executeScriptFile,
    };
  })(purify.tabsImpl);
})(purify);
