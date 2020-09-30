/* global chrome */

let adguard;

const getAdguard = () =>
  new Promise((resolve) => {
    const api = window.browser || chrome;
    api.runtime.getBackgroundPage((bgPage) => {
      resolve(bgPage.adguard);
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
  adguard = await getAdguard();

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
