/**
 * ----------------------------------------------------------------------------------
 * PurifyBrowserExtension startup.js
 * Licensed under MIT (https://github.com/CyberPurify/CyberPurify/blob/main/LICENSE)
 * ----------------------------------------------------------------------------------
 */

/* global purify */

/**
 * Extension initialize logic. Called from start.js
 */
purify.initialize = function() {
    function onLocalStorageLoaded() {
        purify.console.info(
            "Starting purify... Version: {0}. Id: {1}",
            purify.app.getVersion(),
            purify.app.getId()
        );

        // Initialize popup button
        purify.browserAction.setPopup({
            popup: purify.getURL("pages/popup.html"),
        });

        // Set uninstall page url
        const uninstallUrl =
            "https://cyberpurify.com/wifi-device/?action=purify_uninstal_ext&from=background&app=browser_extension";
        purify.runtime.setUninstallURL(uninstallUrl, () => {
            if (purify.runtime.lastError) {
                purify.console.error(purify.runtime.lastError);
                return;
            }
            // purify.console.info(`Uninstall url was set to: ${uninstallUrl}`);
        });

        purify.ui.init();
        purify.whitelist.init();
        purify.hateSpeech.init();

        /**
         * Start application
         */
        purify.filters.start({
                onInstall(callback) {
                    // Process installation
                    /**
                     * Show UI installation page
                     */
                    purify.ui.openFiltersDownloadPage();

                    // Retrieve filters and install them
                    purify.filters.offerFilters((filterIds) => {
                        purify.filters.addAndEnableFilters(filterIds, callback);
                    });
                },
            },
            () => {
                // Doing nothing
            }
        );
    }

    // purify.purifyFiltering.init();
    // purify.loadingQueue.init();
    // purify.predictionQueue.init();
    // purify.parentalControl.init();

    purify.rulesStorage.init(() => {
        purify.localStorage.init(onLocalStorageLoaded);
    });
};