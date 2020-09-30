
/* global Nanobar, contentPage */
document.addEventListener("DOMContentLoaded", () => {
  const nanobar = new Nanobar({
    classname: "adg-progress-bar",
  });

  nanobar.go(15);

  function onLoaded() {
    nanobar.go(100);
    setTimeout(() => {
      if (window) {
        contentPage.sendMessage({ type: "openThankYouPage" });
      }
    }, 1000);
  }

  function checkRequestFilterReady() {
    contentPage.sendMessage({ type: "checkRequestFilterReady" }, (response) => {
      if (response.ready) {
        onLoaded();
      } else {
        setTimeout(checkRequestFilterReady, 500);
      }
    });
  }

  checkRequestFilterReady();
});
