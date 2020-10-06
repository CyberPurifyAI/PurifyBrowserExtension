/**
 * ----------------------------------------------------------------------------------
 * PurifyBrowserExtension content-filtering.js
 * Licensed under MIT (https://github.com/CyberPurify/CyberPurify/blob/main/LICENSE)
 * ----------------------------------------------------------------------------------
 */

/* global TextDecoder, TextEncoder, DOMParser */

purify.contentFiltering = (function (purify) {
  var DEFAULT_CHARSET = "utf-8";
  var LATIN_1 = "iso-8859-1";
  var SUPPORTED_CHARSETS = [
    DEFAULT_CHARSET,
    "windows-1251",
    "windows-1252",
    LATIN_1,
  ];

  /**
   * Encapsulates response data filter logic
   * https://mail.mozilla.org/pipermail/dev-addons/2017-April/002729.html
   *
   * @param requestId Request identifier
   * @param charset encoding
   * @constructor
   */
  var ContentFilter = function (requestId, requestType, charset) {
    this.filter = purify.webRequest.filterResponseData(requestId);
    this.requestType = requestType;

    this.content = "";
    this.contentDfd = new purify.utils.Promise();

    this.initEncoders = () => {
      let set = this.charset ? this.charset : DEFAULT_CHARSET;

      // Redefining it as TextDecoder does not understand the iso- name
      if (set === LATIN_1) {
        set = "windows-1252";
      }

      this.decoder = new TextDecoder(set);
      if (set === DEFAULT_CHARSET) {
        this.encoder = new TextEncoder();
      } else {
        this.encoder = new TextEncoder(set, {
          NONSTANDARD_allowLegacyEncoding: true,
        });
      }
    };

    this.charset = charset;
    this.initEncoders();

    this.filter.ondata = (event) => {
      if (!this.charset) {
        try {
          var charset;
          /**
           * If this.charset is undefined and requestType is DOCUMENT or SUBDOCUMENT, we try
           * to detect charset from page <meta> tags
           */
          if (
            this.requestType === purify.RequestTypes.DOCUMENT ||
            this.requestType === purify.RequestTypes.SUBDOCUMENT
          ) {
            charset = this.parseCharset(event.data);
          }
          /**
           * If we fail to find charset from meta tags we set charset to 'iso-8859-1',
           * because this charset allows to decode and encode data without errors
           */
          if (!charset) {
            charset = LATIN_1;
          }
          if (charset && SUPPORTED_CHARSETS.indexOf(charset) >= 0) {
            this.charset = charset;
            this.initEncoders();
            this.content += this.decoder.decode(event.data, { stream: true });
          } else {
            // Charset is not supported
            this.disconnect(event.data);
          }
        } catch (e) {
          purify.console.warn(e);
          // on error we disconnect the filter from the request
          this.disconnect(event.data);
        }
      } else {
        this.content += this.decoder.decode(event.data, { stream: true });
      }
    };

    this.filter.onstop = () => {
      this.content += this.decoder.decode(); // finish stream
      this.contentDfd.resolve(this.content);
    };

    this.filter.onerror = () => {
      this.contentDfd.reject(this.filter.error);
    };

    this.disconnect = (data) => {
      this.filter.write(data);
      this.filter.disconnect();

      this.contentDfd.resolve(null);
    };

    this.write = function (content) {
      this.filter.write(this.encoder.encode(content));
      this.filter.close();
    };

    this.getContent = function () {
      return this.contentDfd;
    };

    /**
     * Parses charset from data, looking for:
     * <meta charset="utf-8" />
     * <meta http-equiv="Content-type" content="text/html; charset=utf-8" />
     *
     * @param data
     * @returns {*}
     */
    this.parseCharset = function (data) {
      var decoded = new TextDecoder("utf-8").decode(data).toLowerCase();
      var match = /<meta\s*charset\s*=\s*['"](.*?)['"]/.exec(decoded);
      if (match && match.length > 1) {
        return match[1].trim().toLowerCase();
      }

      match = /<meta\s*http-equiv\s*=\s*['"]?content-type['"]?\s*content\s*=\s*[\\]?['"]text\/html;\s*charset=(.*?)[\\]?['"]/.exec(
        decoded
      );
      if (match && match.length > 1) {
        return match[1].trim().toLowerCase();
      }

      return null;
    };
  };

  /**
   * For correctly applying replace or content rules we have to work with the whole response content.
   * This class allows read response fully.
   * See some details here: https://mail.mozilla.org/pipermail/dev-addons/2017-April/002729.html
   *
   * @constructor
   */
  var ResponseContentHandler = function () {
    this.handleResponse = function (
      requestId,
      requestUrl,
      requestType,
      charset,
      callback
    ) {
      var contentFilter = new ContentFilter(requestId, requestType, charset);

      contentFilter.getContent().then(
        function (content) {
          if (!content) {
            callback(null);
            return;
          }

          try {
            content = callback(content);
          } catch (ex) {
            purify.console.error(
              "Error while applying content filter to {0}. Error: {1}",
              requestUrl,
              ex
            );
          }
          contentFilter.write(content);
        },
        function (error) {
          purify.console.error(
            "An error has occurred in content filter for request {0} to {1} - {2}. Error: {3}",
            requestId,
            requestUrl,
            requestType,
            error
          );
          callback(null);
        }
      );
    };
  };

  var DocumentParser = function () {
    if (typeof DOMParser === "undefined") {
      purify.console.info("DOMParser object is not defined");
      this.parse = function () {
        return null;
      };
      return;
    }

    // parser and parsererrorNS could be cached on startup for efficiency
    var parser = new DOMParser();
    var errorneousParse = parser.parseFromString("<", "text/xml");
    var parsererrorNS = errorneousParse.getElementsByTagName("parsererror")[0]
      .namespaceURI;

    /**
     * Checking for parse errors
     * https://developer.mozilla.org/en-US/docs/Web/API/DOMParser#Error_handling
     * @param parsedDocument
     * @returns true if html cannot parsed
     */
    function isParseError(parsedDocument) {
      if (parsererrorNS === "http://www.w3.org/1999/xhtml") {
        return parsedDocument.getElementsByTagName("parsererror").length > 0;
      }
      return (
        parsedDocument.getElementsByTagNameNS(parsererrorNS, "parsererror")
          .length > 0
      );
    }

    /**
     * Parse html to document
     * @param html HTML content
     * @returns Document
     */
    this.parse = function (html) {
      var doc = parser.parseFromString(html, "text/html");
      if (isParseError(doc)) {
        return null;
      }
      return doc;
    };
  };

  var responseContentHandler = new ResponseContentHandler();
  var documentParser = new DocumentParser();

  /**
   * Contains mask of accepted request types for replace rules
   */
  var replaceRuleAllowedRequestTypeMask = (function () {
    var mask = 0;
    var replaceRuleAllowedRequestTypes = [
      purify.RequestTypes.DOCUMENT,
      purify.RequestTypes.SUBDOCUMENT,
      purify.RequestTypes.SCRIPT,
      purify.RequestTypes.STYLESHEET,
      purify.RequestTypes.XMLHTTPREQUEST,
    ];
    for (var i = 0; i < replaceRuleAllowedRequestTypes.length; i++) {
      var requestType = replaceRuleAllowedRequestTypes[i];
      mask |= purify.rules.UrlFilterRule.contentTypes[requestType];
    }
    return mask;
  })();

  /**
   * Parses charset from content-type header
   *
   * @param contentType
   * @returns {*}
   */
  var parseCharsetFromHeader = function (contentType) {
    if (!contentType) {
      return null;
    }

    contentType = contentType.toLowerCase();
    var match = /charset=(.*?)$/.exec(contentType);
    if (match && match.length > 1) {
      return match[1].toLowerCase();
    }

    return null;
  };

  /**
   * Contains collection of accepted content types for replace rules
   */
  var replaceRuleAllowedContentTypes = [
    "text/",
    "application/json",
    "application/xml",
    "application/xhtml+xml",
    "application/javascript",
    "application/x-javascript",
  ];

  /**
   * Checks if $replace rule should be applied to this request
   * @param requestType Request type
   * @param contentType Content-Type header value
   * @returns {boolean}
   */
  var shouldApplyReplaceRule = function (requestType, contentType) {
    // In case of .features or .features.responseContentFilteringSupported are not defined
    var responseContentFilteringSupported =
      purify.prefs.features &&
      purify.prefs.features.responseContentFilteringSupported;
    if (!responseContentFilteringSupported) {
      return false;
    }

    var requestTypeMask = purify.rules.UrlFilterRule.contentTypes[requestType];
    if (
      (requestTypeMask & replaceRuleAllowedRequestTypeMask) ===
      requestTypeMask
    ) {
      return true;
    }

    if (requestType === purify.RequestTypes.OTHER && contentType) {
      for (var i = 0; i < replaceRuleAllowedContentTypes.length; i++) {
        if (contentType.indexOf(replaceRuleAllowedContentTypes[i]) === 0) {
          return true;
        }
      }
    }

    return false;
  };

  /**
   * Checks if content filtration rules should by applied to this request
   * @param requestType Request type
   */
  var shouldApplyContentRules = function (requestType) {
    // In case of .features or .features.responseContentFilteringSupported are not defined
    var responseContentFilteringSupported =
      purify.prefs.features &&
      purify.prefs.features.responseContentFilteringSupported;
    if (!responseContentFilteringSupported) {
      return false;
    }

    return (
      requestType === purify.RequestTypes.DOCUMENT ||
      requestType === purify.RequestTypes.SUBDOCUMENT
    );
  };

  /**
   * Applies content rules to the document.
   * If document wasn't modified then method will return null
   * @param {object} tab Tab
   * @param {string} requestUrl Request URL
   * @param {string} referrerUrl Referrer
   * @param {string} requestType Request type
   * @param {string} requestId Request identifier
   * @param {object} doc Document
   * @param {Array} rules Content rules
   * @returns null or document html
   */
  function applyContentRules(
    tab,
    requestUrl,
    referrerUrl,
    requestType,
    requestId,
    doc,
    rules
  ) {
    var deleted = [];

    for (var i = 0; i < rules.length; i++) {
      var rule = rules[i];
      var elements = rule.getMatchedElements(doc);
      if (elements) {
        for (var j = 0; j < elements.length; j++) {
          var element = elements[j];
          if (element.parentNode && deleted.indexOf(element) < 0) {
            element.parentNode.removeChild(element);
            purify.requestContextStorage.bindContentRule(
              requestId,
              rule,
              purify.utils.strings.elementToString(element)
            );
            deleted.push(element);
          }
        }
      }
    }

    // Add <!DOCTYPE html ... >
    // https://github.com/CyberPurify/PurifyBrowserExtension/issues/959
    // XMLSerializer is used to serialize doctype object
    var doctype = doc.doctype
      ? new XMLSerializer().serializeToString(doc.doctype) + "\r\n"
      : "";
    return deleted.length > 0 ? doctype + doc.documentElement.outerHTML : null;
  }

  function applyReplaceRules(
    tab,
    requestUrl,
    requestId,
    content,
    replaceRules
  ) {
    let modifiedContent = content;
    let appliedRules = [];

    // Sort replace rules alphabetically as noted here
    // https://github.com/CyberPurify/CoreLibs/issues/45
    const sortedReplaceRules = replaceRules.sort((prev, next) => {
      if (prev.ruleText > next.ruleText) {
        return 1;
      }
      if (prev.ruleText < next.ruleText) {
        return -1;
      }
      return 0;
    });

    for (let i = 0; i < sortedReplaceRules.length; i += 1) {
      const replaceRule = sortedReplaceRules[i];
      if (replaceRule.whiteListRule) {
        appliedRules.push(replaceRule);
      } else {
        const replaceOption = replaceRule.getReplace();
        modifiedContent = replaceOption.apply(modifiedContent);
        appliedRules.push(replaceRule);
      }
    }

    if (modifiedContent) {
      content = modifiedContent;
    }

    if (appliedRules.length > 0) {
      purify.requestContextStorage.update(requestId, {
        replaceRules: appliedRules,
      });
    }

    return content;
  }

  /**
   * Applies replace/content rules to the content
   * @param {object} tab
   * @param {string} requestUrl
   * @param {string} referrerUrl
   * @param {string} requestType
   * @param {string} requestId
   * @param {Array} contentRules
   * @param {Array} replaceRules
   * @param {string} content
   * @returns {string} Modified content
   */
  const applyRulesToContent = (
    tab,
    requestUrl,
    referrerUrl,
    requestType,
    requestId,
    contentRules,
    replaceRules,
    content
  ) => {
    if (!content) {
      return content;
    }

    if (contentRules && contentRules.length > 0) {
      var doc = documentParser.parse(content);
      if (doc !== null) {
        var modified = applyContentRules(
          tab,
          requestUrl,
          referrerUrl,
          requestType,
          requestId,
          doc,
          contentRules
        );
        if (modified !== null) {
          content = modified;
        }
      }
    }

    // response content is over 3MB, ignore it
    if (content.length > 3 * 1024 * 1024) {
      return content;
    }

    if (replaceRules) {
      const modifiedContent = applyReplaceRules(
        tab,
        requestUrl,
        requestId,
        content,
        replaceRules
      );
      if (modifiedContent !== null) {
        content = modifiedContent;
      }
    }

    return content;
  };

  /**
   * Applies content and replace rules to the request
   * @param tab Tab
   * @param requestUrl Request URL
   * @param referrerUrl Referrer
   * @param requestType Request type
   * @param requestId Request identifier
   * @param statusCode Request status
   * @param method Request method
   * @param contentType Content-Type header
   */
  var apply = function (
    tab,
    requestUrl,
    referrerUrl,
    requestType,
    requestId,
    statusCode,
    method,
    contentType
  ) {
    if (statusCode !== 200) {
      purify.console.debug(
        "Skipping request to {0} - {1} with status {2}",
        requestUrl,
        requestType,
        statusCode
      );
      return;
    }

    if (method !== "GET" && method !== "POST") {
      purify.console.debug(
        "Skipping request to {0} - {1} with method {2}",
        requestUrl,
        requestType,
        method
      );
      return;
    }

    var charset = parseCharsetFromHeader(contentType);
    if (charset && SUPPORTED_CHARSETS.indexOf(charset) < 0) {
      // Charset is detected and it is not supported
      purify.console.warn(
        "Skipping request to {0} - {1} with Content-Type {2}",
        requestUrl,
        requestType,
        contentType
      );
      return;
    }

    let contentRules = null;
    let replaceRules = null;

    if (shouldApplyContentRules(requestType)) {
      contentRules = purify.webRequestService.getContentRules(tab, requestUrl);
      if (contentRules && contentRules.length === 0) {
        contentRules = null;
      }
    }

    if (shouldApplyReplaceRule(requestType, contentType)) {
      replaceRules = purify.webRequestService.getReplaceRules(
        tab,
        requestUrl,
        referrerUrl,
        requestType
      );
      if (replaceRules && replaceRules.length === 0) {
        replaceRules = null;
      }
    }

    if (!contentRules && !replaceRules) {
      return;
    }

    // Call this method to prevent removing context on request complete/error event
    purify.requestContextStorage.onContentModificationStarted(requestId);

    responseContentHandler.handleResponse(
      requestId,
      requestUrl,
      requestType,
      charset,
      (content) => {
        try {
          return applyRulesToContent(
            tab,
            requestUrl,
            referrerUrl,
            requestType,
            requestId,
            contentRules,
            replaceRules,
            content
          );
        } finally {
          purify.requestContextStorage.onContentModificationFinished(requestId);
        }
      }
    );
  };

  return {
    apply: apply,
  };
})(purify);
