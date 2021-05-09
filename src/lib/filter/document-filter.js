/**
 * ----------------------------------------------------------------------------------
 * PurifyBrowserExtension document-filter.js
 * Licensed under MIT (https://github.com/CyberPurify/CyberPurify/blob/main/LICENSE)
 * ----------------------------------------------------------------------------------
 */

/* global purify */

(function(purify, api) {
    function documentFilterService() {
        const DOCUMENT_BLOCKED_URL = "pages/blocking-pages/adBlockedPage.html";

        /**
         * Return url of the document block page and ads there parameters with rule and url
         * @param url
         * @param ruleText
         * @returns {null|string}
         */
        const getDocumentBlockPageUrl = (url, ruleText) => {
            let blockingUrl = purify.getURL(DOCUMENT_BLOCKED_URL);

            blockingUrl += `?url=${encodeURIComponent(url)}`;
            blockingUrl += `&rule=${encodeURIComponent(ruleText)}`;

            return blockingUrl;
        };

        const verifyWhiteListDomains = (url) => {
            const whiteListRedirectDomains = [
                "facebook.com",
                "www.facebook.com",
                "linkedin.com",
                "www.linkedin.com",
                "cyberpurify.com",
                "www.cyberpurify.com",
                "youtube.com",
                "www.youtube.com",
                "youtu.be",
                "*.youtube.com",
                "*.googlevideo.com",
                "googleads.g.doubleclick.net",
                "google.com",
                "www.google.com",
                "doubleclick.net",
                "static.doubleclick.net"
            ];

            for (let i = 0; i < whiteListRedirectDomains.length; i++) {
                if (url.indexOf(whiteListRedirectDomains[i]) > -1) {
                    return true;
                }
            }
        };

        /**
         * Shows document block page
         * @param tabId
         * @param url
         */
        const showDocumentBlockPage = (tabId, url) => {
            if (verifyWhiteListDomains(url)) {
                return;
            }

            const incognitoTab = purify.frames.isIncognitoTab({ tabId });
            // Chromium browsers do not allow to show extension pages in incognito mode
            // Firefox allows, but on private pages do not work browser.runtime.getBackgroundPage()
            if (incognitoTab) {
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
            showDocumentBlockPage,
        };
    }

    api.documentFilterService = documentFilterService();
})(purify, purify.rules);