/**
 * ----------------------------------------------------------------------------------
 * PurifyBrowserExtension notifications.js
 * Licensed under MIT (https://github.com/CyberPurify/CyberPurify/blob/main/LICENSE)
 * ----------------------------------------------------------------------------------
 */

/**
 * Object that manages user settings.
 * @constructor
 */
purify.notifications = (function (purify) {
  "use strict";

  const VIEWED_NOTIFICATIONS = "viewed-notifications";
  const LAST_NOTIFICATION_TIME = "viewed-notification-time";

  const newYearNotification = {
    id: "newYear2020",
    locales: {
      en: {
        title: "CyberPurify wishes you happy holidays",
        btn: "Get your present",
      },
    },
    text: "",
    url:
      "https://cyberpurify.com/forward.html?action=ny2020_notify&from=popup&app=browser_extension",
    from: "24 December 2019 00:00:00",
    to: "1 January 2020 00:00:00",
    type: "animated",
    get icons() {
      return purify.lazyGet(newYearNotification, "icons", () => ({
        ICON_GREEN: {
          19: purify.getURL("icons/icon-19-ny.png"),
          38: purify.getURL("icons/icon-38-ny.png"),
        },
        ICON_GRAY: {
          19: purify.getURL("icons/icon-gray-19-ny.png"),
          38: purify.getURL("icons/icon-gray-38-ny.png"),
        },
      }));
    },
  };

  /**
   * @typedef Notification
   * @type object
   * @property {string} id
   * @property {object} locales
   * @property {string} url
   * @property {string} text
   * @property {string} from
   * @property {string} to
   * @property {string} bgColor;
   * @property {string} textColor;
   * @property {string} badgeBgColor;
   * @property {string} badgeText;
   * @property {string} type;
   */
  let notifications = {
    newYear2020: newYearNotification,
  };

  /**
   * Gets the last time a notification was shown.
   * If it was not shown yet, initialized with the current time.
   */
  const getLastNotificationTime = function () {
    let lastTime = purify.localStorage.getItem(LAST_NOTIFICATION_TIME) || 0;
    if (lastTime === 0) {
      lastTime = new Date().getTime();
      purify.localStorage.setItem(LAST_NOTIFICATION_TIME, lastTime);
    }
    return lastTime;
  };

  /**
   * Scans notification locales and returns the one matching navigator.language
   * @param {*} notification notification object
   * @returns {string} matching text or null
   */
  const getNotificationText = function (notification) {
    const { language } = navigator;
    if (!language) {
      return null;
    }

    const languageCode = language.split("-")[0];
    if (!languageCode) {
      return null;
    }

    return notification.locales[language] || notification.locales[languageCode];
  };

  /**
   * Scans notifications list and prepares them to be used (or removes expired)
   */
  const initNotifications = function () {
    const notificationsKeys = Object.keys(notifications);

    for (let i = 0; i < notificationsKeys.length; i += 1) {
      const notificationKey = notificationsKeys[i];
      const notification = notifications[notificationKey];

      notification.text = getNotificationText(notification);

      const to = new Date(notification.to).getTime();
      const expired = new Date().getTime() > to;

      if (!notification.text || expired) {
        // Remove expired and invalid
        delete notifications[notificationKey];
      }
    }
  };

  // Prepare the notifications
  initNotifications();

  let currentNotification;
  let notificationCheckTime;
  const checkTimeoutMs = 10 * 60 * 1000; // 10 minutes
  const minPeriod = 30 * 60 * 1000; // 30 minutes
  const DELAY = 30 * 1000; // clear notification in 30 seconds
  let timeoutId;

  /**
   * Marks current notification as viewed
   * @param {boolean} withDelay if true, do this after a 30 sec delay
   */
  const setNotificationViewed = function (withDelay) {
    if (withDelay) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setNotificationViewed(false);
      }, DELAY);
      return;
    }

    if (currentNotification) {
      const viewedNotifications =
        purify.localStorage.getItem(VIEWED_NOTIFICATIONS) || [];
      const { id } = currentNotification;
      if (!viewedNotifications.includes(id)) {
        viewedNotifications.push(id);
        purify.localStorage.setItem(VIEWED_NOTIFICATIONS, viewedNotifications);
        currentNotification = null;
      }
    }
  };

  /**
   * Finds out notification for current time and checks if notification wasn't shown yet
   *
   * @param {*} - (optional) frameInfo from `purify.frames`
   * @returns {void|Notification} - notification
   */
  const getCurrentNotification = function (frameInfo) {
    const currentTime = new Date().getTime();
    const timeSinceLastNotification = currentTime - getLastNotificationTime();
    if (timeSinceLastNotification < minPeriod) {
      // Just a check to not show the notification too often
      return null;
    }

    // Check not often than once in 10 minutes
    const timeSinceLastCheck = currentTime - notificationCheckTime;
    if (notificationCheckTime > 0 && timeSinceLastCheck <= checkTimeoutMs) {
      return currentNotification;
    }
    // Update the last notification check time
    notificationCheckTime = currentTime;

    const notificationsKeys = Object.keys(notifications);
    const viewedNotifications =
      purify.localStorage.getItem(VIEWED_NOTIFICATIONS) || [];

    for (let i = 0; i < notificationsKeys.length; i += 1) {
      const notificationKey = notificationsKeys[i];
      const notification = notifications[notificationKey];
      const from = new Date(notification.from).getTime();
      const to = new Date(notification.to).getTime();
      if (
        from < currentTime &&
        to > currentTime &&
        !viewedNotifications.includes(notification.id)
      ) {
        currentNotification = notification;
        return currentNotification;
      }
    }
    currentNotification = null;
    return currentNotification;
  };

  return {
    getCurrentNotification,
    setNotificationViewed,
  };
})(purify);
