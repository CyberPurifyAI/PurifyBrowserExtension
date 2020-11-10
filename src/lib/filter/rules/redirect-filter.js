/**
 * ----------------------------------------------------------------------------------
 * PurifyBrowserExtension redirect-filter.js
 * Licensed under MIT (https://github.com/CyberPurify/CyberPurify/blob/main/LICENSE)
 * ----------------------------------------------------------------------------------
 */

/* global purify, Redirects */

(function (purify, api) {
  "use strict";

  let redirects;

  api.RedirectFilterService = (function RedirectFilterService() {
    function setRedirectSources(rawYaml) {
      redirects = new Redirects(rawYaml);
    }

    function buildRedirectUrl(title) {
      if (!title) {
        return null;
      }

      const redirectSource = redirects.getRedirect(title);
      if (!redirectSource) {
        purify.console.debug(
          `There is no redirect source with title: "${title}"`
        );
        return null;
      }
      let { content, contentType } = redirectSource;
      // if contentType does not include "base64" string we convert it to base64
      const BASE_64 = "base64";
      if (!contentType.includes(BASE_64)) {
        content = window.btoa(content);
        contentType = `${contentType};${BASE_64}`;
      }

      return `data:${contentType},${content}`;
    }

    function hasRedirect(title) {
      return !!redirects.getRedirect(title);
    }

    return {
      setRedirectSources,
      hasRedirect,
      buildRedirectUrl,
    };
  })();
})(purify, purify.rules);
