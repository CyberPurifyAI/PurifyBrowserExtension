/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */

import 'babel-polyfill';

import { imageClassifier } from './imagenet_classes';
import { toxicClassifier } from './toxicity';

import md5 from 'md5';

var BLACKLIST = [];
var CP_BLACKLIST = [];
var CP_TOPLIST = [];

/**
 *
 * @param {string} url
 * @returns string
 */
function extractHostname(url) {
    var hostname;
    // find & remove protocol (http, ftp, etc.) and get hostname

    if (url.indexOf("//") > -1)
        hostname = url.split('/')[2];
    else
        hostname = url.split('/')[0];

    //find & remove port number
    hostname = hostname.split(':')[0];
    //find & remove "?"
    hostname = hostname.split('?')[0];

    return hostname.replace("www.", "");
}

/**
 *
 * @param {string} url
 * @returns
 */
function extractRootDomain(url) {
    var domain = extractHostname(url),
        splitArr = domain.split('.'),
        arrLen = splitArr.length;

    // extracting the root domain here
    // if there is a subdomain
    if (arrLen > 2) {
        domain = splitArr[arrLen - 2] + '.' + splitArr[arrLen - 1];
        // check to see if it's using a Country Code Top Level Domain (ccTLD) (i.e. ".me.uk")
        if (splitArr[arrLen - 2].length == 2 && splitArr[arrLen - 1].length == 2) {
            // this is using a ccTLD
            domain = splitArr[arrLen - 3] + '.' + domain;
        }
    }
    return domain;
}

/**
 * * Kiểm tra domain có tồn tại BLACKLIST hoặc CP_BLACKLIST trong localStorage
 * @param {string} domain
 * @returns boolean
 */
function is_blacklist(domain) {
    return BLACKLIST.indexOf(domain) === -1 ? (CP_BLACKLIST.indexOf(domain) === -1 ? false : true) : true;
}

/**
 * * Kiểm tra domain có tồn tại trong WHITELIST
 * @param {string} domain
 * @returns true | false
 */
function is_toplist(domain) {
    // widecart thay vì phải declare cụ thể google.com với google.com.vn hay www.google.com thì chỉ cần google.com
    var d = extractHostname(domain);
    return CP_TOPLIST.indexOf(d) === -1 ? false : true;
}

chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
        switch (request.action) {
            case 'image_predict':
                request.id_tab = sender.tab.id;
                imageClassifier.analyzeImage(sendResponse, request);
                break;

            case 'hidetab':
                let domain = extractHostname(request.url);
                if (CP_BLACKLIST.indexOf(md5(domain)) === -1 && is_toplist(domain) == false) {
                    CP_BLACKLIST.push(md5(domain));
                    localStorage.setItem("cp_blacklist", JSON.stringify(CP_BLACKLIST));
                }
                /*
                 * sync Blocked host to backend
                 */
                let messages = {
                    action: "domain_blacklist",
                    clientId: purify.utils.browser.getClientId(),
                    link: sender.tab.url,
                    POSITIVE_IMAGES: request.POSITIVE_IMAGES,
                    timestamp: performance.now(),
                    user_agent: navigator.userAgent,
                    client_lang: navigator.language,
                };
                purify.parentalControl.syncBlacklist(messages);

                chrome.tabs.update(sender.tab.id, { url: chrome.extension.getURL("pages/blocking-pages/adBlockedPage.html") });
                break;

            case 'checkdomain':
                if (BLACKLIST.length == 0) {
                    if (localStorage.getItem("cp_blacklist") != null) {
                        CP_BLACKLIST = JSON.parse(localStorage.getItem("cp_blacklist"));
                        // console.log("CP_BLACKLIST --> " + localStorage.getItem("cp_blacklist"));
                    }
                    BLACKLIST = purify.whitelist.getBlockListedDomains();
                    CP_TOPLIST = purify.whitelist.getUnBlockListedDomains();
                }

                // purify.console.info(BLACKLIST.length);
                // purify.console.info(CP_TOPLIST.length);

                chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
                    if (tabs.length > 0) {
                        const domain = extractHostname(tabs[0].url);
                        // console.log("domain " + domain + " is_toplist " + is_toplist(domain));
                        // console.log(md5(domain), is_blacklist(md5(domain)), is_toplist(domain));
                        if ((is_blacklist(md5(domain)) == true) && is_toplist(domain) == false) {
                            chrome.tabs.update(sender.tab.id, { url: chrome.extension.getURL("pages/blocking-pages/adBlockedPage.html") });
                        }

                        // console.log(['background', request, sender, `${purify.hateSpeech.regexModelHateSpeech()}`]);
                        // chrome.tabs.sendMessage(sender.tab.id, { action: 'replace_hatespeech', regexModelHateSpeech: purify.hateSpeech.regexModelHateSpeech() });
                        // sendResponse({ action: 'replace_hatespeech', regexModelHateSpeech: purify.hateSpeech.regexModelHateSpeech() });
                    }
                });
                break;

            case 'toxicity_predict':
                toxicClassifier.predicting(sendResponse, request.toxicContentPredict);
                break;
        }
        return true;
    }
);