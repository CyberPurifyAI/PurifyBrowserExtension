/**
 * ----------------------------------------------------------------------------------
 * PurifyBrowserExtension purify-content.js
 * Licensed under MIT (https://github.com/CyberPurify/CyberPurify/blob/main/LICENSE)
 * ----------------------------------------------------------------------------------
 */

/**
 * Global object for content scripts.
 * !!! DO not change to const, because this variable will be redeclared in purify-api
 */
var purifyContent = {}; // eslint-disable-line no-unused-vars, no-var

var MIN_IMAGE_SIZE = 41;
var purifyRequestQueue = new Map();

/**
 * Unexpectedly global variable contentPage could become undefined in FF,
 * in this case we redefine it.
 *
 * More details:
 * https://github.com/CyberPurify/PurifyBrowserExtension/issues/924
 * https://github.com/CyberPurify/PurifyBrowserExtension/issues/880
 */
var getContentPage = function () {
  if (typeof contentPage === "undefined") {
    contentPage = {
      sendMessage: purifyContent.runtimeImpl.sendMessage,
      onMessage: purifyContent.runtimeImpl.onMessage,
      lastError: purifyContent.runtimeImpl.lastError,
    };
  }

  return contentPage;
};

/**
 * Watch Purify Content
 */
const imageDOMWatcher = function () {
  var MutationObserver =
    window.MutationObserver || window.WebKitMutationObserver;

  if (!MutationObserver) {
    return;
  }

  var observer = new MutationObserver(function (mutations) {
    for (let i = 0; i < mutations.length; i++) {
      var mutation = mutations[i];

      if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
        var images = document.getElementsByTagName("img");
        for (let x = 0; x < images.length; x++) {
          analyzeImage(images[x], false);
        }
      } else if (mutation.type === "attributes") {
        if (mutation.target.nodeName === "IMG") {
          analyzeImage(mutation.target, mutation.attributeName === "src");
        }
      }
    }
  });

  observer.observe(document, {
    characterData: false,
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["src"],
  });
};

const getBackgoundImages = function () {
  const srcChecker = /url\(\s*?['"]?\s*?(\S+?)\s*?["']?\s*?\)/i;

  const arrayImage = Array.from(
    Array.from(document.querySelectorAll("*")).reduce((collection, node) => {
      let prop = window
        .getComputedStyle(node, null)
        .getPropertyValue("background-image");

      let match = srcChecker.exec(prop);
      if (match) {
        let imageSrc = match[1];

        if (imageSrc.length > 0 && node.dataset.purify === undefined) {
          hideImage(node);
          node.dataset.purifyUrl = match[1];
          collection.add(node);
        }
      }
      return collection;
    }, new Set())
  );

  for (let i = 0; i < arrayImage.length; i++) {
    let node = arrayImage[i];

    getPredictImageResult(node, node.dataset.purifyUrl);
  }
};

const analyzeImage = function (image, srcAttribute) {
  if (
    image.src.length > 0 &&
    ((image.width > MIN_IMAGE_SIZE && image.height > MIN_IMAGE_SIZE) ||
      image.height === 0 ||
      image.width === 0)
  ) {
    if (srcAttribute || image.dataset.purify === undefined) {
      getPredictImageResult(image);
    }
  }
};

const getPredictImageResult = function (image, imageSrc = null) {
  hideImage(image);

  new Promise((resolve, reject) => {
    const requestUrl = imageSrc ? imageSrc : image.src;
    const purifyQueueName = requestUrl;

    const request = {
      type: "requestAnalyzeImage",
      requestUrl: requestUrl,
      imagesNum: document.images.length,
    };

    try {
      if (purifyRequestQueue.has(purifyQueueName)) {
        purifyRequestQueue.get(purifyQueueName)?.push([{ resolve, reject }]);
      } else {
        purifyRequestQueue.set(purifyQueueName, [[{ resolve, reject }]]);

        getContentPage().sendMessage(request, (response) => {
          if (
            chrome.runtime.lastError !== null &&
            chrome.runtime.lastError !== undefined
          ) {
            console.log(
              `[Purify] Cannot connect to background worker for ${request.url} image, error: ${message}`
            );

            purifyRequestQueue.delete(request.url);

            return;
          }

          if (response) {
            const { result, err } = response;
            image.dataset.purify = "purify";

            if (!result && !err) {
              showImage(image);
            } else {
              showImage(image);
              image.style.filter = "blur(100px)";
            }
          } else {
            // resolve(getContentPage().lastError);
            // showImage(image);
            image.dataset.purify = "error";
          }

          for (const [{ resolve }] of purifyRequestQueue.get(requestUrl)) {
            resolve(response);
          }

          purifyRequestQueue.delete(requestUrl);
        });
      }
    } catch {
      if (purifyRequestQueue.has(purifyQueueName)) {
        for (const [{ reject }] of purifyRequestQueue.get(purifyQueueName)) {
          reject(request);
        }
      } else {
        reject(request);
      }

      purifyRequestQueue.delete(purifyQueueName);
    }
  });
};

const hideImage = function (image) {
  if (image.parentNode?.nodeName === "BODY") {
    image.hidden = true;
  }

  image.dataset.purify = "processing";
  image.style.visibility = "hidden";
};

const showImage = function (image) {
  if (image.parentNode?.nodeName === "BODY") {
    image.hidden = false;
  }

  image.style.visibility = "visible";
};

if (window.self === window.top) {
  imageDOMWatcher();
}
