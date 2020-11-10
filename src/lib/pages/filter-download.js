/**
 * ----------------------------------------------------------------------------------
 * PurifyBrowserExtension filter-download.js
 * Licensed under MIT (https://github.com/CyberPurify/CyberPurify/blob/main/LICENSE)
 * ----------------------------------------------------------------------------------
 */

/* global Nanobar, contentPage */
document.addEventListener("DOMContentLoaded", () => {
  const nanobar = new Nanobar({
    classname: "adg-progress-bar",
  });

  nanobar.go(10);

  function onLoaded() {
    nanobar.go(100);
    setTimeout(() => {
      if (window) {
        contentPage.sendMessage({ type: "openThankYouPage" });
      }
    }, 2000);
  }

  function checkRequestFilterReady() {
    contentPage.sendMessage({ type: "checkRequestFilterReady" }, (response) => {
      if (response.ready) {
        onLoaded();
      } else {
        setTimeout(checkRequestFilterReady, 1000);
      }
    });
  }

  checkRequestFilterReady();
});
