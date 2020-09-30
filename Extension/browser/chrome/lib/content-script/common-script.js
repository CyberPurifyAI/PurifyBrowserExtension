/**
 * ----------------------------------------------------------------------------------
 * PurifyBrowserExtension common-script.js
 * Licensed under MIT (https://github.com/cyberpurify/CyberPurify/blob/main/LICENSE)
 * ----------------------------------------------------------------------------------
 */

/* global purifyContent */

(function (purify, self) {
  "use strict";

  /**
   * https://bugs.chromium.org/p/project-zero/issues/detail?id=1225&desc=6
   * Page script can inject global variables into the DOM,
   * so content script isolation doesn't work as expected
   * So we have to make additional check before accessing a global variable.
   */
  function isDefined(property) {
    return Object.prototype.hasOwnProperty.call(self, property);
  }

  const browserApi =
    isDefined("browser") && self.browser !== undefined
      ? self.browser
      : self.chrome;

  purify.i18n = browserApi.i18n;

  purify.runtimeImpl = (function () {
    const onMessage = (function () {
      if (browserApi.runtime && browserApi.runtime.onMessage) {
        // Chromium, Edge, Firefox WebExtensions
        return browserApi.runtime.onMessage;
      }
      // Old Chromium
      return browserApi.extension.onMessage || browserApi.extension.onRequest;
    })();

    const sendMessage = (function () {
      if (browserApi.runtime && browserApi.runtime.sendMessage) {
        // Chromium, Edge, Firefox WebExtensions
        return browserApi.runtime.sendMessage;
      }
      // Old Chromium
      return (
        browserApi.extension.sendMessage || browserApi.extension.sendRequest
      );
    })();

    return {
      onMessage,
      sendMessage,
    };
  })();
})(typeof purifyContent !== "undefined" ? purifyContent : purify, this); // jshint ignore:line
