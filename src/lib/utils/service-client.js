/**
 * ----------------------------------------------------------------------------------
 * PurifyBrowserExtension service-client.js
 * Licensed under MIT (https://github.com/CyberPurify/CyberPurify/blob/main/LICENSE)
 * ----------------------------------------------------------------------------------
 */

/* global FilterDownloader */
purify.backend = (function (purify) {
  "use strict";

  /**
   * Class for working with our backend server.
   * All requests sent by this class are covered in the privacy policy:
   * http://cyberpurify.com/en/privacy.html#browsers
   */

  /**
   * Settings
   */
  const settings = {
    // Base url of our backend server
    get backendUrl() {
      return "https://chrome.adtidy.org";
    },

    get apiKey() {
      return "4DDBE80A3DA94D819A00523252FB6380";
    },

    // Url for load filters metadata and rules
    get filtersUrl() {
      return purify.lazyGet(this, "filtersUrl", () => {
        if (purify.utils.browser.isFirefoxBrowser()) {
          return "https://storage.googleapis.com/purify/extension";
          return "https://storage.googleapis.com/purify/extension/firefox";
        }
        if (purify.utils.browser.isEdgeBrowser()) {
          return "https://storage.googleapis.com/purify/extension";
          return "https://storage.googleapis.com/purify/extension/edge";
        }
        if (purify.utils.browser.isOperaBrowser()) {
          return "https://storage.googleapis.com/purify/extension";
          return "https://storage.googleapis.com/purify/extension/opera";
        }
        return "https://storage.googleapis.com/purify/extension";
        return "https://storage.googleapis.com/purify/extension/chromium";
      });
    },

    // URL for downloading AG filters
    get filterRulesUrl() {
      return `${this.filtersUrl}/filters/{filter_id}.txt`;
    },

    // URL for checking filter updates
    get filtersMetadataUrl() {
      const params = purify.utils.browser.getExtensionParams();
      return `${this.filtersUrl}/filters.js?${params.join("&")}`;
    },

    // URL for user complaints on missed ads or malware/phishing websites
    get reportUrl() {
      return `${this.backendUrl}/url-report.html`;
    },

    /**
     * URL for collecting filter rules statistics.
     * We do not collect it by default, unless user is willing to help.
     *
     * Filter rules stats are covered in our privacy policy and on also here:
     * http://cyberpurify.com/en/filter-rules-statistics.html
     */
    get ruleStatsUrl() {
      return `${this.backendUrl}/rulestats.html`;
    },

    /**
     * Browsing Security lookups. In case of Firefox lookups are disabled for HTTPS urls.
     */
    get safebrowsingLookupUrl() {
      return "https://sb.adtidy.org/safebrowsing-lookup-short-hash.html";
    },

    // Folder that contains filters metadata and files with rules. 'filters' by default
    get localFiltersFolder() {
      return "filters";
    },
    // Path to the redirect sources
    get redirectSourcesFolder() {
      return "lib/filter/rules/scriptlets";
    },
    // Array of filter identifiers, that have local file with rules. Range from 1 to 21 by default
    get localFilterIds() {
      return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 224];
    },
  };

  /**
   * FilterDownloader constants
   */
  const FilterCompilerConditionsConstants = {
    purify: true,
    purify_ext_chromium: purify.utils.browser.isChromium(),
    purify_ext_firefox: purify.utils.browser.isFirefoxBrowser(),
    purify_ext_edge: purify.utils.browser.isEdgeBrowser(),
    purify_ext_safari: false,
    purify_ext_opera: purify.utils.browser.isOperaBrowser(),
  };

  /**
   * Loading subscriptions map
   */
  const loadingSubscriptions = Object.create(null);

  /**
   * Executes async request
   * @param url Url
   * @param contentType Content type
   * @param successCallback success callback
   * @param errorCallback error callback
   */
  function executeRequestAsync(
    url,
    contentType,
    successCallback,
    errorCallback
  ) {
    const request = new XMLHttpRequest();
    try {
      request.open("GET", url);
      request.setRequestHeader("Content-type", contentType);
      request.setRequestHeader("Accept", contentType);
      request.setRequestHeader("Pragma", "no-cache");
      request.overrideMimeType(contentType);
      request.mozBackgroundRequest = true;
      if (successCallback) {
        request.onload = function () {
          successCallback(request);
        };
      }
      if (errorCallback) {
        const errorCallbackWrapper = function () {
          errorCallback(request);
        };
        request.onerror = errorCallbackWrapper;
        request.onabort = errorCallbackWrapper;
        request.ontimeout = errorCallbackWrapper;
      }
      request.send(null);
    } catch (ex) {
      if (errorCallback) {
        errorCallback(request, ex);
      }
    }
  }

  /**
   * URL for downloading AG filter
   *
   * @param filterId Filter identifier
   * @private
   */
  function getUrlForDownloadFilterRules(filterId) {
    return purify.utils.strings.replaceAll(
      settings.filterRulesUrl,
      "{filter_id}",
      filterId
    );
  }

  /**
   * Appends request key to url
   */
  function addKeyParameter(url) {
    return `${url}&key=${settings.apiKey}`;
  }

  /**
   * Safe json parsing
   * @param text
   * @private
   */
  function parseJson(text) {
    try {
      return JSON.parse(text);
    } catch (ex) {
      purify.console.error("Error parse json {0}", ex);
      return null;
    }
  }

  /**
   * Load metadata of the specified filters
   *
   * @param filterIds         Filters identifiers
   * @param successCallback   Called on success
   * @param errorCallback     Called on error
   */
  const loadFiltersMetadata = (filterIds, successCallback, errorCallback) => {
    if (!filterIds || filterIds.length === 0) {
      successCallback([]);
      return;
    }

    const success = (response) => {
      if (response && response.responseText) {
        const metadata = parseJson(response.responseText);
        if (!metadata) {
          errorCallback(response, "invalid response");
          return;
        }
        const filterMetadataList = [];
        for (let i = 0; i < filterIds.length; i += 1) {
          const filter = purify.utils.collections.find(
            metadata.filters,
            "filterId",
            filterIds[i]
          );
          if (filter) {
            filterMetadataList.push(
              purify.subscriptions.createSubscriptionFilterFromJSON(filter)
            );
          }
        }
        successCallback(filterMetadataList);
      } else {
        errorCallback(response, "empty response");
      }
    };

    executeRequestAsync(
      settings.filtersMetadataUrl,
      "application/json",
      success,
      errorCallback
    );
  };

  /**
   * Downloads filter rules by filter ID
   *
   * @param filterId              Filter identifier
   * @param forceRemote           Force download filter rules from remote server
   * @returns {Promise<string>}   Downloaded rules
   */
  const loadFilterRules = (filterId, forceRemote) => {
    let url;

    if (forceRemote || settings.localFilterIds.indexOf(filterId) < 0) {
      url = getUrlForDownloadFilterRules(filterId);
    } else {
      url = purify.getURL(
        `${settings.localFiltersFolder}/filter_${filterId}.txt`
      );
    }

    return FilterDownloader.download(url, FilterCompilerConditionsConstants);
  };

  /**
   * Downloads filter rules frm url
   *
   * @param url               Subscription url
   * @param successCallback   Called on success
   * @param errorCallback     Called on error
   */
  const loadFilterRulesBySubscriptionUrl = function (
    url,
    successCallback,
    errorCallback
  ) {
    if (url in loadingSubscriptions) {
      return;
    }

    loadingSubscriptions[url] = true;

    const success = function (lines) {
      delete loadingSubscriptions[url];

      if (lines[0].indexOf("[") === 0) {
        // [Adblock Plus 2.0]
        lines.shift();
      }

      successCallback(lines);
    };

    const error = function (cause) {
      delete loadingSubscriptions[url];
      const message = cause instanceof Error ? cause.message : cause;
      errorCallback(message);
    };

    FilterDownloader.download(url, FilterCompilerConditionsConstants).then(
      success,
      error
    );
  };

  const createError = (message, url, response) => {
    const errorMessage = `
        error:                    ${message}
        requested url:            ${url}
        request status text:      ${response.statusText}`;
    return new Error(errorMessage);
  };

  /**
   * Loads filter groups metadata
   */
  const loadLocalFiltersMetadata = () =>
    new Promise((resolve, reject) => {
      const url = purify.getURL(`${settings.localFiltersFolder}/filters.json`);
      const success = function (response) {
        if (response && response.responseText) {
          const metadata = parseJson(response.responseText);
          if (!metadata) {
            reject(createError("invalid response", url, response));
            return;
          }
          resolve(metadata);
        } else {
          reject(createError("empty response", url, response));
        }
      };

      const error = (request, ex) => {
        const exMessage =
          (ex && ex.message) || "couldn't load local filters metadata";
        reject(createError(exMessage, url, request));
      };

      executeRequestAsync(url, "application/json", success, error);
    });

  /**
   * Loads filter groups metadata from local file
   * @returns {Promise}
   */
  const loadLocalFiltersI18Metadata = () =>
    new Promise((resolve, reject) => {
      const url = purify.getURL(
        `${settings.localFiltersFolder}/filters_i18n.json`
      );
      const success = function (response) {
        if (response && response.responseText) {
          const metadata = parseJson(response.responseText);
          if (!metadata) {
            reject(createError("invalid response", url, response));
            return;
          }
          resolve(metadata);
        } else {
          reject(createError("empty response", url, response));
        }
      };

      const error = (request, ex) => {
        const exMessage =
          (ex && ex.message) || "couldn't load local filters i18n metadata";
        reject(createError(exMessage, url, request));
      };

      executeRequestAsync(url, "application/json", success, error);
    });

  /**
   * Loads script rules from local file
   * @returns {Promise}
   */
  const loadLocalScriptRules = () =>
    new Promise((resolve, reject) => {
      const url = purify.getURL(
        `${settings.localFiltersFolder}/local_script_rules.json`
      );

      const success = (response) => {
        if (response && response.responseText) {
          const metadata = parseJson(response.responseText);
          if (!metadata) {
            reject(createError("invalid response", url, response));
            return;
          }
          resolve(metadata);
        } else {
          reject(createError("empty response", url, response));
        }
      };

      const error = (request, ex) => {
        const exMessage =
          (ex && ex.message) || "couldn't load local script rules";
        reject(createError(exMessage, url, request));
      };

      executeRequestAsync(url, "application/json", success, error);
    });

  /**
   * Loads redirect sources from local file
   * @returns {Promise}
   */
  const loadRedirectSources = () =>
    new Promise((resolve, reject) => {
      const url = `${purify.getURL(
        settings.redirectSourcesFolder
      )}/redirects.yml`;

      const success = (response) => {
        if (response && response.responseText) {
          resolve(response.responseText);
        } else {
          reject(createError("empty response", url, response));
        }
      };

      const error = (request, ex) => {
        const exMessage =
          (ex && ex.message) || "couldn't load redirect sources";
        reject(createError(exMessage, url, request));
      };

      executeRequestAsync(url, "application/x-yaml", success, error);
    });

  /**
   * Checks specified host hashes with our safebrowsing service
   *
   * @param hashes                Host hashes
   * @param successCallback       Called on success
   * @param errorCallback         Called on error
   */
  const lookupSafebrowsing = function (hashes, successCallback, errorCallback) {
    const url = `${
      settings.safebrowsingLookupUrl
    }?prefixes=${encodeURIComponent(hashes.join("/"))}`;
    executeRequestAsync(
      url,
      "application/json",
      successCallback,
      errorCallback
    );
  };

  /**
   * Sends feedback from the user to our server
   *
   * @param url           URL
   * @param messageType   Message type
   * @param comment       Message text
   */
  const sendUrlReport = function (url, messageType, comment) {
    let params = `url=${encodeURIComponent(url)}`;
    params += `&messageType=${encodeURIComponent(messageType)}`;
    if (comment) {
      params += `&comment=${encodeURIComponent(comment)}`;
    }
    params = addKeyParameter(params);

    const request = new XMLHttpRequest();
    request.open("POST", settings.reportUrl);
    request.setRequestHeader(
      "Content-type",
      "application/x-www-form-urlencoded"
    );
    request.send(params);
  };

  /**
   * Sends filter hits stats to backend server.
   * This method is used if user has enabled "Send statistics for ad filters usage".
   * More information about ad filters usage stats:
   * http://cyberpurify.com/en/filter-rules-statistics.html
   *
   * @param stats             Stats
   * @param enabledFilters    List of enabled filters
   */
  const sendHitStats = function (stats, enabledFilters) {
    let params = `stats=${encodeURIComponent(stats)}`;
    params += `&v=${encodeURIComponent(purify.app.getVersion())}`;
    params += `&b=${encodeURIComponent(purify.prefs.browser)}`;
    if (enabledFilters) {
      for (let i = 0; i < enabledFilters.length; i++) {
        const filter = enabledFilters[i];
        params += `&f=${encodeURIComponent(
          `${filter.filterId},${filter.version}`
        )}`;
      }
    }
    params = addKeyParameter(params);

    const request = new XMLHttpRequest();
    request.open("POST", settings.ruleStatsUrl);
    request.setRequestHeader(
      "Content-type",
      "application/x-www-form-urlencoded"
    );
    request.send(params);
  };

  /**
   * Allows to receive response headers from the request to the given URL
   * @param url URL
   * @param callback Callback with headers or null in the case of error
   */
  const getResponseHeaders = function (url, callback) {
    executeRequestAsync(
      url,
      "text/plain",
      (request) => {
        const arr = request
          .getAllResponseHeaders()
          .trim()
          .split(/[\r\n]+/);
        const headers = arr.map((line) => {
          const parts = line.split(": ");
          const header = parts.shift();
          const value = parts.join(": ");
          return {
            name: header,
            value,
          };
        });
        callback(headers);
      },
      (request) => {
        purify.console.error(
          "Error retrieved response from {0}, cause: {1}",
          url,
          request.statusText
        );
        callback(null);
      }
    );
  };

  /**
   * Configures backend's URLs
   * @param configuration Configuration object:
   * {
   *  filtersMetadataUrl: '...',
   *  filterRulesUrl: '...',
   *  localFiltersFolder: '...',
   *  localFilterIds: []
   * }
   */
  const configure = function (configuration) {
    const { filtersMetadataUrl } = configuration;
    if (filtersMetadataUrl) {
      Object.defineProperty(settings, "filtersMetadataUrl", {
        get() {
          return filtersMetadataUrl;
        },
      });
    }
    const { filterRulesUrl } = configuration;
    if (filterRulesUrl) {
      Object.defineProperty(settings, "filterRulesUrl", {
        get() {
          return filterRulesUrl;
        },
      });
    }
    const { localFiltersFolder } = configuration;
    if (localFiltersFolder) {
      Object.defineProperty(settings, "localFiltersFolder", {
        get() {
          return localFiltersFolder;
        },
      });
    }

    const { redirectSourcesFolder } = configuration;
    if (redirectSourcesFolder) {
      Object.defineProperty(settings, "redirectSourcesFolder", {
        get() {
          return redirectSourcesFolder;
        },
      });
    }

    const { localFilterIds } = configuration;
    if (localFilterIds) {
      Object.defineProperty(settings, "localFilterIds", {
        get() {
          return localFilterIds;
        },
      });
    }
  };

  return {
    loadFiltersMetadata,
    loadFilterRules,

    loadFilterRulesBySubscriptionUrl,

    loadLocalFiltersMetadata,
    loadLocalFiltersI18Metadata,
    loadLocalScriptRules,
    loadRedirectSources,

    lookupSafebrowsing,

    sendUrlReport,
    sendHitStats,
    executeRequestAsync,

    getResponseHeaders,

    configure,
  };
})(purify);
