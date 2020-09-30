

/* global chrome */

const api = window.browser || chrome;

let purify;

const getPurify = () =>
  new Promise((resolve) => {
    api.runtime.getBackgroundPage((bgPage) => {
      resolve(bgPage.purify);
    });
  });

function hideNodes(nodes) {
  nodes.forEach((node) => {
    node.style.display = "none";
  });
}

function onAdvancedClicked(advancedButton, moreInfoBtn, goButton) {
  moreInfoBtn.style.display = "block";
  goButton.style.display = "block";
  advancedButton.style.display = "none";
}

function isValid(param) {
  return param && param.indexOf("<") < 0;
}

const replaceHostTemplates = (nodes, host) => {
  nodes.forEach((node) => {
    const nodeContent = node.textContent || node.innerText;
    node.innerHTML = nodeContent.replace("(var.Host)", host);
  });
};

document.addEventListener("DOMContentLoaded", async () => {
  purify = await getPurify();

  const advancedBtn = document.getElementById("advancedButton");
  const moreInfoBtn = document.getElementById("moreInfoButton");
  const btnProceed = document.getElementById("btnProceed");

  const urlParams = new URLSearchParams(document.location.search);
  const host = urlParams.get("host");
  const url = urlParams.get("url");
  const malware = urlParams.get("malware");
  const isMalware = (malware && malware === "true") || true;

  const malwareNodes = [].slice.call(document.querySelectorAll(".malware"));
  const phishingNodes = [].slice.call(document.querySelectorAll(".phishing"));

  if (isMalware) {
    hideNodes(phishingNodes);
  } else {
    hideNodes(malwareNodes);
  }

  replaceHostTemplates(phishingNodes.concat(malwareNodes), host);

  if (host && isValid(host)) {
    const moreInfoUrl = `https://cyberpurify.com/site.html?domain=${host}&utm_source=extension&aid=16593`;
    moreInfoBtn.setAttribute("href", moreInfoUrl);
  }

  if (url && isValid(url)) {
    btnProceed.addEventListener("click", (e) => {
      e.preventDefault();
      purify.safebrowsing.addToSafebrowsingTrusted(url);
      purify.tabs.getActive((tab) => {
        purify.tabs.reload(tab.tabId, url);
      });
    });
  }

  advancedBtn.addEventListener("click", (e) => {
    e.preventDefault();
    onAdvancedClicked(advancedBtn, moreInfoBtn, btnProceed);
  });
});
