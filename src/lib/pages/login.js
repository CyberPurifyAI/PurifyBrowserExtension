/**
 * ----------------------------------------------------------------------------------
 * PurifyBrowserExtension login.js
 * Licensed under MIT (https://github.com/CyberPurify/CyberPurify/blob/main/LICENSE)
 * ----------------------------------------------------------------------------------
 */

let purifySSO = new Keycloak({
  url: "https://id.cyberpurify.com/auth",
  realm: "purify",
  clientId: "purify-extension",
});

const checkSSO = function () {
  purifySSO
    .init({ onLoad: "check-sso", flow: "implicit" })
    .then(function (authenticated) {
      console.log(authenticated ? "authenticated" : "not authenticated");
      if (authenticated) {
        window.close();
      }
    })
    .catch(function () {
      console.log("failed to initialize");
    });
};

let popup = window.open(
  "https://sso.cyberpurify.com",
  "Purify SSO",
  "width=800,height=700"
);

if (window.focus) {
  popup.focus();
}

var popupTick = setInterval(function () {
  if (popup.closed) {
    clearInterval(popupTick);
    checkSSO();
  }
}, 500);
