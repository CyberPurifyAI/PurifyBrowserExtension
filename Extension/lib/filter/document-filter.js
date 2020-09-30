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

/* global purify */

(function (purify, api) {
  const {
    utils: { url: urlUtils },
  } = purify;

  const trustedCache = {
    get cache() {
      return purify.lazyGet(
        trustedCache,
        "cache",
        () => new purify.utils.ExpiringCache("document-block-cache")
      );
    },
  };

  function documentFilterService() {
    const TRUSTED_TTL_MS = 1000 * 60 * 40; // 40 minutes
    const DOCUMENT_BLOCKED_URL = "pages/blocking-pages/adBlockedPage.html";

    /**
     * Checks if url is trusted
     * @param url
     * @returns {boolean}
     */
    const isTrusted = (url) => {
      const host = urlUtils.getHost(url);
      if (!host) {
        return false;
      }
      const value = trustedCache.cache.getValue(host);
      return !!value;
    };

    /**
     * Return url of the document block page and ads there parameters with rule and url
     * @param url
     * @param ruleText
     * @returns {null|string}
     */
    const getDocumentBlockPageUrl = (url, ruleText) => {
      if (isTrusted(url)) {
        return null;
      }

      let blockingUrl = purify.getURL(DOCUMENT_BLOCKED_URL);

      blockingUrl += `?url=${encodeURIComponent(url)}`;
      blockingUrl += `&rule=${encodeURIComponent(ruleText)}`;

      return blockingUrl;
    };

    /**
     * Gets url host and adds it to the cache of trusted domains
     * @param url
     */
    const addToTrusted = (url) => {
      const host = urlUtils.getHost(url);
      if (!host) {
        return;
      }
      trustedCache.cache.saveValue(host, { host }, Date.now() + TRUSTED_TTL_MS);
      // Reloads ad-blocked page with trusted url
      purify.tabs.getActive((tab) => {
        purify.tabs.reload(tab.tabId, url);
      });
    };

    /**
     * Shows document block page
     * @param tabId
     * @param url
     */
    const showDocumentBlockPage = (tabId, url) => {
      const incognitoTab = purify.frames.isIncognitoTab({ tabId });
      // Chrome doesn't allow to show extension pages in incognito mode
      if (purify.utils.browser.isChromium() && incognitoTab) {
        // Closing tab before opening a new one may lead to browser crash (Chromium)
        purify.ui.openTab(url, {}, () => {
          purify.tabs.remove(tabId);
        });
      } else {
        purify.tabs.updateUrl(tabId, url);
      }
    };

    return {
      getDocumentBlockPageUrl,
      addToTrusted,
      showDocumentBlockPage,
    };
  }

  api.documentFilterService = documentFilterService();
})(purify, purify.rules);
