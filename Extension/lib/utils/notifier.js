/**
 * ----------------------------------------------------------------------------------
 * PurifyBrowserExtension notifier.js
 * Licensed under MIT (https://github.com/CyberPurify/CyberPurify/blob/main/LICENSE)
 * ----------------------------------------------------------------------------------
 */

/**
 * Simple mediator
 */
purify.listeners = (function () {
  var EventNotifierTypesMap = {
    ADD_RULES: "event.add.rules",
    REMOVE_RULE: "event.remove.rule",
    UPDATE_FILTER_RULES: "event.update.filter.rules",
    FILTER_GROUP_ENABLE_DISABLE: "filter.group.enable.disable", // enabled or disabled filter group
    FILTER_ENABLE_DISABLE: "event.filter.enable.disable", // Enabled or disabled
    FILTER_ADD_REMOVE: "event.filter.add.remove", // Added or removed
    ADS_BLOCKED: "event.ads.blocked",
    START_DOWNLOAD_FILTER: "event.start.download.filter",
    SUCCESS_DOWNLOAD_FILTER: "event.success.download.filter",
    ERROR_DOWNLOAD_FILTER: "event.error.download.filter",
    ENABLE_FILTER_SHOW_POPUP: "event.enable.filter.show.popup",
    LOG_EVENT: "event.log.track",
    UPDATE_TAB_BUTTON_STATE: "event.update.tab.button.state",
    REQUEST_FILTER_UPDATED: "event.request.filter.updated",
    APPLICATION_INITIALIZED: "event.application.initialized",
    APPLICATION_UPDATED: "event.application.updated",
    CHANGE_PREFS: "event.change.prefs",
    UPDATE_FILTERS_SHOW_POPUP: "event.update.filters.show.popup",
    UPDATE_USER_FILTER_RULES: "event.update.user.filter.rules",
    UPDATE_WHITELIST_FILTER_RULES: "event.update.whitelist.filter.rules",
    SETTING_UPDATED: "event.update.setting.value",
    FILTERS_UPDATE_CHECK_READY: "event.update.filters.check",
    // Log events
    TAB_ADDED: "log.tab.added",
    TAB_CLOSE: "log.tab.close",
    TAB_UPDATE: "log.tab.update",
    TAB_RESET: "log.tab.reset",
    LOG_EVENT_ADDED: "log.event.added",
    LOG_EVENT_UPDATED: "log.event.updated",
    // Sync events
    SETTINGS_UPDATED: "event.sync.finished",
  };

  var EventNotifierEventsMap = Object.create(null);

  var EventNotifier = {
    listenersMap: Object.create(null),
    listenersEventsMap: Object.create(null),
    listenerId: 0,

    /**
     * Subscribes listener to the specified events
     *
     * @param events    List of event types listener will be notified of
     * @param listener  Listener object
     * @returns Index of the listener
     */
    addSpecifiedListener: function (events, listener) {
      if (typeof listener !== "function") {
        throw new Error("Illegal listener");
      }
      var listenerId = this.listenerId++;
      this.listenersMap[listenerId] = listener;
      this.listenersEventsMap[listenerId] = events;
      return listenerId;
    },

    /**
     * Subscribe specified listener to all events
     *
     * @param listener Listener
     * @returns Index of the listener
     */
    addListener: function (listener) {
      if (typeof listener !== "function") {
        throw new Error("Illegal listener");
      }
      var listenerId = this.listenerId++;
      this.listenersMap[listenerId] = listener;
      return listenerId;
    },

    /**
     * Unsubscribe listener
     * @param listenerId Index of listener to unsubscribe
     */
    removeListener: function (listenerId) {
      delete this.listenersMap[listenerId];
      delete this.listenersEventsMap[listenerId];
    },

    /**
     * Notifies listeners about the events passed as arguments of this function.
     */
    notifyListeners: function () {
      var event = arguments[0];
      if (!event || !(event in EventNotifierEventsMap)) {
        throw new Error("Illegal event: " + event);
      }
      for (var listenerId in this.listenersMap) {
        // jshint ignore:line
        var events = this.listenersEventsMap[listenerId];
        if (events && events.length > 0 && events.indexOf(event) < 0) {
          continue;
        }
        try {
          var listener = this.listenersMap[listenerId];
          listener.apply(listener, arguments);
        } catch (ex) {
          purify.console.error(
            "Error invoking listener for {0} cause: {1}",
            event,
            ex
          );
        }
      }
    },

    /**
     * Asynchronously notifies all listeners about the events passed as arguments of this function.
     * Some events should be dispatched asynchronously, for instance this is very important for Safari:
     * https://github.com/CyberPurify/PurifyBrowserExtension/issues/251
     */
    notifyListenersAsync: function () {
      var args = arguments;
      setTimeout(function () {
        EventNotifier.notifyListeners.apply(EventNotifier, args);
      }, 500);
    },
  };

  // Make accessible only constants without functions. They will be passed to content-page
  EventNotifier.events = EventNotifierTypesMap;

  // Copy global properties
  for (var key in EventNotifierTypesMap) {
    if (EventNotifierTypesMap.hasOwnProperty(key)) {
      var event = EventNotifierTypesMap[key];
      EventNotifier[key] = event;
      if (event in EventNotifierEventsMap) {
        throw new Error("Duplicate event:  " + event);
      }
      EventNotifierEventsMap[event] = key;
    }
  }

  return EventNotifier;
})();
