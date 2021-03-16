/**
 * ----------------------------------------------------------------------------------
 * PurifyBrowserExtension popup-controller.js
 * Licensed under MIT (https://github.com/CyberPurify/CyberPurify/blob/main/LICENSE)
 * ----------------------------------------------------------------------------------
 */

/* global i18n, popupPage */

/**
 * Controller that manages add-on popup window
 */
const PopupController = function () {};

PopupController.prototype = {
  /**
   * Renders popup using specified model object
   * @param tabInfo
   * @param options
   */
  render(tabInfo, options) {
    this.tabInfo = tabInfo;
    this.options = options || {};

    // render
    this._renderPopup(tabInfo);

    this._bindActions();

    this.afterRender();
  },

  resizePopupWindow() {
    const widget = document.querySelector("#widget-popup");
    const width = widget.offsetWidth;
    const height = widget.offsetHeight;

    popupPage.resizePopup(width, height);
  },

  afterRender() {
    // Should be overwritten
  },

  addWhiteListDomain(url) {
    popupPage.sendMessage({ type: "addWhiteListDomainPopup", url });
  },

  removeWhiteListDomain(url) {
    popupPage.sendMessage({ type: "removeWhiteListDomainPopup", url });
  },

  changeApplicationFilteringDisabled(disabled) {
    popupPage.sendMessage({
      type: "changeApplicationFilteringDisabled",
      disabled,
    });
  },

  sendFeedback(url, topic, comment) {
    popupPage.sendMessage({
      type: "sendFeedback",
      url,
      topic,
      comment,
    });
  },

  // openSiteReportTab(url) {
  //   popupPage.sendMessage({ type: "openSiteReportTab", url });
  // },

  openLoginTab() {
    popupPage.sendMessage({ type: "openLoginTab" });
  },

  openAbuseTab(url) {
    popupPage.sendMessage({ type: "openAbuseTab", url });
  },

  openSettingsTab() {
    popupPage.sendMessage({ type: "openSettingsTab" });
  },

  openLink(url) {
    popupPage.sendMessage({ type: "openTab", url });
  },

  updateTotalBlocked(tabInfo) {
    this.tabInfo = tabInfo;
    const { totalBlockedTab, totalBlocked } = tabInfo;
    if (totalBlockedTab) {
      const tabBlocked = document.querySelector("#widget-popup .blocked-tab");
      if (tabBlocked) {
        i18n.translateElement(tabBlocked, "popup_tab_blocked", [
          this._formatNumber(totalBlockedTab),
        ]);
      }
    }

    if (totalBlocked) {
      const allBlocked = document.querySelector("#widget-popup .blocked-all");
      if (allBlocked) {
        i18n.translateElement(allBlocked, "popup_tab_blocked_all", [
          this._formatNumber(totalBlocked),
        ]);
      }
    }
  },

  _renderUserInfo(name) {
    const blockUserText = document.querySelector("#showUserInfo .act-name");

    blockUserText.style = "font-weight:bold;";
    blockUserText.innerHTML = name;
  },

  _renderPopup(tabInfo) {
    const parent = document.querySelector("#widget-popup");
    const switcher = document.querySelector(
      "#filtering-default-control-template > div.control-buttons"
    );
    const containerHeader = document.querySelector(".widget-popup__header");
    while (containerHeader.firstChild) {
      containerHeader.removeChild(containerHeader.firstChild);
    }

    const footerContainer = parent.querySelector(".footer");
    while (footerContainer.firstChild) {
      footerContainer.removeChild(footerContainer.firstChild);
    }

    const stack = parent.querySelector(".tabstack");

    const containerMain = parent.querySelector(".tab-main");

    while (containerMain.firstChild) {
      containerMain.removeChild(containerMain.firstChild);
    }

    const containerBottom = parent.querySelector(".tabstack-bottom.tab-main");

    while (containerBottom.firstChild) {
      containerBottom.removeChild(containerBottom.firstChild);
    }

    stack.setAttribute("class", "tabstack");
    parent.setAttribute("class", "widget-popup");

    // define class
    if (tabInfo.applicationFilteringDisabled) {
      stack.classList.add("status-paused");
      parent.classList.add("status-paused");
      switcher.setAttribute("aria-checked", "false");
    } else if (!tabInfo.applicationAvailable) {
      stack.classList.add("status-inner");
      parent.classList.add("status-checkmark");
      switcher.setAttribute("aria-hidden", "true");
    } else if (!tabInfo.canAddRemoveRule) {
      stack.classList.add("status-error");
      parent.classList.add("status-checkmark");
    } else if (tabInfo.documentWhiteListed) {
      stack.classList.add("status-cross");
      parent.classList.add("status-cross");
      switcher.setAttribute("aria-checked", "false");
    } else {
      stack.classList.add("status-checkmark");
      parent.classList.add("status-checkmark");
      switcher.setAttribute("aria-checked", "true");
    }

    // Header
    this.filteringHeader = this._getTemplate("filtering-header-template");
    this.filteringDefaultHeader = this._getTemplate(
      "filtering-default-header-template"
    );

    // Controls
    this.filteringControlDefault = this._getTemplate(
      "filtering-default-control-template"
    );

    // Actions
    // this.actionOpenAbuse = this._getTemplate("action-open-abuse-template");
    this.actionOpenLogin = this._getTemplate("action-open-login-template");
    this.showUserInfo = this._getTemplate("show-user-info");
    // this.actionOpenSiteReport = this._getTemplate(
    //   "action-site-report-template"
    // );

    // Status Text
    this.filteringStatusText = this._getTemplate("filtering-status-template");

    // Message text
    this.filteringMessageText = this._getTemplate("filtering-message-template");

    // Footer
    this.footerDefault = this._getTemplate("footer-default-template");

    // Notification
    // this.notification = this._getTemplate("notification-template");
    // this.animatedNotification = this._getTemplate(
    //   "animated-notification-template"
    // );

    this._renderActions(containerBottom, tabInfo);
    this._renderHeader(containerHeader, tabInfo);
    // this._renderNotificationBlock(stack, tabInfo, this.options);
    this._renderMain(containerMain, tabInfo);
    this._renderFilteringControls(containerMain);
    // this._renderStatus(containerMain, tabInfo);
    // this._renderMessage(containerMain, tabInfo);
    this._renderFooter(footerContainer, tabInfo, this.options);
    // this._renderAnimatedNotification(parent, tabInfo, this.options);
  },

  _getTemplate(id) {
    return document.querySelector(`#${id}`).cloneNode(true);
  },

  _appendTemplate(container, template) {
    [].slice.call(template.childNodes).forEach((c) => {
      container.appendChild(c.cloneNode(true));
    });
  },

  _renderHeader(container) {
    const template = this.filteringHeader;
    this._appendTemplate(container, template);
  },

  _renderAnimatedNotification(container, tabInfo, options) {
    const { notification } = options;
    // Do not show
    if (!notification) {
      return;
    }

    // Do not show notification if the type is not animated or there is no text
    if (notification.type !== "animated" || !notification.text) {
      return;
    }

    const title = this.animatedNotification.querySelector(
      ".holiday-notify__title"
    );
    const button = this.animatedNotification.querySelector(
      ".holiday-notify__btn"
    );
    title.innerText = notification.text.title;
    button.innerText = notification.text.btn;

    this._appendTemplate(container, this.animatedNotification);

    // Schedule notification removal
    popupPage.sendMessage({ type: "setNotificationViewed", withDelay: true });
  },

  _renderNotificationBlock(container, tabInfo, options) {
    const { notification } = options;
    // Do not show notification
    if (!notification) {
      return;
    }

    if (notification.type !== "simple") {
      return;
    }

    const { bgColor, textColor, text } = notification;

    if (!text) {
      return;
    }

    const notificationTitleNode = this.notification.querySelector(
      ".openNotificationLink"
    );
    notificationTitleNode.innerHTML = text;
    if (bgColor && textColor) {
      const notification = this.notification.querySelector(".notice");
      notification.setAttribute(
        "style",
        `background-color: ${bgColor}; color: ${textColor}`
      );
    }
    this._appendTemplate(container, this.notification);

    // Schedule notification removal
    popupPage.sendMessage({ type: "setNotificationViewed", withDelay: true });
  },

  _renderMain(container, tabInfo) {
    const template = this.filteringDefaultHeader;
    const tabBlocked = template.querySelector(".blocked-tab");
    const totalBlocked = template.querySelector(".blocked-all");
    i18n.translateElement(tabBlocked, "popup_tab_blocked", [
      this._formatNumber(tabInfo.totalBlockedTab || 0),
    ]);
    i18n.translateElement(totalBlocked, "popup_tab_blocked_all", [
      this._formatNumber(tabInfo.totalBlocked || 0),
    ]);
    const closestWidgetFilter = tabBlocked.closest(".widget-popup-filter");
    if (closestWidgetFilter) {
      if (tabInfo.totalBlocked >= 10000000) {
        closestWidgetFilter.classList.add("db");
      } else {
        closestWidgetFilter.classList.remove("db");
      }
    }

    this._appendTemplate(container, template);
  },

  _renderFilteringControls(container) {
    const template = this.filteringControlDefault;
    this._appendTemplate(container, template);
  },

  _renderStatus(container, tabInfo) {
    const template = this.filteringStatusText;

    let messageKey = "";
    if (!tabInfo.applicationAvailable) {
      messageKey = "popup_site_filtering_state_secure_page";
    } else if (tabInfo.documentWhiteListed && !tabInfo.userWhiteListed) {
      messageKey = "";
    } else if (tabInfo.applicationFilteringDisabled) {
      messageKey = "popup_site_filtering_state_paused";
    } else if (tabInfo.documentWhiteListed) {
      messageKey = "popup_site_filtering_state_disabled";
    } else {
      messageKey = "popup_site_filtering_state_enabled";
    }

    const statusElement = template.querySelector(".status");
    if (messageKey) {
      i18n.translateElement(statusElement, messageKey);
    } else {
      statusElement.classList.add("status--hide");
    }

    const currentSiteElement = template.querySelector(".current-site");
    if (tabInfo.applicationAvailable) {
      currentSiteElement.textContent = tabInfo.domainName
        ? tabInfo.domainName
        : tabInfo.url;
    } else {
      currentSiteElement.textContent = tabInfo.url;
    }

    this._appendTemplate(container, template);
  },

  _renderMessage(container, tabInfo) {
    let messageKey;
    if (!tabInfo.applicationAvailable) {
      messageKey = "";
    } else if (tabInfo.documentWhiteListed && !tabInfo.userWhiteListed) {
      messageKey = "popup_site_exception_info";
    }

    const template = this.filteringMessageText;
    if (messageKey) {
      i18n.translateElement(template.childNodes[1], messageKey);
      this._appendTemplate(container, template);
    }
  },

  _selectRequestTypesStatsData(stats, range) {
    let result = {};

    switch (range) {
      case "day":
        result = stats.lastMonth[stats.lastMonth.length - 1];
        break;
      case "week":
        for (var i = 0; i < stats.lastWeek.length; i++) {
          var d = stats.lastWeek[i];
          for (var type in d) {
            if (d[type]) {
              result[type] = (result[type] ? result[type] : 0) + d[type];
            }
          }
        }
        break;
      case "month":
        result = stats.lastYear[stats.lastYear.length - 1];
        break;
      case "year":
        for (var i = 0; i < stats.lastYear.length; i++) {
          var d = stats.lastYear[i];
          for (var type in d) {
            if (d[type]) {
              result[type] = (result[type] ? result[type] : 0) + d[type];
            }
          }
        }
        break;
      default:
        break;
    }

    return result;
  },

  _selectRequestsStatsData(stats, range, type) {
    const result = [];
    switch (range) {
      case "day":
        stats.today.forEach((d) => {
          result.push(d[type]);
        });
        break;
      case "week":
        stats.lastWeek.forEach((d) => {
          result.push(d[type]);
        });
        break;
      case "month":
        stats.lastMonth.forEach((d) => {
          result.push(d[type]);
        });
        break;
      case "year":
        stats.lastYear.forEach((d) => {
          result.push(d[type]);
        });
        break;
      default:
        break;
    }
    return result.map((val) => (val === undefined ? 0 : val));
  },

  DAYS_OF_WEEK: (function () {
    return (
      this.DAYS_OF_WEEK || [
        i18n.getMessage("popup_statistics_week_days_mon"),
        i18n.getMessage("popup_statistics_week_days_tue"),
        i18n.getMessage("popup_statistics_week_days_wed"),
        i18n.getMessage("popup_statistics_week_days_thu"),
        i18n.getMessage("popup_statistics_week_days_fri"),
        i18n.getMessage("popup_statistics_week_days_sat"),
        i18n.getMessage("popup_statistics_week_days_sun"),
      ]
    );
  })(),

  _dayOfWeekAsString(dayIndex) {
    return this.DAYS_OF_WEEK[dayIndex];
  },

  MONTHS_OF_YEAR: (function () {
    return (
      this.MONTHS_OF_YEAR || [
        i18n.getMessage("popup_statistics_months_jan"),
        i18n.getMessage("popup_statistics_months_feb"),
        i18n.getMessage("popup_statistics_months_mar"),
        i18n.getMessage("popup_statistics_months_apr"),
        i18n.getMessage("popup_statistics_months_may"),
        i18n.getMessage("popup_statistics_months_jun"),
        i18n.getMessage("popup_statistics_months_jul"),
        i18n.getMessage("popup_statistics_months_aug"),
        i18n.getMessage("popup_statistics_months_sep"),
        i18n.getMessage("popup_statistics_months_oct"),
        i18n.getMessage("popup_statistics_months_nov"),
        i18n.getMessage("popup_statistics_months_dec"),
      ]
    );
  })(),

  _monthsAsString(monthIndex) {
    return this.MONTHS_OF_YEAR[monthIndex];
  },

  _getCategoriesLines(statsData, range) {
    const now = new Date();
    const day = now.getDay();
    const month = now.getMonth();
    const lastDayOfPrevMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      0
    ).getDate();

    let categories = [];
    const lines = [];
    switch (range) {
      case "day":
        for (let i = 1; i < 25; i += 1) {
          if (i % 3 === 0) {
            const hour = (i + now.getHours()) % 24;
            categories.push(hour.toString());
            lines.push({
              value: i - 1,
            });
          } else {
            categories.push("");
          }
        }

        break;
      case "week":
        for (let i = 0; i < 7; i += 1) {
          categories.push(this._dayOfWeekAsString((day + i) % 7));
          lines.push({
            value: i,
          });
        }

        break;
      case "month":
        for (let i = 0; i < 31; i += 1) {
          if (i % 3 === 0) {
            const c = ((i + now.getDate()) % lastDayOfPrevMonth) + 1;
            categories.push(c.toString());
            lines.push({
              value: i,
            });
          } else {
            categories.push("");
          }
        }

        break;
      case "year":
        for (let i = 0; i < 13; i += 1) {
          categories.push(this._monthsAsString((month + i) % 12));
          categories = categories.slice(-statsData.length);
          lines.push({
            value: i,
          });
        }

        break;
    }

    return {
      categories,
      lines,
    };
  },

  _renderRequestsGraphs(stats, range, type) {},

  _renderBlockedGroups(container, stats) {
    const TOTAL_GROUP_ID = "total";

    const timeRange = document.querySelector(".statistics-select-time").value;
    const typeSelector = container.querySelector(".statistics-select-type");

    const statsData = this._selectRequestTypesStatsData(stats, timeRange);

    const getSelectTemplate = (group) =>
      `<option value="${group.groupId}">${group.groupName}</option>`;

    const blockedGroups = stats.blockedGroups.filter(
      (group) => statsData[group.groupId]
    );

    if (blockedGroups.length === 0) {
      const [totalBlockedGroup] = stats.blockedGroups.filter(
        ({ groupId }) => groupId === TOTAL_GROUP_ID
      );

      typeSelector.insertAdjacentHTML(
        "beforeend",
        getSelectTemplate(totalBlockedGroup)
      );
      return;
    }

    blockedGroups.forEach((group) => {
      typeSelector.insertAdjacentHTML("beforeend", getSelectTemplate(group));
    });
  },

  _renderActions(container, tabInfo) {
    const el = document.createElement("div");
    el.classList.add("actions");

    this._appendTemplate(el, this.actionOpenLogin);
    this._appendTemplate(el, this.showUserInfo);
    // this._appendTemplate(el, this.actionOpenAbuse);
    // this._appendTemplate(el, this.actionOpenSiteReport);

    if (!tabInfo.applicationAvailable) {
      const disabledActionsSelectors = [
        // "#siteReport",
        "#openLogin",
        // "#openAbuse",
      ];
      disabledActionsSelectors.forEach((selector) => {
        const action = el.querySelector(selector);
        action.classList.add("action_disabled");
        action.setAttribute("aria-hidden", "true");
      });
    }

    container.appendChild(el);
  },

  _renderFooter(footerContainer, tabInfo, options) {
    const { footerDefault } = this;
    const popupFooter = footerDefault.querySelector(".popup-footer");
    // There is no footer title for edge
    const footerDefaultTitle = footerDefault.querySelector(".footer__title");
    if (popupFooter && footerDefaultTitle) {
      if (options.isEdgeBrowser) {
        popupFooter.innerHTML = `<div class="popup-footer--edge">© 2020-${new Date().getFullYear()} CyberPurify Software Ltd</div>`;
        // hide mobile app icons - https://github.com/CyberPurify/PurifyBrowserExtension/issues/1543
        const platforms = footerDefault.querySelector(".platforms");
        if (platforms) {
          platforms.style.display = "none";
        }
      } else {
        footerDefaultTitle.setAttribute(
          "title",
          i18n.getMessage("popup_purify_footer_title")
        );
      }
    }

    this._appendTemplate(footerContainer, footerDefault);
  },

  _bindAction(parentElement, selector, eventName, handler) {
    let elements = [].slice.call(parentElement.querySelectorAll(selector));
    console.log(elements, selector, parentElement);
    if (!elements || elements.length <= 0) {
      return;
    }
    elements.forEach((element) => element.addEventListener(eventName, handler));
  },

  _bindActions() {
    const parent = document.querySelector("#widget-popup");

    const self = this;
    // this._bindAction(parent, "#siteReport", "click", (e) => {
    //   e.preventDefault();
    //   if (!self.tabInfo.applicationAvailable) {
    //     return;
    //   }
    //   self.openSiteReportTab(self.tabInfo.url);
    //   popupPage.closePopup();
    // });

    this._bindAction(parent, ".openSettings", "click", (e) => {
      e.preventDefault();
      self.openSettingsTab();
      popupPage.closePopup();
    });

    // this._bindAction(parent, ".openNotificationLink", "click", (e) => {
    //   e.preventDefault();
    //   const { url } = self.options.notification;
    //   if (url) {
    //     self.openLink(url);
    //     popupPage.sendMessage({
    //       type: "setNotificationViewed",
    //       withDelay: false,
    //     });
    //     popupPage.closePopup();
    //   }
    // });

    // this._bindAction(parent, ".closeNotification", "click", (e) => {
    //   e.preventDefault();
    //   const notification = parent.querySelector("#popup-notification");
    //   if (notification) {
    //     notification.style.display = "none";
    //     popupPage.sendMessage({
    //       type: "setNotificationViewed",
    //       withDelay: false,
    //     });
    //   }
    // });

    // this._bindAction(parent, ".holiday-notify__btn", "click", (e) => {
    //   e.preventDefault();
    //   const { url } = self.options.notification;
    //   if (url) {
    //     self.openLink(url);
    //     popupPage.sendMessage({
    //       type: "setNotificationViewed",
    //       withDelay: false,
    //     });
    //     popupPage.closePopup();
    //   }
    // });

    // this._bindAction(parent, ".holiday-notify__close", "click", (e) => {
    //   e.preventDefault();
    //   const notification = parent.querySelector(".holiday-notify");
    //   if (notification) {
    //     notification.classList.add("holiday-notify--close");
    //     popupPage.sendMessage({
    //       type: "setNotificationViewed",
    //       withDelay: false,
    //     });
    //   }
    // });

    // this._bindAction(parent, ".openLink", "click", (e) => {
    //   e.preventDefault();
    //   self.openLink(e.currentTarget.href);
    //   popupPage.closePopup();
    // });

    // this._bindAction(parent, "#openAbuse", "click", (e) => {
    //   e.preventDefault();
    //   if (!self.tabInfo.applicationAvailable) {
    //     return;
    //   }
    //   self.openAbuseTab(self.tabInfo.url);
    //   popupPage.closePopup();
    // });

    // checkbox
    this._bindAction(parent, ".changeDocumentWhiteListed", "click", (e) => {
      e.preventDefault();
      const { tabInfo } = self;
      if (
        !tabInfo.applicationAvailable ||
        tabInfo.applicationFilteringDisabled
      ) {
        return;
      }
      if (!tabInfo.canAddRemoveRule) {
        return;
      }
      let isWhiteListed = tabInfo.documentWhiteListed;
      if (isWhiteListed) {
        self.removeWhiteListDomain(tabInfo.url);
        isWhiteListed = false;
      } else {
        self.addWhiteListDomain(tabInfo.url);
        isWhiteListed = true;
      }
      tabInfo.documentWhiteListed = isWhiteListed;
      tabInfo.userWhiteListed = isWhiteListed;
      tabInfo.totalBlockedTab = 0;
      self._renderPopup(tabInfo);
      self._bindActions();
      self.resizePopupWindow();
    });

    this._bindAction(parent, "#openLogin", "click", (e) => {
      e.preventDefault();
      if (!self.tabInfo.applicationAvailable) {
        return;
      }
      self.openLoginTab();
      popupPage.closePopup();
    });

    popupPage.sendMessage({ type: "getUserInfo" }, (message) => {
      const openLogin = document.querySelector("#openLogin");
      const showUserInfo = document.querySelector("#showUserInfo");

      if (message.name) {
        openLogin.style.display = "none";
        showUserInfo.style.display = "flex";
      } else {
        openLogin.style.display = "flex";
        showUserInfo.style.display = "none";
      }
    });

    // function changeProtectionState(disabled) {
    //   const { tabInfo } = self;
    //   if (tabInfo.applicationFilteringDisabled === disabled) {
    //     return;
    //   }
    //   self.changeApplicationFilteringDisabled(disabled);
    //   tabInfo.applicationFilteringDisabled = disabled;
    //   tabInfo.totalBlockedTab = 0;
    //   self._renderPopup(tabInfo);
    //   self._bindActions();
    //   self.resizePopupWindow();
    // }

    // Disable filtering
    // const changeProtectionStateDisableButtons = [].slice.call(
    //   document.querySelectorAll(".changeProtectionStateDisable")
    // );
    // changeProtectionStateDisableButtons.forEach((button) => {
    //   button.addEventListener("click", (e) => {
    //     e.preventDefault();
    //     changeProtectionState(true);
    //   });
    // });

    // Enable filtering
    // const changeProtectionStateEnableButtons = [].slice.call(
    //   document.querySelectorAll(".changeProtectionStateEnable")
    // );
    // changeProtectionStateEnableButtons.forEach((button) => {
    //   button.addEventListener("click", (e) => {
    //     e.preventDefault();
    //     changeProtectionState(false);
    //   });
    // });

    // Tabs
    [].slice.call(parent.querySelectorAll(".tabbar .tab")).forEach((t) => {
      t.addEventListener("click", (e) => {
        e.preventDefault();

        [].slice
          .call(parent.querySelectorAll(".tabbar .tab"))
          .forEach((tab) => {
            tab.classList.remove("active");
          });
        e.target.classList.add("active");

        const attr = e.target.getAttribute("tab-switch");
        [].slice
          .call(parent.querySelectorAll(".tab-switch-tab"))
          .forEach((tab) => {
            tab.style.display = "none";
          });
        [].slice
          .call(
            parent.querySelectorAll(`.tab-switch-tab[tab-switch="${attr}"]`)
          )
          .forEach((tab) => {
            tab.style.display = "flex";
          });
      });
    });
  },

  /**
   * Formats number to the language-sensitive representation
   * @param {number} number
   * @returns {string}
   * @private
   */
  _formatNumber(number) {
    return number.toLocaleString();
  },
};

(function () {
  /**
   * TODO: check the following EDGE issue
   * https://github.com/CyberPurify/PurifyBrowserExtension/issues/551
   * MS Edge unexpectedly crashes on opening the popup.
   * We do not quite understand the reason for this behavior,
   * but we assume it happens due to code flow execution and changing the DOM.
   * setTimeout allows us to resolve this "race condition".
   */

  const controller = new PopupController();
  controller.afterRender = function () {
    // Add some delay for show popup size properly
    // https://github.com/CyberPurify/PurifyBrowserExtension/issues/505
    const timeout = 10;
    setTimeout(() => {
      controller.resizePopupWindow();

      popupPage.sendMessage({ type: "getUserInfo" }, (message) => {
        if (message.name) {
          controller._renderUserInfo(message.name);
        }
      });
    }, timeout);
  };

  document.addEventListener("resizePopup", () => {
    controller.resizePopupWindow();
  });

  popupPage.sendMessage({ type: "getTabInfoForPopup" }, (message) => {
    const onDocumentReady = () => {
      controller.render(message.frameInfo, message.options);
    };

    if (
      document.attachEvent
        ? document.readyState === "complete"
        : document.readyState !== "loading"
    ) {
      onDocumentReady();
    } else {
      document.addEventListener("DOMContentLoaded", onDocumentReady);
    }
  });

  popupPage.onMessage.addListener((message) => {
    switch (message.type) {
      case "updateTotalBlocked": {
        const { tabInfo } = message;
        controller.updateTotalBlocked(tabInfo);
        break;
      }
      default:
        break;
    }
  });
})();
