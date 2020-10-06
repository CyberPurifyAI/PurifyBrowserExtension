/**
 * ----------------------------------------------------------------------------------
 * PurifyBrowserExtension subscribe.js
 * Licensed under MIT (https://github.com/CyberPurify/CyberPurify/blob/main/LICENSE)
 * ----------------------------------------------------------------------------------
 */

/* global HTMLDocument, contentPage */

(function () {
  if (!(document instanceof HTMLDocument)) {
    return;
  }

  const getSubscriptionParams = (urlParams) => {
    let title = null;
    let url = null;

    for (let i = 0; i < urlParams.length; i += 1) {
      const parts = urlParams[i].split("=", 2);
      if (parts.length !== 2) {
        continue;
      }
      switch (parts[0]) {
        case "title":
          title = decodeURIComponent(parts[1]);
          break;
        case "location":
          url = decodeURIComponent(parts[1]);
          break;
        default:
          break;
      }
    }

    return {
      title,
      url,
    };
  };

  const onLinkClicked = function (e) {
    if (e.button === 2) {
      // ignore right-click
      return;
    }

    let { target } = e;
    while (target) {
      if (target instanceof HTMLAnchorElement) {
        break;
      }
      target = target.parentNode;
    }

    if (!target) {
      return;
    }

    if (target.protocol === "http:" || target.protocol === "https:") {
      if (
        target.host !== "subscribe.adblockplus.org" ||
        target.pathname !== "/"
      ) {
        return;
      }
    } else if (
      !(
        /^abp:\/*subscribe\/*\?/i.test(target.href) ||
        /^purify:\/*subscribe\/*\?/i.test(target.href)
      )
    ) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    let urlParams;
    if (target.search) {
      urlParams = target.search.substring(1).replace(/&amp;/g, "&").split("&");
    } else {
      const { href } = target;
      const index = href.indexOf("?");
      urlParams = href
        .substring(index + 1)
        .replace(/&amp;/g, "&")
        .split("&");
    }

    const subParams = getSubscriptionParams(urlParams);
    const url = subParams.url.trim();
    const title = (subParams.title || url).trim();

    if (!url) {
      return;
    }

    contentPage.sendMessage({
      type: "addFilterSubscription",
      url,
      title,
    });
  };

  document.addEventListener("click", onLinkClicked);
})();
