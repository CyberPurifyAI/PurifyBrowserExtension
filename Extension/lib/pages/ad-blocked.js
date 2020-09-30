/**
 * ----------------------------------------------------------------------------------
 * PurifyBrowserExtension ad-blocked.js
 * Licensed under MIT (https://github.com/cyberpurify/CyberPurify/blob/main/LICENSE)
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

const handleProceedAnyway = (url, rule) => {
  purify.rules.documentFilterService.addToTrusted(url, rule);
};

document.addEventListener("DOMContentLoaded", async () => {
  purify = await getPurify();

  const urlParams = new URLSearchParams(document.location.search);
  const blockRule = urlParams.get("rule");
  const url = urlParams.get("url");

  fillBlockRule(blockRule);

  // const proceedBtn = document.querySelector('#btnProceed');
  // proceedBtn.addEventListener('click', (e) => {
  //     e.preventDefault();
  //     handleProceedAnyway(url, blockRule);
  // });
});
