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
    const stack = parent.querySelector(".tabstack");

    const containerMain = parent.querySelector(".tab-main");

    while (containerMain.firstChild) {
      containerMain.removeChild(containerMain.firstChild);
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
    // this.filteringHeader = this._getTemplate("filtering-header-template");
    this.filteringDefaultHeader = this._getTemplate(
      "filtering-default-header-template"
    );

    // Controls
    this.filteringControlDefault = this._getTemplate(
      "filtering-default-control-template"
    );

    // Actions
    // this.actionOpenAbuse = this._getTemplate("action-open-abuse-template");
    // this.actionOpenLogin = this._getTemplate("action-open-login-template");
    // this.actionOpenUserInfo = this._getTemplate("action-open-user-info-template");
    // this.actionOpenSiteReport = this._getTemplate(
    //   "action-site-report-template"
    // );

    // Status Text
    this.filteringStatusText = this._getTemplate("filtering-status-template");

    // Message text
    this.filteringMessageText = this._getTemplate("filtering-message-template");

    this._renderMain(containerMain, tabInfo);
    this._renderFilteringControls(containerMain);
  },

  _getTemplate(id) {
    return document.querySelector(`#${id}`).cloneNode(true);
  },

  _appendTemplate(container, template) {
    [].slice.call(template.childNodes).forEach((c) => {
      container.appendChild(c.cloneNode(true));
    });
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
    // this._bindAction(parent, ".siteReport", "click", (e) => {
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

    // this._bindAction(parent, ".openLink", "click", (e) => {
    //   e.preventDefault();
    //   self.openLink(e.currentTarget.href);
    //   popupPage.closePopup();
    // });

    // this._bindAction(parent, ".openAbuse", "click", (e) => {
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

    function changeProtectionState(disabled) {
      const { tabInfo } = self;
      if (tabInfo.applicationFilteringDisabled === disabled) {
        return;
      }
      self.changeApplicationFilteringDisabled(disabled);
      tabInfo.applicationFilteringDisabled = disabled;
      tabInfo.totalBlockedTab = 0;
      self._renderPopup(tabInfo);
      self._bindActions();
      self.resizePopupWindow();
    }

    // Disable filtering
    const changeProtectionStateDisableButtons = [].slice.call(
      document.querySelectorAll(".changeProtectionStateDisable")
    );
    changeProtectionStateDisableButtons.forEach((button) => {
      button.addEventListener("click", (e) => {
        e.preventDefault();
        changeProtectionState(true);
      });
    });

    // Enable filtering
    const changeProtectionStateEnableButtons = [].slice.call(
      document.querySelectorAll(".changeProtectionStateEnable")
    );
    changeProtectionStateEnableButtons.forEach((button) => {
      button.addEventListener("click", (e) => {
        e.preventDefault();
        changeProtectionState(false);
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
