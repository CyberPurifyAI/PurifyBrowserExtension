/* global adguard */

/**
 * Extension initialize logic. Called from start.js
 */
adguard.initialize = function () {
  function onLocalStorageLoaded() {
    adguard.console.info(
      "Starting adguard... Version: {0}. Id: {1}",
      adguard.app.getVersion(),
      adguard.app.getId()
    );

    // Initialize popup button
    adguard.browserAction.setPopup({
      popup: adguard.getURL("pages/popup.html"),
    });

    // Set uninstall page url
    const uninstallUrl =
      "https://cyberpurify.com/forward.html?action=adguard_uninstal_ext&from=background&app=browser_extension";
    adguard.runtime.setUninstallURL(uninstallUrl, () => {
      if (adguard.runtime.lastError) {
        adguard.console.error(adguard.runtime.lastError);
        return;
      }
      adguard.console.info(`Uninstall url was set to: ${uninstallUrl}`);
    });

    tf.enableProdMode();
    adguard.nsfwFiltering.initialize();

    adguard.whitelist.init();
    adguard.filteringLog.init();
    adguard.ui.init();

    /**
     * Start application
     */
    adguard.filters.start(
      {
        onInstall(callback) {
          // Process installation
          /**
           * Show UI installation page
           */
          adguard.ui.openFiltersDownloadPage();

          // Retrieve filters and install them
          adguard.filters.offerFilters((filterIds) => {
            adguard.filters.addAndEnableFilters(filterIds, callback);
          });
        },
      },
      () => {
        // Doing nothing
      }
    );
  }

  adguard.rulesStorage.init(() => {
    adguard.localStorage.init(onLocalStorageLoaded);
  });
};
