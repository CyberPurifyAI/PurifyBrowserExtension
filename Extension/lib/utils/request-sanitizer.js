

/* global browser, purify */

/**
 * Request sanitizer helper
 * Removes track-able data from extension initiated requests
 */
(function (purify) {
  /**
   * On before send headers listener
   *
   * @param req
   * @return {{requestHeaders: *}}
   */
  const safeFilter = (req) => {
    const { requestHeaders, initiator, tabId, originUrl } = req;

    if (tabId !== purify.BACKGROUND_TAB_ID) {
      return;
    }

    let requestHeadersModified = false;

    // Chrome provides "initiator" and firefox "originUrl"
    const origin = initiator || originUrl;
    if (purify.app.isOwnRequest(origin)) {
      requestHeadersModified = purify.utils.browser.removeHeader(
        requestHeaders,
        "Cookie"
      );
    }

    if (requestHeadersModified) {
      return {
        requestHeaders,
      };
    }
  };

  // Firefox doesn't allow to use "extraHeaders" extra option,
  //  but chrome requires it in order to get access to "Cookie" header
  const onBeforeSendHeadersExtraInfoSpec = ["requestHeaders", "blocking"];
  if (
    typeof browser.webRequest.OnBeforeSendHeadersOptions !== "undefined" &&
    browser.webRequest.OnBeforeSendHeadersOptions.hasOwnProperty(
      "EXTRA_HEADERS"
    )
  ) {
    onBeforeSendHeadersExtraInfoSpec.push("extraHeaders");
  }

  browser.webRequest.onBeforeSendHeaders.addListener(
    safeFilter,
    {
      urls: ["<all_urls>"],
      tabId: purify.BACKGROUND_TAB_ID,
    },
    onBeforeSendHeadersExtraInfoSpec
  );
})(purify, browser);
