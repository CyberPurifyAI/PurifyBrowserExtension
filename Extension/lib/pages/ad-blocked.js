/**
 * ----------------------------------------------------------------------------------
 * PurifyBrowserExtension ad-blocked.js
 * Licensed under MIT (https://github.com/CyberPurify/CyberPurify/blob/main/LICENSE)
 * ----------------------------------------------------------------------------------
 */

/* global chrome */

let purify;

const getPurify = () =>
  new Promise((resolve) => {
    const api = window.browser || chrome;
    api.runtime.getBackgroundPage((bgPage) => {
      resolve(bgPage.purify);
    });
  });

const fillBlockRule = (blockRule) => {
  const blockRuleNode = document.querySelector("#blockRule");
  blockRuleNode.textContent = blockRule;
};

document.addEventListener("DOMContentLoaded", async () => {
  purify = await getPurify();

  const urlParams = new URLSearchParams(document.location.search);
  const blockRule = urlParams.get("rule");

  fillBlockRule(blockRule);
});
