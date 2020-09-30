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

/* global contentPage, HTMLDocument */

(function () {
  if (window !== window.top) {
    return;
  }

  if (!(document instanceof HTMLDocument)) {
    return;
  }

  /**
   * On extension startup contentPage is undefined
   */
  if (typeof contentPage === "undefined") {
    return;
  }

  const MAX_Z_INDEX = "2147483647";

  /**
   * Creates iframe and appends it after target open tag
   * @param target Node where to append iframe with html
   * @param html html string to write inside iframe
   * @returns {HTMLElement} iframe element
   */
  const appendIframe = (target, html) => {
    const iframe = document.createElement("iframe");
    target.insertAdjacentElement("afterbegin", iframe);
    iframe.src = "about:blank";
    if (navigator.userAgent.indexOf("Edge") > -1) {
      // Edge doesn't allow to write html in iframe srcdoc
      const iframedoc = iframe.contentDocument || iframe.contentWindow.document;
      iframedoc.open();
      iframedoc.write(html);
      iframedoc.close();
    } else {
      iframe.srcdoc = html;
    }
    iframe.style.zIndex = MAX_Z_INDEX;
    return iframe;
  };

  /**
   * Creates div and appends it to the page
   * @param target
   * @param html
   * @returns {any | HTMLElement}
   */
  const appendDiv = (target, html) => {
    const div = document.createElement("div");
    div.innerHTML = html;
    target.insertAdjacentElement("afterbegin", div);
    div.style.zIndex = MAX_Z_INDEX;
    return div;
  };

  /**
   * If isPurifyTab we append div, else we append iframe
   * @param target
   * @param html
   * @param isPurifyTab
   * @returns {HTMLElement}
   */
  const appendAlertElement = (target, html, isPurifyTab) => {
    if (isPurifyTab) {
      return appendDiv(target, html);
    }
    return appendIframe(target, html);
  };

  /**
   * Generates alert html
   * @param {string} title
   * @param {string} text
   * @returns {string}
   */
  const genAlertHtml = (title, text) => {
    let descBlock = "";
    if (text && text.length > 0) {
      descBlock = `<div class="purify-popup-alert__desc">
                            ${text}
                        </div>`;
    }

    // don't show description text if it is same as title or if it is equal to undefined
    if (title === text || text === "undefined") {
      descBlock = "";
    }

    let titleBlock = "";
    if (title && title.length > 0) {
      titleBlock = `<div class="purify-popup-alert__title">
                            ${title}
                        </div>`;
    }

    return `<div class="purify-popup-alert">
                    ${titleBlock}
                    ${descBlock}
                </div>`;
  };

  /**
   * Shows alert popup.
   * Popup content is added right to the page content.
   *
   * @param message Message text
   */
  function showAlertPopup(message) {
    const { text, title, isPurifyTab } = message;

    if (!title && !text) {
      return;
    }

    let messages = [];
    if (Array.isArray(text)) {
      messages = text;
    } else {
      messages = [text];
    }

    let fullText = "";
    for (let i = 0; i < messages.length; i += 1) {
      if (i > 0) {
        fullText += ", ";
      }
      fullText += messages[i];
    }

    const alertDivHtml = genAlertHtml(title, fullText);

    const triesCount = 10;

    function appendPopup(count) {
      if (count >= triesCount) {
        return;
      }

      if (document.body) {
        const alertElement = appendAlertElement(
          document.body,
          alertDivHtml,
          isPurifyTab
        );
        alertElement.classList.add("purify-alert-iframe");
        setTimeout(() => {
          if (alertElement && alertElement.parentNode) {
            alertElement.parentNode.removeChild(alertElement);
          }
        }, 4000);
      } else {
        setTimeout(() => {
          appendPopup(count + 1);
        }, 500);
      }
    }

    appendPopup(0);
  }

  /**
   * Shows version updated popup.
   * Popup content is added right to the page content.
   *
   * @param {{title,description, changelogHref, changelogText, offer, offerButtonHref, offerButtonText}} message
   */
  function showVersionUpdatedPopup(message) {
    const {
      title,
      description,
      changelogHref,
      changelogText,
      offer,
      offerButtonHref,
      offerButtonText,
      disableNotificationText,
      isPurifyTab,
    } = message;

    const updateIframeHtml = `<head></head>
                            <body>
                            <div id="purify-new-version-popup" class="purify-update-popup purify-update-popup--active">
                                <div id="purify-new-version-popup-close" class="purify-update-popup__close close-iframe"></div>
                                <div class="purify-update-popup__logo"></div>
                                <div class="purify-update-popup__title">
                                    ${title}
                                </div>
                                <div class="purify-update-popup__desc">
                                    ${description}
                                </div>
                                <div class="purify-update-popup__links">
                                    <a href="${changelogHref}" class="purify-update-popup__link close-iframe" target="_blank">
                                        ${changelogText}
                                    </a>
                                    <a href="#" class="purify-update-popup__link purify-update-popup__link--disable close-iframe disable-notifications">
                                        ${disableNotificationText}
                                    </a>
                                </div>
                                <div class="purify-update-popup__offer">
                                    ${offer}
                                </div>
                                <a href="${offerButtonHref}" class="purify-update-popup__btn close-iframe" target="_blank">
                                    ${offerButtonText}
                                </a>
                            </div>
                            </body>`;

    const triesCount = 10;

    const handleCloseIframe = (iframe) => {
      const iframeDocument =
        iframe.contentDocument || iframe.contentWindow.document;
      const closeElements = iframeDocument.querySelectorAll(".close-iframe");
      if (closeElements.length > 0) {
        closeElements.forEach((element) => {
          element.addEventListener("click", () => {
            if (element.classList.contains("disable-notifications")) {
              // disable update notifications
              contentPage.sendMessage({
                type: "changeUserSetting",
                key: "show-app-updated-disabled",
                value: true,
              });
            }
            // Remove iframe after click event fire on link
            setTimeout(() => {
              iframe.parentNode.removeChild(iframe);
            }, 0);
          });
        });
        return true;
      }
      return false;
    };

    function appendPopup(count) {
      if (count >= triesCount) {
        return;
      }

      if (document.body && !isPurifyTab) {
        const iframe = appendIframe(document.body, updateIframeHtml);
        iframe.classList.add("purify-update-iframe");
        const isListening = handleCloseIframe(iframe);
        if (!isListening) {
          iframe.addEventListener("load", () => {
            handleCloseIframe(iframe);
          });
        }
      } else {
        setTimeout(() => {
          appendPopup(count + 1);
        }, 500);
      }
    }

    appendPopup(0);
  }

  /**
   * Reload page without cache
   */
  function noCacheReload() {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", document.location.href);
    xhr.setRequestHeader("Pragma", "no-cache");
    xhr.setRequestHeader("Expires", "-1");
    xhr.setRequestHeader("Expires", "no-cache");
    xhr.onload = xhr.onerror = xhr.onabort = xhr.ontimeout = function () {
      document.location.reload(true);
    };
    xhr.send(null);
  }

  contentPage.onMessage.addListener((message) => {
    if (message.type === "show-alert-popup") {
      showAlertPopup(message);
    } else if (message.type === "show-version-updated-popup") {
      showVersionUpdatedPopup(message);
    } else if (message.type === "no-cache-reload") {
      noCacheReload();
    } else if (message.type === "update-tab-url") {
      window.location = message.url;
    }
  });
})();
