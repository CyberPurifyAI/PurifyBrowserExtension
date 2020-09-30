/**
 * ----------------------------------------------------------------------------------
 * PurifyBrowserExtension content-script.js
 * Licensed under MIT (https://github.com/cyberpurify/CyberPurify/blob/main/LICENSE)
 * ----------------------------------------------------------------------------------
 */

/* global purifyContent */

(function (purify) {
  "use strict";

  window.i18n = purify.i18n;

  window.contentPage = {
    sendMessage: purify.runtimeImpl.sendMessage,
    onMessage: purify.runtimeImpl.onMessage,
  };
})(purifyContent);
