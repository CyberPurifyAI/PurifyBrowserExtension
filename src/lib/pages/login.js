/**
 * ----------------------------------------------------------------------------------
 * PurifyBrowserExtension login.js
 * Licensed under MIT (https://github.com/CyberPurify/CyberPurify/blob/main/LICENSE)
 * ----------------------------------------------------------------------------------
 */

const purifySSO = new Keycloak({
  url: "https://id.cyberpurify.com/auth",
  realm: "purify",
  clientId: "purify-extension",
});

const checkSSO = function (popup = false) {
  purifySSO
    .init({ onLoad: "check-sso", flow: "implicit" })
    .then(function (authenticated) {
      console.log(authenticated ? "authenticated" : "not authenticated");
      if (!authenticated && popup) {
        openPopupLogin();
      } else {
        updateUserInfo(purifySSO.idTokenParsed);
      }
    });
};

const openPopupLogin = function () {
  const popup = window.open(
    "https://sso.cyberpurify.com",
    "Purify SSO",
    "width=800,height=700"
  );

  if (window.focus) {
    popup.focus();
  }

  const popupTick = setInterval(function () {
    if (popup.closed) {
      clearInterval(popupTick);
      checkSSO();
    }
  }, 500);
};

const updateUserInfo = function (info) {
  contentPage.sendMessage({ type: "updateUserInfo", info }, (response) => {
    if (response.ready) {
      window.close();
    }
  });
};

document.addEventListener("DOMContentLoaded", () => {
  checkSSO(true);
});
