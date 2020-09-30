/**
 * This file is part of Purify Browser Extension (https://github.com/PurifyTeam/PurifyBrowserExtension).
 *
 * Purify Browser Extension is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Purify Browser Extension is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with Purify Browser Extension.  If not, see <http://www.gnu.org/licenses/>.
 */

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
