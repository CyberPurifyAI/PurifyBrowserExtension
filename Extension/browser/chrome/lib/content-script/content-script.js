/* global purifyContent */

(function (purify) {
  "use strict";

  window.i18n = purify.i18n;

  window.contentPage = {
    sendMessage: purify.runtimeImpl.sendMessage,
    onMessage: purify.runtimeImpl.onMessage,
  };
})(purifyContent);
