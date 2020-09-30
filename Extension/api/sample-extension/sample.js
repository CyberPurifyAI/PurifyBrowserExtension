/* global purifyApi */
/* eslint-disable no-console */

// Init the configuration
const configuration = {
  // Purify English filter alone
  filters: [2],

  // Purify is disabled on www.avira.com
  whitelist: ["www.avira.com"],

  // Array of custom rules
  rules: ["example.org##h1"],

  // Filters metadata file path
  filtersMetadataUrl:
    "https://filters.adtidy.org/extension/chromium/filters.json",

  // Filter file mask
  filterRulesUrl:
    "https://filters.adtidy.org/extension/chromium/filters/{filter_id}.txt",
};

// Add event listener for blocked requests
const onBlocked = function (details) {
  console.log(details);
};

purifyApi.onRequestBlocked.addListener(onBlocked);

purifyApi.start(configuration, () => {
  console.log("Finished Purify API initialization.");

  // Now we want to disable Purify on www.google.com
  configuration.whitelist.push("www.google.com");
  purifyApi.configure(configuration, () => {
    console.log("Finished Purify API re-configuration");
  });
});

// Disable Purify in 1 minute
setTimeout(() => {
  purifyApi.onRequestBlocked.removeListener(onBlocked);
  purifyApi.stop(() => {
    console.log("Purify API has been disabled.");
  });
}, 60 * 1000);
