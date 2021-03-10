/**
 * ----------------------------------------------------------------------------------
 * PurifyBrowserExtension wrappers.js
 * Licensed under MIT (https://github.com/CyberPurify/CyberPurify/blob/main/LICENSE)
 * ----------------------------------------------------------------------------------
 */

/* global contentPage, WeakSet */

/**
 * Function for injecting some helper API into page context, that is used by request wrappers.
 *
 * @param scriptName Unique script name
 * @param isInjected True means that we've already injected scripts in the contentWindow, i.e. wrapped request objects and passed message channel
 */
function injectPageScriptAPI(scriptName, isInjected) {
  "use strict";

  /**
   * If script have been injected into a frame via contentWindow then we can simply take the copy of messageChannel left for us by parent document
   * Otherwise creates new message channel that sends a message to the content-script to check if request should be allowed or not.
   */
  const messageChannel = isInjected
    ? window[scriptName]
    : (function () {
        // Save original postMessage and addEventListener functions to prevent webpage from tampering both.
        const postMessage = window.postMessage;
        const addEventListener = window.addEventListener;

        // Current request ID (incremented every time we send a new message)
        let currentRequestId = 0;
        const requestsMap = {};

        /**
         * Handles messages sent from the content script back to the page script.
         *
         * @param event Event with necessary data
         */
        const onMessageReceived = function (event) {
          if (
            !event.data ||
            !event.data.direction ||
            event.data.direction !== "to-page-script@purify"
          ) {
            return;
          }

          const requestData = requestsMap[event.data.requestId];
          if (requestData) {
            const wrapper = requestData.wrapper;
            requestData.onResponseReceived(wrapper, event.data.block);
            delete requestsMap[event.data.requestId];
          }
        };

        /**
         * @param url                The URL to which wrapped object is willing to connect
         * @param requestType        Request type ( WEBSOCKET )
         * @param wrapper            WebSocket wrapper instance
         * @param onResponseReceived Called when response is received
         */
        const sendMessage = function (
          url,
          requestType,
          wrapper,
          onResponseReceived
        ) {
          if (currentRequestId === 0) {
            // Subscribe to response when this method is called for the first time
            addEventListener.call(window, "message", onMessageReceived, false);
          }

          const requestId = ++currentRequestId;
          requestsMap[requestId] = {
            wrapper: wrapper,
            onResponseReceived: onResponseReceived,
          };

          const message = {
            requestId: requestId,
            direction: "from-page-script@purify",
            elementUrl: url,
            documentUrl: document.URL,
            requestType: requestType,
          };

          // Send a message to the background page to check if the request should be blocked
          postMessage.call(window, message, "*");
        };

        return {
          sendMessage: sendMessage,
        };
      })();

  /*
   * In some case Chrome won't run content scripts inside frames.
   * So we have to intercept access to contentWindow/contentDocument and manually inject wrapper script into this context
   *
   * Based on: https://github.com/adblockplus/adblockpluschrome/commit/1aabfb3346dc0821c52dd9e97f7d61b8c99cd707
   */
  const injectedToString = Function.prototype.toString.bind(
    injectPageScriptAPI
  );

  let injectedFramesAdd;
  let injectedFramesHas;
  if (window.WeakSet instanceof Function) {
    const injectedFrames = new WeakSet();
    injectedFramesAdd = WeakSet.prototype.add.bind(injectedFrames);
    injectedFramesHas = WeakSet.prototype.has.bind(injectedFrames);
  } else {
    const frames = [];
    injectedFramesAdd = function (el) {
      if (frames.indexOf(el) < 0) {
        frames.push(el);
      }
    };
    injectedFramesHas = function (el) {
      return frames.indexOf(el) >= 0;
    };
  }

  /**
   * Injects wrapper's script into passed window
   * @param contentWindow Frame's content window
   */
  function injectPageScriptAPIInWindow(contentWindow) {
    try {
      if (contentWindow && !injectedFramesHas(contentWindow)) {
        injectedFramesAdd(contentWindow);
        contentWindow[scriptName] = messageChannel; // Left message channel for the injected script
        const args = `'${scriptName}', true`;
        contentWindow.eval(`(${injectedToString()})(${args});`);
        delete contentWindow[scriptName];
      }
    } catch (e) {}
  }

  /**
   * Overrides access to contentWindow/contentDocument for the passed HTML element's interface (iframe, frame, object)
   * If the content of one of these objects is requested we will inject our wrapper script.
   * @param iface HTML element's interface
   */
  function overrideContentAccess(iface) {
    const contentWindowDescriptor = Object.getOwnPropertyDescriptor(
      iface.prototype,
      "contentWindow"
    );
    const contentDocumentDescriptor = Object.getOwnPropertyDescriptor(
      iface.prototype,
      "contentDocument"
    );

    // Apparently in HTMLObjectElement.prototype.contentWindow does not exist
    // in older versions of Chrome such as 42.
    if (!contentWindowDescriptor) {
      return;
    }

    const getContentWindow = Function.prototype.call.bind(
      contentWindowDescriptor.get
    );
    const getContentDocument = Function.prototype.call.bind(
      contentDocumentDescriptor.get
    );

    contentWindowDescriptor.get = function () {
      const contentWindow = getContentWindow(this);
      injectPageScriptAPIInWindow(contentWindow);
      return contentWindow;
    };
    contentDocumentDescriptor.get = function () {
      injectPageScriptAPIInWindow(getContentWindow(this));
      return getContentDocument(this);
    };

    Object.defineProperty(
      iface.prototype,
      "contentWindow",
      contentWindowDescriptor
    );
    Object.defineProperty(
      iface.prototype,
      "contentDocument",
      contentDocumentDescriptor
    );
  }

  const interfaces = [HTMLFrameElement, HTMLIFrameElement, HTMLObjectElement];
  for (let i = 0; i < interfaces.length; i += 1) {
    overrideContentAccess(interfaces[i]);
  }
}

/**
 * This function is executed in the content script. It starts listening to events from the page script and passes them further to the background page.
 */
const initPageMessageListener = function () {
  "use strict";

  /**
   * Listener for websocket wrapper messages.
   *
   * @param event
   */
  function pageMessageListener(event) {
    if (
      !(
        event.source === window &&
        event.data.direction &&
        event.data.direction === "from-page-script@purify" &&
        event.data.elementUrl &&
        event.data.documentUrl
      )
    ) {
      return;
    }

    const message = {
      type: "checkPageScriptWrapperRequest",
      elementUrl: event.data.elementUrl,
      documentUrl: event.data.documentUrl,
      requestType: event.data.requestType,
      requestId: event.data.requestId,
    };

    contentPage.sendMessage(message, function (response) {
      if (!response) {
        return;
      }

      const message = {
        direction: "to-page-script@purify",
        elementUrl: event.data.elementUrl,
        documentUrl: event.data.documentUrl,
        requestType: event.data.requestType,
        requestId: response.requestId,
        block: response.block,
      };

      event.source.postMessage(message, event.origin);
    });
  }

  window.addEventListener("message", pageMessageListener, false);
};
