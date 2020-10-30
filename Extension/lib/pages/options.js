/**
 * ----------------------------------------------------------------------------------
 * PurifyBrowserExtension options.js
 * Licensed under MIT (https://github.com/CyberPurify/CyberPurify/blob/main/LICENSE)
 * ----------------------------------------------------------------------------------
 */

/* global contentPage, i18n, moment, ace, CheckboxUtils */

// Update default date format for zh-cn
// https://github.com/CyberPurify/PurifyBrowserExtension/issues/1442
moment.updateLocale("zh-cn", {
  longDateFormat: {
    LLL: "YYYY年M月D日 HH:mm",
  },
});

const Utils = {
  debounce(func, wait) {
    let timeout;
    return function () {
      const context = this;
      const args = arguments;
      const later = function () {
        timeout = null;
        func.apply(context, args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  escapeRegExp: (function () {
    const matchOperatorsRe = /[|\\{}()[\]^$+*?.]/g;
    return function (str) {
      if (typeof str !== "string") {
        throw new TypeError("Expected a string");
      }
      return str.replace(matchOperatorsRe, "\\$&");
    };
  })(),

  getExtension: function getExtension(filename) {
    if (!filename) {
      return undefined;
    }
    const parts = filename.split(".");
    if (parts.length < 2) {
      return undefined;
    }
    return parts[parts.length - 1];
  },

  hoursToMs(hours) {
    return hours * 60 * 60 * 1000;
  },

  showPopup(title, text) {
    contentPage.sendMessage({
      type: "showAlertMessagePopup",
      title,
      text,
    });
  },

  escapeDoubleQuotes(string) {
    return string.replace(/"/g, "&quot;");
  },
};

const TopMenu = (function () {
  "use strict";

  const ANTIBANNER = "#antibanner";
  const WHITELIST = "#whitelist";

  let prevTabId;
  let onHashUpdatedCallback;

  const toggleTab = function () {
    let tabId = document.location.hash || ANTIBANNER;
    let tab;
    try {
      tab = document.querySelector(tabId);
    } catch (e) {
      // If hash is not valid selector
      tabId = ANTIBANNER;
      tab = document.querySelector(ANTIBANNER);
    }

    if (tabId.indexOf(ANTIBANNER) === 0 && !tab) {
      // AntiBanner groups and filters are loaded and rendered async
      return;
    }

    if (!tab) {
      tabId = ANTIBANNER;
      tab = document.querySelector(tabId);
    }

    const antibannerTabs = [].slice.call(
      document.querySelectorAll(`[data-tab="${ANTIBANNER}"]`)
    );

    if (prevTabId) {
      if (prevTabId.indexOf(ANTIBANNER) === 0) {
        antibannerTabs.forEach((el) => {
          el.classList.remove("active");
        });
      } else {
        document
          .querySelector(`[data-tab="${prevTabId}"]`)
          .classList.remove("active");
      }

      try {
        document.querySelector(prevTabId).style.display = "none";
      } catch (e) {
        return;
      }
    }

    if (tabId.indexOf(ANTIBANNER) === 0) {
      antibannerTabs.forEach((el) => {
        el.classList.add("active");
      });
    } else {
      document.querySelector(`[data-tab="${tabId}"]`).classList.add("active");
    }

    tab.style.display = "block";

    if (tabId === WHITELIST) {
      if (typeof onHashUpdatedCallback === "function") {
        onHashUpdatedCallback(tabId);
      }
    }

    // Scroll to the top on every tab switch
    window.scrollTo(0, 0);
    prevTabId = tabId;
  };

  const init = function (options) {
    onHashUpdatedCallback = options.onHashUpdated;

    window.addEventListener("hashchange", toggleTab);
    [].slice.call(document.querySelectorAll("[data-tab]")).forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        document.location.hash = el.getAttribute("data-tab");
      });
    });

    toggleTab();
  };

  return {
    init,
    toggleTab,
  };
})();

const Saver = function (options) {
  this.indicatorElement = options.indicatorElement;
  this.editor = options.editor;
  this.saveEventType = options.saveEventType;

  const states = {
    CLEAR: 1 << 0,
    DIRTY: 1 << 1,
    SAVING: 1 << 2,
    SAVED: 1 << 3,
  };

  const indicatorText = {
    [states.CLEAR]: "",
    [states.DIRTY]: i18n.getMessage("options_editor_indicator_editing"),
    [states.SAVING]: i18n.getMessage("options_editor_indicator_saving"),
    [states.SAVED]: i18n.getMessage("options_editor_indicator_saved"),
  };

  this.isSaving = function () {
    return (this.currentState & states.SAVING) === states.SAVING;
  };

  this.isDirty = function () {
    return (this.currentState & states.DIRTY) === states.DIRTY;
  };

  this.isSaved = function () {
    return (this.currentState & states.SAVED) === states.SAVED;
  };

  this.updateIndicator = function (state) {
    this.indicatorElement.textContent = indicatorText[state];
    switch (state) {
      case states.DIRTY:
      case states.CLEAR:
      case states.SAVING:
        this.indicatorElement.classList.remove("filter-rules__label--saved");
        break;
      case states.SAVED:
        this.indicatorElement.classList.add("filter-rules__label--saved");
        break;
      default:
        break;
    }
  };

  let timeout;

  const setState = (state, skipManageState = false) => {
    switch (state) {
      case states.DIRTY:
        this.currentState &= ~states.CLEAR;
        break;
      case states.CLEAR:
        this.currentState &= ~states.DIRTY;
        this.currentState &= ~states.SAVED;
        break;
      case states.SAVING:
        this.currentState &= ~states.SAVED;
        break;
      case states.SAVED:
        // transition to SAVED is possible only after SAVING
        if ((this.currentState & states.SAVING) !== states.SAVING) {
          return;
        }
        this.currentState &= ~states.SAVING;
        break;
      default:
        break;
    }

    this.currentState |= state;

    if (!skipManageState) {
      this.manageState();
    }
  };

  this.manageState = function () {
    const EDIT_TIMEOUT_MS = 1000;
    const HIDE_INDICATOR_TIMEOUT_MS = 1500;

    if (timeout) {
      clearTimeout(timeout);
    }

    const self = this;

    const isDirty = this.isDirty();
    const isSaving = this.isSaving();

    if (isDirty && !isSaving) {
      this.updateIndicator(states.DIRTY);
      timeout = setTimeout(() => {
        self.saveRules();
        setState(states.CLEAR, true);
        setState(states.SAVING);
      }, EDIT_TIMEOUT_MS);
      return;
    }

    if (isDirty && isSaving) {
      this.updateIndicator(states.DIRTY);
      timeout = setTimeout(() => {
        setState(states.CLEAR);
        self.saveRules();
      }, EDIT_TIMEOUT_MS);
      return;
    }

    if (!isDirty && !isSaving) {
      this.updateIndicator(states.SAVED);
      if (!this.isSaved()) {
        return;
      }
      timeout = setTimeout(() => {
        setState(states.CLEAR);
        self.updateIndicator(states.CLEAR);
      }, HIDE_INDICATOR_TIMEOUT_MS);
      return;
    }

    if (!isDirty && isSaving) {
      this.updateIndicator(states.SAVING);
    }
  };

  this.saveRules = function () {
    const text = this.editor.getValue();
    contentPage.sendMessage(
      {
        type: this.saveEventType,
        content: text,
      },
      () => {}
    );
  };

  const setDirty = () => {
    setState(states.DIRTY);
  };

  const setSaved = () => {
    setState(states.SAVED);
  };

  const canUpdate = () =>
    !(this.isSaved() || this.isSaving() || this.isDirty());

  return {
    canUpdate,
    setDirty,
    setSaved,
  };
};

/**
 * Function changes editor size while user resizes editor parent node
 * @param editor
 * @param {String} editorId
 */
const handleEditorResize = (editor, editorId) => {
  const DRAG_TIMEOUT_MS = 100;
  const editorParent = editor.container.parentNode;

  const saveSize = (editorParent) => {
    const { width } = editorParent.style;
    const { height } = editorParent.style;
    if (width && height) {
      localStorage.setItem(
        editorId,
        JSON.stringify({ size: { width, height } })
      );
    }
  };

  const restoreSize = (editorParent) => {
    const dataJson = localStorage.getItem(editorId);
    if (!dataJson) {
      return;
    }
    const { size } = JSON.parse(dataJson);
    const { width, height } = size || {};
    if (width && height) {
      editorParent.style.width = width;
      editorParent.style.height = height;
    }
  };

  // restore size is it was set previously set;
  restoreSize(editorParent);

  const onMouseMove = Utils.debounce(() => {
    editor.resize();
  }, DRAG_TIMEOUT_MS);

  const onMouseUp = () => {
    saveSize(editorParent);
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  };

  editorParent.addEventListener("mousedown", (e) => {
    if (e.target === e.currentTarget) {
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    }
  });
};

const WhiteListFilter = function (options) {
  "use strict";

  const editorId = "whiteListRules";
  const editor = ace.edit(editorId);
  handleEditorResize(editor, editorId);

  editor.setShowPrintMargin(false);

  editor.$blockScrolling = Infinity;
  const PurifyMode = ace.require("ace/mode/purify").Mode;
  editor.session.setMode(new PurifyMode());

  const saveIndicatorElement = document.querySelector(
    "#whiteListRulesSaveIndicator"
  );
  const saver = new Saver({
    editor,
    saveEventType: "saveWhiteListDomains",
    indicatorElement: saveIndicatorElement,
  });

  const importWhiteListInput = document.querySelector("#importWhiteListInput");
  const changeDefaultWhiteListModeCheckbox = document.querySelector(
    "#changeDefaultWhiteListMode"
  );

  let hasContent = false;
  function loadWhiteListDomains() {
    contentPage.sendMessage(
      {
        type: "getWhiteListDomains",
      },
      (response) => {
        hasContent = !!response.content;
        editor.setValue(response.content || "");
      }
    );
  }

  function updateWhiteListDomains() {
    if (saver.canUpdate()) {
      loadWhiteListDomains();
    }
    saver.setSaved();
  }

  const session = editor.getSession();
  let initialChangeFired = false;
  let whitelistModeToggled = false;
  session.addEventListener("change", (e) => {
    if (!initialChangeFired && hasContent) {
      initialChangeFired = true;
      return;
    }
    // On whitelist mode toggle, editor receives two change events
    // "remove" and "insert", we omit them both and stop omit on the insert e.action
    if (whitelistModeToggled) {
      if (e.action === "insert") {
        whitelistModeToggled = false;
      }
      return;
    }
    saver.setDirty();
  });

  function changeDefaultWhiteListMode(e) {
    e.preventDefault();
    whitelistModeToggled = true;
    contentPage.sendMessage({
      type: "changeDefaultWhiteListMode",
      enabled: !e.currentTarget.checked,
    });
  }

  changeDefaultWhiteListModeCheckbox.addEventListener(
    "change",
    changeDefaultWhiteListMode
  );

  importWhiteListInput.addEventListener("change", (e) => {
    const handleFileInput = Utils.importFromFileIntoEditor(editor);
    try {
      handleFileInput(e);
    } catch (err) {
      Utils.showPopup(
        i18n.getMessage("options_popup_import_rules_error_title"),
        err.message
      );
    }
  });

  CheckboxUtils.updateCheckbox(
    [changeDefaultWhiteListModeCheckbox],
    !options.defaultWhiteListMode
  );

  return {
    updateWhiteListDomains,
  };
};

const UserFilter = function () {
  "use strict";

  const editorId = "userRules";
  const editor = ace.edit(editorId);
  editor.setShowPrintMargin(false);
  handleEditorResize(editor, editorId);

  editor.$blockScrolling = Infinity;
  const PurifyMode = ace.require("ace/mode/purify").Mode;
  editor.session.setMode(new PurifyMode());

  const saveIndicatorElement = document.querySelector(
    "#userRulesSaveIndicator"
  );
  const saver = new Saver({
    editor,
    saveEventType: "saveUserRules",
    indicatorElement: saveIndicatorElement,
  });

  let hasContent = false;
  function loadUserRules() {
    contentPage.sendMessage(
      {
        type: "getUserRules",
      },
      (response) => {
        hasContent = !!response.content;
        if (editor.getValue() !== response.content) {
          editor.setValue(response.content || "");
        }
      }
    );
  }

  const DEFFER_TIMEOUT_MS = 200;
  let timeoutId;
  function updateUserFilterRules() {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    if (saver.canUpdate()) {
      loadUserRules();
    } else {
      timeoutId = setTimeout(() => {
        updateUserFilterRules();
      }, DEFFER_TIMEOUT_MS);
    }
    saver.setSaved();
  }

  const session = editor.getSession();

  let initialChangeFired = false;
  session.addEventListener("change", () => {
    if (!initialChangeFired && hasContent) {
      initialChangeFired = true;
      return;
    }
    saver.setDirty();
  });

  return {
    updateUserFilterRules,
  };
};

const AntiBannerFilters = function (options) {
  "use strict";

  const loadedFiltersInfo = {
    filters: [],
    categories: [],
    filtersById: {},
    categoriesById: {},
    lastUpdateTime: 0,

    initLoadedFilters(filters, categories) {
      this.filters = filters;
      this.categories = categories;

      const categoriesById = Object.create(null);
      for (let i = 0; i < this.categories.length; i += 1) {
        const category = this.categories[i];
        categoriesById[category.groupId] = category;
      }
      this.categoriesById = categoriesById;

      let lastUpdateTime = this.lastUpdateTime || 0;
      const filtersById = Object.create(null);
      for (let i = 0; i < this.filters.length; i++) {
        const filter = this.filters[i];
        filtersById[filter.filterId] = filter;
        if (filter.lastUpdateTime && filter.lastUpdateTime > lastUpdateTime) {
          lastUpdateTime = filter.lastUpdateTime;
        }
      }

      this.filtersById = filtersById;
      this.lastUpdateTime = lastUpdateTime;
    },

    isEnabled(filterId) {
      const info = this.filtersById[filterId];
      return info && info.enabled;
    },

    isCategoryEnabled(categoryId) {
      const category = this.categoriesById[categoryId];
      return category && category.enabled;
    },

    updateCategoryEnabled(category, enabled) {
      const categoryInfo = this.categoriesById[category.groupId];
      if (categoryInfo) {
        categoryInfo.enabled = enabled;
      } else {
        this.categories.push(category);
        this.categoriesById[category.groupId] = category;
      }
    },

    updateEnabled(filter, enabled) {
      const filterInfo = this.filtersById[filter.filterId];
      if (filterInfo) {
        filterInfo.enabled = enabled;
      } else {
        this.filters.push(filter);
        this.filtersById[filter.filterId] = filter;
      }
    },
  };

  // Bind events
  document.addEventListener("change", (e) => {
    if (e.target.getAttribute("name") === "filterId") {
      toggleFilterState.bind(e.target)();
    } else if (e.target.getAttribute("name") === "groupId") {
      toggleGroupState.bind(e.target)();
    }
  });

  document
    .querySelector("#updateAntiBannerFilters")
    .addEventListener("click", updateAntiBannerFilters);

  window.addEventListener("hashchange", handleHashSwitch);

  updateRulesCountInfo(options.rulesInfo);

  function getFiltersByGroupId(groupId, filters) {
    return filters.filter((f) => f.groupId === groupId);
  }

  function countEnabledFilters(filters) {
    let count = 0;
    for (let i = 0; i < filters.length; i++) {
      const { filterId } = filters[i];
      if (loadedFiltersInfo.isEnabled(filterId)) {
        count++;
      }
    }
    return count;
  }

  function getCategoryElement(groupId) {
    return document.querySelector(`#category${groupId}`);
  }

  function getCategoryCheckbox(groupId) {
    const categoryElement = getCategoryElement(groupId);
    if (!categoryElement) {
      return null;
    }

    return categoryElement.querySelector("input");
  }

  function getFilterElements(filterId) {
    return [].slice.call(document.querySelectorAll(`#filter${filterId}`));
  }

  function getFilterCheckboxes(filterId) {
    const filterElements = getFilterElements(filterId);
    if (filterElements.length === 0) {
      return null;
    }
    return filterElements.map((filterElement) =>
      filterElement.querySelector("input")
    );
  }

  function generateFiltersNamesDescription(filters) {
    const namesDisplayCount = 3;
    const enabledFiltersNames = filters
      .filter((filter) => filter.enabled)
      .map((filter) =>
        filter.name && filter.name.length > 0
          ? filter.name
          : filter.subscriptionUrl
      );

    let enabledFiltersNamesString;
    const { length } = enabledFiltersNames;
    if (length > namesDisplayCount) {
      const displayNamesString = enabledFiltersNames
        .slice(0, namesDisplayCount)
        .join(", ");
      enabledFiltersNamesString = i18n.getMessage(
        "options_filters_enabled_and_more_divider",
        [displayNamesString, (length - namesDisplayCount).toString()]
      );
    } else if (length > 1) {
      const lastName = enabledFiltersNames.slice(length - 1)[0];
      const firstNames = enabledFiltersNames.slice(0, length - 1);
      enabledFiltersNamesString = i18n.getMessage(
        "options_filters_enabled_and_divider",
        [firstNames.join(", "), lastName]
      );
    } else if (length === 1) {
      enabledFiltersNamesString = enabledFiltersNames[0];
    }

    enabledFiltersNamesString =
      length > 0
        ? `${i18n.getMessage(
            "options_filters_enabled"
          )} ${enabledFiltersNamesString}`
        : i18n.getMessage("options_filters_no_enabled");
    return enabledFiltersNamesString;
  }

  function updateCategoryFiltersInfo(groupId) {
    const groupFilters = getFiltersByGroupId(
      groupId,
      loadedFiltersInfo.filters
    );
    const filtersNamesDescription = generateFiltersNamesDescription(
      groupFilters
    );
    const groupFiltersCount = groupFilters.length;

    const element = getCategoryElement(groupId);
    const checkbox = getCategoryCheckbox(groupId);

    if (groupFiltersCount > 0) {
      element.querySelector(".desc").textContent = filtersNamesDescription;
    }

    const isCategoryEnabled = loadedFiltersInfo.isCategoryEnabled(groupId);
    CheckboxUtils.updateCheckbox([checkbox], isCategoryEnabled);
  }

  function getFilterCategoryElement(category) {
    return htmlToElement(`
                <li id="category${category.groupId}" class="active">
                    <a href="#antibanner${category.groupId}" class="block-type">
                        <div class="block-type__ico block-type__ico--${category.groupId}"></div>
                        <div id="aria-category${category.groupId}" class="block-type__desc">
                            <div class="block-type__desc-title">${category.groupName}</div>
                            <div class="desc desc--filters"></div>
                        </div>
                    </a>
                    <div class="opt-state">
                        <div class="preloader"></div>
                        <div class="toggler-wr" role="checkbox" tabindex="0">
                        <input aria-labelledby="aria-category${category.groupId}" aria-hidden="false"
                         type="checkbox" name="groupId" value="${category.groupId}">
                        </div>
                    </div>
                </li>`);
  }

  function getFilterTemplate(filter, enabled) {
    const timeUpdatedText = convertDateToLocaleString(
      filter.lastUpdateTime || filter.timeUpdated
    );

    const getVersionText = (version) => ({
      text: version
        ? `${i18n.getMessage("options_filters_filter_version")} ${version}`
        : "",
      className: "filter-version-desc",
    });

    const getUpdatedTimeText = (updateTime) => ({
      text: updateTime
        ? `${i18n.getMessage("options_filters_filter_updated")} ${updateTime}`
        : "",
      className: "last-update-time",
    });

    /**
     * Creates divs with filter details, removing empty strings
     * @param {array} texts array with text-classes objects
     * @returns {string} html string
     */
    const renderFilterInfo = (texts) =>
      texts
        .filter((t) => t.text.length > 0)
        .map(
          (t) => `<div class="opt-name__info-item ${t.className}">
                                ${t.text}
                           </div>`
        )
        .join("");

    return `<li id="filter${filter.filterId}">
                    <div class="opt-name">
                        <div class="title-wr">
                            <div class="title">
                                ${
                                  filter.name && filter.name.length > 0
                                    ? filter.name
                                    : filter.subscriptionUrl
                                }
                                <a class="icon-home" target="_blank" href="${
                                  filter.homepage || filter.subscriptionUrl
                                }"></a>
                            </div>
                        </div>
                        <div class="desc">${filter.description}</div>
                        <div class="opt-name__info">
                            <div class="opt-name__info-labels">
                                ${renderFilterInfo([
                                  getVersionText(filter.version),
                                  getUpdatedTimeText(timeUpdatedText),
                                ])}
                            </div>
                        </div>
                    </div>
                    <div class="opt-state">
                        <div class="preloader"></div>
                        <div class="toggler-wr" role="checkbox" tabindex="0">
                            <input
                                type="checkbox"
                                name="filterId"
                                value="${filter.filterId}"
                                ${enabled ? 'checked="checked"' : ""}
                                aria-labelledby="filter${filter.filterId}"
                                aria-hidden="false"
                                >
                        </div>
                    </div>
                </li>`;
  }

  function getPageTitleTemplate(name) {
    return `
            <div class="page-title">
                <a href="#antibanner">
                    <img src="images/arrow-left.svg" class="back">
                </a>
                ${name}
            </div>`;
  }

  function getFiltersContentElement(category) {
    return htmlToElement(`<div id="antibanner${
      category.groupId
    }" class="settings-content tab-pane filters-list ">
                ${getPageTitleTemplate(category.groupName)}
                <div class="settings-body">
                    ${searchHtml}
                    <ul class="opts-list opts-list--filters">
                    </ul>
                </div>
            </div>`);
  }

  function renderFilterCategory(category) {
    let categoryContentElement = document.querySelector(
      `#antibanner${category.groupId}`
    );
    if (categoryContentElement) {
      categoryContentElement.parentNode.removeChild(categoryContentElement);
    }
    let categoryElement = document.querySelector(
      `#category${category.groupId}`
    );
    if (categoryElement) {
      categoryElement.parentNode.removeChild(categoryElement);
    }

    categoryElement = getFilterCategoryElement(category);
    document.querySelector("#groupsList").appendChild(categoryElement);
    updateCategoryFiltersInfo(category.groupId);

    categoryContentElement = getFiltersContentElement(category);
    document
      .querySelector("#antibanner")
      .parentNode.appendChild(categoryContentElement);
  }

  const filtersDisplayOptions = {
    ALL: "all",
    ENABLED: "enabled",
    DISABLED: "disabled",
  };

  const fitsDisplayOptionValue = (filterActivated, selectionValue) =>
    !!(
      selectionValue === filtersDisplayOptions.ALL ||
      (filterActivated && selectionValue === filtersDisplayOptions.ENABLED) ||
      (!filterActivated && selectionValue === filtersDisplayOptions.DISABLED)
    );

  const fitsSearchString = (title, searchString) => {
    if (searchString.length === 0) {
      return true;
    }
    const escapedWildcard = "\\*";
    if (searchString === escapedWildcard) {
      return true;
    }
    const regexp = new RegExp(searchString, "gi");
    return regexp.test(title);
  };

  const prepareSearchString = (searchString) => {
    let result;
    try {
      result = Utils.escapeRegExp(searchString.trim());
    } catch (err) {
      console.log(err.message);
    }
    return result;
  };

  const getDisplayOptionValue = (selectionNode) =>
    [].slice.call(selectionNode.options).filter((o) => o.selected)[0].value;

  const renderFiltersList = (target, filters, searchDataSources) => {
    // remove old elements
    while (target.firstChild) {
      target.removeChild(target.firstChild);
    }

    const { searchInputEl, displayOptionEl } = searchDataSources;

    const getFilteringFunction = () => {
      const searchString = prepareSearchString(searchInputEl.value);
      const displayOptionValue = getDisplayOptionValue(displayOptionEl);

      return (filter) => {
        if (searchString === undefined || displayOptionValue === undefined) {
          return true;
        }

        return (
          fitsSearchString(filter.name, searchString) &&
          fitsDisplayOptionValue(filter.enabled, displayOptionValue)
        );
      };
    };

    // Orders filters by groupId, displayNumber, name
    const sortingFunction = (f1, f2) => {
      let result = 0;
      try {
        if (f1.enabled !== f2.enabled) {
          result = f1.enabled ? -1 : 1;
        } else if (f1.groupId !== f2.groupId) {
          result = f1.groupId - f2.groupId;
        } else if (f1.displayNumber !== f2.displayNumber) {
          result = f1.displayNumber - f2.displayNumber;
        } else {
          result = f1.name.toLowerCase() > f2.name.toLowerCase() ? 1 : -1;
        }
      } catch (e) {
        console.log(e);
      }
      return result;
    };

    const filteringFunction = getFilteringFunction();
    const filtersToRender = filters
      .filter(filteringFunction)
      .sort(sortingFunction);

    filtersToRender.forEach((filter) => {
      const isEnabled = loadedFiltersInfo.isEnabled(filter.filterId);
      const filterHtml = getFilterTemplate(filter, isEnabled);
      target.appendChild(htmlToElement(filterHtml));
    });

    CheckboxUtils.toggleCheckbox(
      target.querySelectorAll(".opt-state input[type=checkbox]")
    );
  };

  const renderFiltersInCategory = (groupId, filters, searchDataSources) => {
    const groupSelector = `#antibanner${groupId}`;
    const filtersListNode = document.querySelector(
      `${groupSelector} ul.opts-list--filters`
    );

    if (!filtersListNode) {
      return;
    }

    // remove old filters
    while (filtersListNode.firstChild) {
      filtersListNode.removeChild(filtersListNode.firstChild);
    }

    // get groups filters
    const groupFilters = filters.filter((f) => f.groupId === groupId);

    renderFiltersList(filtersListNode, groupFilters, searchDataSources);
  };

  /**
   * Returns elements containing search data:
   * Search input, and selected display options (all/enabled/disabled)
   * @param {Element} searchComponent
   * @returns {{displayOptionEl: {Element}, searchInputEl: {Element}}}
   */
  const getSearchDataSources = (searchComponent) => ({
    searchInputEl: searchComponent.querySelector(
      'input[name="searchFiltersList"]'
    ),
    displayOptionEl: searchComponent.querySelector("#filterStatusSelection"),
    clearSearchEl: searchComponent.querySelector(".filters-search__cross"),
  });

  const SEARCH_INPUT_DELAY_MS = 250;

  function initSearchInCategory(category) {
    const { groupId } = category;
    const groupSelector = `#antibanner${groupId}`;
    const searchComponent = document.querySelector(
      `${groupSelector} .filters-search`
    );
    if (!searchComponent) {
      return;
    }

    const searchDataSources = getSearchDataSources(searchComponent);

    const { searchInputEl, displayOptionEl, clearSearchEl } = searchDataSources;

    const { filters } = loadedFiltersInfo;

    if (searchInputEl) {
      searchInputEl.addEventListener(
        "input",
        Utils.debounce(() => {
          renderFiltersInCategory(groupId, filters, searchDataSources);
        }, SEARCH_INPUT_DELAY_MS)
      );
    }

    if (displayOptionEl) {
      displayOptionEl.addEventListener("change", () => {
        renderFiltersInCategory(groupId, filters, searchDataSources);
      });
    }

    if (clearSearchEl) {
      clearSearchEl.addEventListener("click", () => {
        searchInputEl.value = "";
        displayOptionEl.value = filtersDisplayOptions.ALL;
        renderFiltersInCategory(groupId, filters, searchDataSources);
      });
    }

    return searchDataSources;
  }
  /**
   * Function clears search results when user moves from category antibanner page to another page
   * and re-renders filters in category (in order to keep right order)
   * @param {*} event hashchange event
   */
  function handleHashSwitch(event) {
    const regex = /#antibanner(\d+)/g;
    const match = regex.exec(event.oldURL) || regex.exec(event.newURL);
    if (!match) {
      return;
    }
    const groupId = parseInt(match[1], 10);
    if (!groupId) {
      return;
    }

    const searchInputEl = document.querySelector(
      `#antibanner${groupId} input[name="searchFiltersList"]`
    );
    // custom groups doesn't have search input till there is no filters inside
    if (!searchInputEl) {
      return;
    }
    const displayOptionEl = document.querySelector(
      `#antibanner${groupId} #filterStatusSelection`
    );

    searchInputEl.value = "";
    displayOptionEl.value = filtersDisplayOptions.ALL;

    const searchDataSources = {
      searchInputEl,
      displayOptionEl,
    };

    renderFiltersInCategory(
      groupId,
      loadedFiltersInfo.filters,
      searchDataSources
    );
  }

  const searchHtml = `<div class="filters-search">
                            <div class="icon-search">
                                <img src="images/magnifying-green.svg" alt="">
                            </div>
                            <input
                                type="text"
                                placeholder="${i18n.getMessage(
                                  "options_filters_list_search_placeholder"
                                )}"
                                name="searchFiltersList"
                            />
                            <select class="opt-select opt-select--input" id="filterStatusSelection">
                                <option value="${filtersDisplayOptions.ALL}">
                                    ${i18n.getMessage(
                                      "options_filters_list_search_display_option_all"
                                    )}
                                </option>
                                <option value="${
                                  filtersDisplayOptions.ENABLED
                                }">
                                    ${i18n.getMessage(
                                      "options_filters_list_search_display_option_enabled"
                                    )}
                                </option>
                                <option value="${
                                  filtersDisplayOptions.DISABLED
                                }">
                                    ${i18n.getMessage(
                                      "options_filters_list_search_display_option_disabled"
                                    )}
                                </option>
                            </select>
                            <div class="filters-search__cross">
                                <img src="images/cross.svg" alt="">
                            </div>
                        </div>`;

  const showGroupList = (show) => {
    const groupsList = document.querySelector("#groupsList");
    groupsList.style.display = show ? "block" : "none";
  };

  const showFiltersList = (show) => {
    const filtersList = document.querySelector("#filtersList");
    filtersList.style.display = show ? "block" : "none";
  };

  const selectListToDisplay = (searchDataSources) => {
    const { searchInputEl } = searchDataSources;
    const searchString = prepareSearchString(searchInputEl.value);
    if (searchString.length > 0) {
      showFiltersList(true);
      showGroupList(false);
    } else {
      showFiltersList(false);
      showGroupList(true);
    }
  };

  const mountSearchComponent = (target) => {
    // Check if component already exists in the dom
    const searchComponentEl = document.querySelector(
      "#antibanner .filters-search"
    );
    if (searchComponentEl) {
      return searchComponentEl;
    }
    const searchComponent = htmlToElement(searchHtml);
    target.insertAdjacentElement("afterbegin", searchComponent);
    return searchComponent;
  };

  const renderCommonFiltersList = (filters, searchDataSources) => {
    const filtersListNode = document.querySelector("#filtersList");
    if (!filtersListNode) {
      return;
    }
    renderFiltersList(filtersListNode, filters, searchDataSources);
    selectListToDisplay(searchDataSources);
  };

  const bindSearchControls = (searchDataSources) => {
    const { searchInputEl, displayOptionEl, clearSearchEl } = searchDataSources;

    searchInputEl.addEventListener(
      "input",
      Utils.debounce(() => {
        renderCommonFiltersList(loadedFiltersInfo.filters, searchDataSources);
      }, SEARCH_INPUT_DELAY_MS)
    );

    displayOptionEl.addEventListener("change", () => {
      renderCommonFiltersList(loadedFiltersInfo.filters, searchDataSources);
    });

    clearSearchEl.addEventListener("click", () => {
      searchInputEl.value = "";
      displayOptionEl.value = filtersDisplayOptions.ALL;
      renderCommonFiltersList(loadedFiltersInfo.filters, searchDataSources);
    });
  };

  function renderCategoriesAndFilters() {
    const settingsBody = document.querySelector("#antibanner .settings-body");
    const searchComponent = mountSearchComponent(settingsBody);
    const searchDataSources = getSearchDataSources(searchComponent);
    bindSearchControls(searchDataSources);

    contentPage.sendMessage({ type: "getFiltersMetadata" }, (response) => {
      loadedFiltersInfo.initLoadedFilters(
        response.filters,
        response.categories
      );
      setLastUpdatedTimeText(loadedFiltersInfo.lastUpdateTime);

      const { categories, filters } = loadedFiltersInfo;

      categories.forEach((category) => {
        renderFilterCategory(category);
        const groupSearchDataSources = initSearchInCategory(category);
        renderFiltersInCategory(
          category.groupId,
          filters,
          groupSearchDataSources
        );
      });

      renderCommonFiltersList(filters, searchDataSources);

      CheckboxUtils.toggleCheckbox(
        document.querySelectorAll(".opt-state input[type=checkbox]")
      );

      // check document hash
      const { hash } = document.location;
      if (hash && hash.indexOf("#antibanner") === 0) {
        TopMenu.toggleTab();
      }
    });
  }

  function toggleFilterState() {
    const filterId = this.value - 0;
    if (this.checked) {
      contentPage.sendMessage({ type: "addAndEnableFilter", filterId });
    } else {
      contentPage.sendMessage({ type: "disableAntiBannerFilter", filterId });
    }
  }

  function toggleGroupState() {
    const groupId = this.value - 0;
    if (this.checked) {
      contentPage.sendMessage({ type: "enableFiltersGroup", groupId });
    } else {
      contentPage.sendMessage({ type: "disableFiltersGroup", groupId });
    }
  }

  function updateAntiBannerFilters(e) {
    e.preventDefault();
    document
      .querySelector(".settings-actions__update-button")
      .classList.add("settings-actions__update-button--spinning");
    contentPage.sendMessage({ type: "checkAntiBannerFiltersUpdate" }, () => {
      setLastUpdatedTimeText(Date.now());
    });
  }

  const convertDateToLocaleString = (date) => {
    if (date) {
      const lastUpdateTime = moment(date);
      lastUpdateTime.locale(environmentOptions.Prefs.locale);
      return lastUpdateTime.format("LLL").toLowerCase();
    }
    return "";
  };

  /**
   * Current time in numeric value
   * @param {number} lastUpdateTime
   */
  const setLastUpdatedTimeText = (lastUpdateTime) => {
    if (lastUpdateTime && lastUpdateTime >= loadedFiltersInfo.lastUpdateTime) {
      loadedFiltersInfo.lastUpdateTime = lastUpdateTime;
      document.querySelector(
        "#lastUpdateTime"
      ).textContent = convertDateToLocaleString(lastUpdateTime);
    }
  };

  function updateRulesCountInfo(info) {
    const message = i18n.getMessage("options_antibanner_info", [
      String(info.rulesCount || 0),
    ]);
    document.querySelector("#filtersRulesInfo").textContent = message;
  }

  function updateFilterMetadata(filter) {
    const filterElements = getFilterElements(filter.filterId);
    filterElements.forEach((filterEl) => {
      filterEl.querySelector(".preloader").classList.remove("active");
      const localeDateString = convertDateToLocaleString(
        filter.lastUpdateTime || filter.timeUpdated
      );
      filterEl.querySelector(
        ".last-update-time"
      ).textContent = `${i18n.getMessage(
        "options_filters_filter_updated"
      )} ${localeDateString}`;
      const versionDesc = filterEl.querySelector(".filter-version-desc");
      if (versionDesc) {
        versionDesc.textContent = `${i18n.getMessage(
          "options_filters_filter_version"
        )} ${filter.version}`;
      }
    });
  }

  function onFilterStateChanged(filter) {
    const { filterId, enabled } = filter;
    loadedFiltersInfo.updateEnabled(filter, enabled);
    updateCategoryFiltersInfo(filter.groupId);
    updateFilterMetadata(filter);
    const checkboxes = getFilterCheckboxes(filterId);
    if (checkboxes) {
      CheckboxUtils.updateCheckbox(checkboxes, enabled);
    }
    if (filterId === AntiBannerFiltersId.SEARCH_AND_SELF_PROMO_FILTER_ID) {
      
    }
  }

  function onCategoryStateChanged(category) {
    loadedFiltersInfo.updateCategoryEnabled(category, category.enabled);
    updateCategoryFiltersInfo(category.groupId);
  }

  function onFilterDownloadStarted(filter) {
    getCategoryElement(filter.groupId)
      .querySelector(".preloader")
      .classList.add("active");
    const filterElements = getFilterElements(filter.filterId);
    filterElements.forEach((filterElement) => {
      filterElement.querySelector(".preloader").classList.add("active");
    });
  }

  function onFilterDownloadFinished(filter) {
    getCategoryElement(filter.groupId)
      .querySelector(".preloader")
      .classList.remove("active");
    updateFilterMetadata(filter);
    setLastUpdatedTimeText(filter.lastUpdateTime);
  }

  function onFiltersUpdateCheckReady() {
    document
      .querySelector(".settings-actions__update-button")
      .classList.remove("settings-actions__update-button--spinning");
  }

  return {
    render: renderCategoriesAndFilters,
    updateRulesCountInfo,
    onFilterStateChanged,
    onCategoryStateChanged,
    onFilterDownloadStarted,
    onFilterDownloadFinished,
    onFiltersUpdateCheckReady,
  };
};

const Settings = function () {
  "use strict";

  const Checkbox = function (id, property, options) {
    options = options || {};
    const { negate } = options;
    const { hidden } = options;

    const element = document.querySelector(id);
    if (!hidden) {
      element.addEventListener("change", function () {
        contentPage.sendMessage({
          type: "changeUserSetting",
          key: property,
          value: negate ? !this.checked : this.checked,
        });
      });
    }

    const render = function () {
      if (hidden) {
        element.closest("li").style.display = "none";
        return;
      }
      let checked = userSettings.values[property];
      if (negate) {
        checked = !checked;
      }

      CheckboxUtils.updateCheckbox([element], checked);
    };

    const getPropertyName = () => property;

    const updateCheckboxValue = (value) => {
      let checked = value;
      if (negate) {
        checked = !checked;
      }
      CheckboxUtils.updateCheckbox([element], checked);
    };

    return {
      render,
      getPropertyName,
      updateCheckboxValue,
    };
  };

  const checkboxes = [];
  checkboxes.push(
    new Checkbox("#enableHitsCount", userSettings.names.DISABLE_COLLECT_HITS, {
      negate: true,
    })
  );
  checkboxes.push(
    new Checkbox(
      "#showInfoAboutPurifyFullVersion",
      userSettings.names.DISABLE_SHOW_PURIFY_PROMO_INFO,
      {
        negate: true,
      }
    )
  );
  checkboxes.push(
    new Checkbox(
      "#showAppUpdatedNotification",
      userSettings.names.DISABLE_SHOW_APP_UPDATED_NOTIFICATION,
      {
        negate: true,
      }
    )
  );

  // Privacy settings
  checkboxes.push(
    new Checkbox("#hide_referrer", userSettings.names.HIDE_REFERRER)
  );
  checkboxes.push(
    new Checkbox("#hide_search_queries", userSettings.names.HIDE_SEARCH_QUERIES)
  );
  checkboxes.push(
    new Checkbox("#send_not_track", userSettings.names.SEND_DO_NOT_TRACK)
  );
  if (environmentOptions.isChrome) {
    const removeClientDataInput = document.querySelector("#remove-client-data");
    removeClientDataInput.closest("li").style.display = "flex";
    checkboxes.push(
      new Checkbox(
        "#remove-client-data",
        userSettings.names.BLOCK_CHROME_CLIENT_DATA
      )
    );
  }
  if (environmentOptions.canBlockWebRTC) {
    // Edge doesn't support block webrtc
    const disableWebRTCNode = document.querySelector("#disable_webrtc");
    disableWebRTCNode.closest("li").style.display = "flex";
    checkboxes.push(
      new Checkbox("#disable_webrtc", userSettings.names.BLOCK_WEBRTC)
    );
  }
  checkboxes.push(
    new Checkbox(
      "#third_party_cookies",
      userSettings.names.SELF_DESTRUCT_THIRD_PARTY_COOKIES
    )
  );
  checkboxes.push(
    new Checkbox(
      "#first_party_cookies",
      userSettings.names.SELF_DESTRUCT_FIRST_PARTY_COOKIES
    )
  );
  checkboxes.push(
    new Checkbox(
      "#strip_tracking_params",
      userSettings.names.STRIP_TRACKING_PARAMETERS
    )
  );

  // set SELF_DESTRUCT_THIRD_PARTY_COOKIES_TIME and SELF_DESTRUCT_FIRST_PARTY_COOKIES_TIME values
  const selectorsMap = {
    thirdParty: {
      selector: "#third_party_time",
      settingKey: "SELF_DESTRUCT_THIRD_PARTY_COOKIES_TIME",
    },
    firstParty: {
      selector: "#first_party_time",
      settingKey: "SELF_DESTRUCT_FIRST_PARTY_COOKIES_TIME",
    },
  };

  const normalizeCookieTime = (value, defaultValue) => {
    if (value === "") {
      return defaultValue;
    }

    value = Number.parseFloat(value);
    if (value < 0) {
      return defaultValue;
    }

    return value;
  };

  Object.values(selectorsMap).forEach(({ selector, settingKey }) => {
    // eslint-disable-next-line no-use-before-define
    const { names, values, defaultValues } = userSettings;
    settingKey = names[settingKey];
    const defaultValue = defaultValues[settingKey];
    const input = document.querySelector(selector);
    if (input) {
      input.value = values[settingKey];
      input.setAttribute("placeholder", defaultValue);
      input.addEventListener(
        "keyup",
        Utils.debounce(() => {
          contentPage.sendMessage({
            type: "changeUserSetting",
            key: settingKey,
            value: normalizeCookieTime(input.value, defaultValue),
          });
        }, 1000)
      );
    }
  });

  const trackingParametersInput = document.querySelector(
    "#strip_tracking_params_input"
  );
  trackingParametersInput.value =
    userSettings.values[userSettings.names.TRACKING_PARAMETERS];
  if (trackingParametersInput) {
    trackingParametersInput.addEventListener(
      "keyup",
      Utils.debounce((e) => {
        contentPage.sendMessage({
          type: "changeUserSetting",
          key: userSettings.names.TRACKING_PARAMETERS,
          value: trackingParametersInput.value,
        });
      }, 1000)
    );
  }

  const selectOptions = [
    {
      name: i18n.getMessage("options_select_update_period_default"),
      value: -1,
    },
    {
      name: i18n.getMessage("options_select_update_period_48h"),
      value: Utils.hoursToMs(48),
    },
    {
      name: i18n.getMessage("options_select_update_period_24h"),
      value: Utils.hoursToMs(24),
    },
    {
      name: i18n.getMessage("options_select_update_period_12h"),
      value: Utils.hoursToMs(12),
    },
    {
      name: i18n.getMessage("options_select_update_period_6h"),
      value: Utils.hoursToMs(6),
    },
    {
      name: i18n.getMessage("options_select_update_period_1h"),
      value: Utils.hoursToMs(1),
    },
    {
      name: i18n.getMessage("options_select_update_period_disabled"),
      value: 0,
    },
  ];

  function handleActiveStealthOptions(stealthModeDisabled) {
    const miscellaneousOptionsContainer = document.querySelector(
      "#miscellaneous-stealth-options"
    );
    const cookiesOptionsContainer = document.querySelector(
      "#cookies-stealth-options"
    );
    const optionsContainers = [
      miscellaneousOptionsContainer,
      cookiesOptionsContainer,
    ];
    optionsContainers.forEach((container) => {
      if (stealthModeDisabled) {
        container.classList.add("opts-list--disabled");
      } else {
        container.classList.remove("opts-list--disabled");
      }
    });

    const stripTrackingTextarea = document.querySelector(
      "#strip_tracking_params_input"
    );
    stripTrackingTextarea.disabled = stealthModeDisabled;
  }

  const render = function () {
    for (let i = 0; i < checkboxes.length; i++) {
      checkboxes[i].render();
    }

    handleActiveStealthOptions(
      userSettings.values[userSettings.names.DISABLE_STEALTH_MODE]
    );
  };

  const getSettingCheckboxes = (propertyName) =>
    checkboxes.filter(
      (checkbox) => checkbox.getPropertyName() === propertyName
    );

  const updateCheckboxValue = (propertyName, propertyValue) => {
    getSettingCheckboxes(propertyName).forEach((checkbox) => {
      checkbox.updateCheckboxValue(propertyValue);
    });
  };

  return {
    render,
    updateCheckboxValue,
  };
};

const PageController = function () {};

PageController.prototype = {
  SUBSCRIPTIONS_LIMIT: 9,

  init() {
    this._bindEvents();
    this._render();

    CheckboxUtils.toggleCheckbox(
      document.querySelectorAll(".opt-state input[type=checkbox]")
    );

    // Initialize top menu
    TopMenu.init({
      onHashUpdated(tabId) {
        // Doing nothing
      },
    });
  },

  _bindEvents() {
    // TODO remove if not necessary
    this.tooManySubscriptionsEl = document.querySelector(
      "#tooManySubscriptions"
    );

    document
      .querySelector("#resetStats")
      .addEventListener("click", this.onResetStatsClicked.bind(this));

    // document.querySelector('.openExtensionStore').addEventListener('click', (e) => {
    //     e.preventDefault();
    //     contentPage.sendMessage({ type: 'openExtensionStore' });
    // });
  },

  _render() {
    const defaultWhitelistMode =
      userSettings.values[userSettings.names.DEFAULT_WHITE_LIST_MODE];

    const currentYearElements = document.getElementsByClassName("current-year");

    Array.prototype.forEach.call(currentYearElements, (el) => {
      el.innerText = new Date().getFullYear().toString();
    });

    if (environmentOptions.Prefs.mobile) {
      document.querySelector("#resetStats").style.display = "none";
    }

    this.settings = new Settings();
    this.settings.render();

    // Initialize whitelist filter
    this.whiteListFilter = new WhiteListFilter({
      defaultWhiteListMode: defaultWhitelistMode,
    });
    this.whiteListFilter.updateWhiteListDomains();

    // Initialize User filter
    this.userFilter = new UserFilter();
    this.userFilter.updateUserFilterRules();

    // Initialize AntiBanner filters
    this.antiBannerFilters = new AntiBannerFilters({
      rulesInfo: requestFilterInfo,
    });
    this.antiBannerFilters.render();

    const versionPlaceholder = document.querySelector(
      "#about-version-placeholder"
    );
    if (versionPlaceholder) {
      versionPlaceholder.textContent = `${i18n.getMessage(
        "options_about_version"
      )} ${environmentOptions.appVersion}`;
    }
  },

  onResetStatsClicked(e) {
    e.preventDefault();
    contentPage.sendMessage({ type: "resetBlockedAdsCount" }, () => {
      Utils.showPopup(i18n.getMessage("options_reset_stats_done"));
    });
  },
};

let userSettings;
let enabledFilters;
let environmentOptions;
let AntiBannerFiltersId;
let EventNotifierTypes;
let requestFilterInfo;

/**
 * Parses hash string
 * example: #action=add_filter_subscription&title=test&url=example.org ->
 *          {
 *              action: add_filter_subscription,
 *              title: test,
 *              url: example.org,
 *          }
 * @param {string} hash - document.location.hash string
 * @returns {{}} object with options received from hash string
 */
const parseHash = (hash) =>
  hash
    .slice(1) // remove first '#'
    .split("&")
    .map((part) => {
      const [key, value] = part.split("=");
      return [key, value];
    })
    .reduce((acc, [key, value]) => {
      if (key && value) {
        acc[key] = value;
      }
      return acc;
    }, {});

/**
 * Function handles location hash, looks for parameters
 * @returns {*} options if they were provided in the hash
 */
const handleUrlHash = () => {
  const { hash } = document.location;
  const hashOptions = parseHash(decodeURIComponent(hash));
  const { action, replacement } = hashOptions;

  if (!action) {
    return;
  }

  document.location.hash = replacement ? `#${replacement}` : "";
  return hashOptions;
};

const handleHashOptions = (controller, hashOptions) => {
  if (!hashOptions || !hashOptions.action) {
    return;
  }
  switch (hashOptions.action) {
    case "add_filter_subscription": {
      const { title, url } = hashOptions;
      if (url) {
        controller.addFilterSubscription({ title, url });
      }
      break;
    }
    default:
      break;
  }
};

/**
 * Initializes page
 */
const initPage = function (response) {
  userSettings = response.userSettings;
  enabledFilters = response.enabledFilters;
  environmentOptions = response.environmentOptions;
  requestFilterInfo = response.requestFilterInfo;

  AntiBannerFiltersId = response.constants.AntiBannerFiltersId;
  EventNotifierTypes = response.constants.EventNotifierTypes;

  const onDocumentReady = function () {
    // handle initial url hash
    const hashOptions = handleUrlHash();

    const controller = new PageController();
    controller.init();

    handleHashOptions(controller, hashOptions);

    // handle next url hash changes
    window.addEventListener("hashchange", () => {
      handleHashOptions(controller, handleUrlHash());
    });

    const events = [
      EventNotifierTypes.FILTER_ENABLE_DISABLE,
      EventNotifierTypes.FILTER_GROUP_ENABLE_DISABLE,
      EventNotifierTypes.START_DOWNLOAD_FILTER,
      EventNotifierTypes.SUCCESS_DOWNLOAD_FILTER,
      EventNotifierTypes.ERROR_DOWNLOAD_FILTER,
      EventNotifierTypes.UPDATE_USER_FILTER_RULES,
      EventNotifierTypes.UPDATE_WHITELIST_FILTER_RULES,
      EventNotifierTypes.REQUEST_FILTER_UPDATED,
      EventNotifierTypes.SETTING_UPDATED,
      EventNotifierTypes.FILTERS_UPDATE_CHECK_READY,
    ];

    createEventListener(events, (event, options) => {
      switch (event) {
        case EventNotifierTypes.FILTER_ENABLE_DISABLE:
          controller.antiBannerFilters.onFilterStateChanged(options);
          break;
        case EventNotifierTypes.FILTER_GROUP_ENABLE_DISABLE:
          controller.antiBannerFilters.onCategoryStateChanged(options);
          break;
        case EventNotifierTypes.START_DOWNLOAD_FILTER:
          controller.antiBannerFilters.onFilterDownloadStarted(options);
          break;
        case EventNotifierTypes.SUCCESS_DOWNLOAD_FILTER:
        case EventNotifierTypes.ERROR_DOWNLOAD_FILTER:
          controller.antiBannerFilters.onFilterDownloadFinished(options);
          break;
        case EventNotifierTypes.UPDATE_USER_FILTER_RULES:
          controller.antiBannerFilters.updateRulesCountInfo(options);
          break;
        case EventNotifierTypes.UPDATE_WHITELIST_FILTER_RULES:
          controller.whiteListFilter.updateWhiteListDomains();
          break;
        case EventNotifierTypes.REQUEST_FILTER_UPDATED:
          controller.antiBannerFilters.updateRulesCountInfo(options);
          controller.userFilter.updateUserFilterRules();
          break;
        case EventNotifierTypes.SETTING_UPDATED: {
          const { propertyName, propertyValue } = options;
          if (typeof propertyValue === "boolean") {
            controller.settings.updateCheckboxValue(
              propertyName,
              propertyValue
            );
          }
          break;
        }
        case EventNotifierTypes.FILTERS_UPDATE_CHECK_READY: {
          controller.antiBannerFilters.onFiltersUpdateCheckReady();
          break;
        }
        default:
          break;
      }
    });
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
};

const browser = window.browser || chrome;

const backgroundPagePromise = new Promise((resolve, reject) => {
  browser.runtime.getBackgroundPage((page) => {
    if (browser.runtime.lastError) {
      return reject(browser.runtime.lastError);
    }
    if (page) {
      return resolve(page);
    }
    return reject(new Error("Runtime was unable to get background page"));
  });
});

const waitStorageInit = (purify) => {
  const timeoutMs = 500;
  if (!purify.localStorage.isInitialized()) {
    setTimeout(() => {
      waitStorageInit(purify);
    }, timeoutMs);
    return;
  }
  contentPage.sendMessage({ type: "initializeFrameScript" }, initPage);
};

backgroundPagePromise
  .then((page) => {
    waitStorageInit(page.purify);
  })
  .catch((e) => {
    console.log(e.message);
  });
