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

import md5 from 'md5';

const THIS_DOMAIN = window.location.hostname;
var process_images = [],
    urlRegex = /url\((?!['"]?(?:data|http):)['"]?([^'"\)]*)['"]?\)/i;

var ban_image = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBwgIBwcHCAcHBwcHBwoHBwcHBw8ICQcKFREiFhURExMYHCggGCYlGxMTITEhMSkrLi4uFx8zODMsNygtLisBCgoKDQ0NDg0NDy0ZFRk3NysrKysrKysrKysrKysrKysrKys3KysrKysrKysrKysrKysrKysrKysrKysrKysrK//AABEIAKgBLAMBIgACEQEDEQH/xAAYAAEBAQEBAAAAAAAAAAAAAAAAAQIHA//EABYQAQEBAAAAAAAAAAAAAAAAAAABEf/EABcBAQEBAQAAAAAAAAAAAAAAAAABAgP/xAAYEQEBAQEBAAAAAAAAAAAAAAAAARESAv/aAAwDAQACEQMRAD8A7eAAAAACAAAAAAIoCAAgqAAAgqAgoCCgIKACgIKAKAKCgAAAAAAAAgoCCgIKAgqAIqAIoCAAAAAAAoIKAgoCKACigAACAKAAAAAAAAAAAAigIACCgIKAgoCCgIKAAAAAigAoAIAAIDQoCCgIKAgoCCgIKAgoCCgIKAgoCCgIKAgAAAAICiAKgUAQAABsAAAAAAAAAAAAAAAAAAAAEAAAEAUQAAAAAABBQEFAaAAAAAAAAAAAAAAAABAVAABAVAEEAAAFEAURRQAAAAFBQAAAAAAAAAAAAAEAAEBUAQEAAAAQRQBQABUAUAUUAAAUAAAAAAAAAAACotQAABFQBAQBA1AQNFEDTFEDTFVlTRRA0URTVVWVBVRVAAAAAAAAAAAACotQAEQEVE0QETVE0TU0xdNZ01OjF01nTU6Ma1dY006XG9NZ01ejGtNZ1ToxpWVXTGosZWLKjSpFaiACgAAAAAAAAABUWoAi1mpVKhWaxaoJqWsauGpalrNrF9LjWprOprPS43prGmp2uN6axpp0Y3q689XV6Mb1dY1ZV6TG5VYlalalTG41GI1G5UrUaZjTrGaAKgAAAAAAAAABUAEqUGasZrNByrUZtZtBytbjNrNqjna1Izamg521rE00Gdq4auoLpi6ugsqYutSg3KjUqwHSM1qNxR18sVqNA7eWK//Z";

var TOTAL_POSITIVE = 0;
var IMAGE_IN_NUMBER = 30;
var POSITIVE_IMAGES = [];
var POSITIVE_IN_NUMBER = 10;
var POSITIVE_IN_RATE = 0.3;
var HIDETAB = 0;


var regexModelHateSpeech = null,
    processReplaceHateSpeech = [];

var job = {
    current: 0,
    worker: 10,
    message: 10
};

navigator.saysWho = (() => {
    const { userAgent } = navigator;
    let match = userAgent.match(/(opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)/i) || [];
    let temp;

    if (/trident/i.test(match[1])) {
        temp = /\brv[ :]+(\d+)/g.exec(userAgent) || []
        return `IE ${temp[1] || ''}`
    }

    if (match[1] === 'Chrome') {
        temp = userAgent.match(/\b(OPR|Edge)\/(\d+)/)

        if (temp !== null) {
            return temp.slice(1).join(' ').replace('OPR', 'Opera')
        }

        temp = userAgent.match(/\b(Edg)\/(\d+)/)

        if (temp !== null) {
            return temp.slice(1).join(' ').replace('Edg', 'Edge (Chromium)')
        }
    }

    match = match[2] ? [match[1], match[2]] : [navigator.appName, navigator.appVersion, '-?']
    temp = userAgent.match(/version\/(\d+)/i)

    if (temp !== null) {
        match.splice(1, 1, temp[1])
    }

    return match.join(' ')
})()


function Ruler(classes) {
    let labels = [];
    let Neutral_position = 7;
    for (var i = 0; i < classes.length; i++) {
        labels[classes[i].className] = (Math.round(classes[i].probability * 100) / 100);
        if (classes[i].className == "Neutral") { Neutral_position = i; }
    }

    if (labels["Horror_aug"] >= 0.78) {
        return 1;
    } else if (labels["Gory_aug"] >= 0.75) {
        return 2;
    } else if (labels["Porn"] >= 0.7) {
        return 4;
    } else if ((labels["Gory_aug"] + labels["Horror_aug"]) >= 0.79 && Neutral_position > 1) {
        return 3;
    } else if ((labels["Porn"] + labels["Sexy"]) >= 0.75 && Neutral_position > 1) {
        return 5;
    } else if ((labels["Porn"] + labels["Horror_aug"]) >= 0.75 && Neutral_position > 1) {
        return 6;
    } else if ((labels["Porn"] + labels["Gory_aug"]) >= 0.77 && Neutral_position > 1) {
        return 7;
    } else if ((labels["Horror_aug"] + labels["Sexy"]) >= 0.75 && Neutral_position > 1) {
        return 8;
    } else {
        return 0;
    }
}

function isNumeric(n) {
    return !isNaN(parseFloat(n)) && isFinite(n);
}

chrome.runtime.sendMessage({ action: "checkdomain", url: window.location.href }, function(response) {
    if (chrome.runtime.lastError) {
        console.log('lastError.message', chrome.runtime.lastError.message);
        // 'Could not establish connection. Receiving end does not exist.'
        return;
    }
    if (response) {
        // console.log('replace_hatespeech', response.action);
        switch (response.action) {
            case 'replace_hatespeech':
                /*
                 * quét văn bản và thay đổi nội dung có chứa hate
                 */
                regexModelHateSpeech = response.regexModelHateSpeech;
                nativeSelector();
                break;
        }
    }
});

/**
 * * Quét văn bản trong body
 * * Method                  Total ms        Average ms
 * * --------------------------------------------------
 * * querySelectorAll            1725            1.725
 *
 * @param {string} choose
 * @returns
 * +-----------------------------------------------------------------------------------+
 */
const nativeSelector = (choose = 'text') => {
    // console.log('nativeSelector', regexModelHateSpeech);
    const elements = choose == 'text' ? document.querySelectorAll("body, body *") : document.querySelectorAll("img, div, i");
    const excludeTagsHtml = ['SCRIPT', 'STYLE', 'INPUT', 'TEXTAREA'];
    let child;
    let toxicContentPredict = [],
        imagePredict = [];
    for (let i = 0; i < elements.length; i++) {
        switch (choose) {
            case 'text':
                if (elements[i].hasChildNodes() &&
                    elements[i].dataset.toxicScanned === undefined &&
                    job.current <= job.worker &&
                    excludeTagsHtml.indexOf(elements[i].tagName) == -1) {

                    for (let j = 0; j < elements[i].childNodes.length; j++) {
                        child = elements[i].childNodes[j];
                        if (child.nodeType == 3) {

                            let elementsNodeValue = child.nodeValue.trim();
                            if (!isNumeric(elementsNodeValue) && elementsNodeValue.trim().length >= 3) {
                                elements[i].dataset.toxicScanned = true;

                                const obj = { text: elementsNodeValue };
                                obj.id_node = i;
                                obj.id_childnode = j;

                                toxicContentPredict.push(obj);
                            }
                        }
                    }
                }
                break;

            case 'imagenet':
                const element = elements[i];
                if (element.nodeType == 1 &&
                    element.dataset.imagenetScanned === undefined &&
                    job.current <= job.worker) {

                    child = element;

                    const obj = {};
                    obj.id_node = i;

                    switch (child.nodeName) {
                        case 'IMG':
                            if ((child.currentSrc != '' || child.src != '')) {

                                obj.src = child.currentSrc != '' ? child.currentSrc : child.src;
                                obj.src_type = 'image';
                            }
                            break;

                        default: // use for background image DIV, I, P
                            let child_style = window.getComputedStyle(child, false);
                            if (child_style.backgroundImage != "none" &&
                                child_style.backgroundImage.match(urlRegex)) {
                                let backgroundImageUrl = child_style.backgroundImage.match(urlRegex)[1];
                                if (backgroundImageUrl != '') {

                                    obj.src = backgroundImageUrl;
                                    obj.src_type = 'background_image';
                                }
                            }
                            break;
                    }

                    if (Object.keys(obj).length >= 2 &&
                        process_images.indexOf(md5(obj.src)) === -1) {

                        child.dataset.imagenetScanned = true;
                        child.style.filter = "blur(30px)";

                        process_images.push(md5(obj.src));
                        imagePredict.push(obj);
                    }
                }
                break;
        }

        /**
         * * Sử dụng điều kiện này để thay thế cho queue
         * * DOM thay đổi sẽ quét tới thứ job.message và cứ tiếp tục cho tới khi full tag scanned
         * * Tối ưu được bộ nhớ đệm RAM
         */
        if (toxicContentPredict.length > job.message || imagePredict.length > 4) {
            break;
        }
    }

    /**
     * * toxicity_predicting
     * * Phản hồi của extension khi xử lý xong ngôn ngữ tự nhiên
     */
    if (toxicContentPredict.length > 0) {
        // console.log('toxicContentPredict', toxicContentPredict);
        job.current += 1;
        sendMessageToExtension((message) => {
            job.current -= 1;
            switch (message.action) {
                case 'toxicity_predicted':
                    for (let i = 0; i < message.predicted.length; i++) {
                        const el_predicted = message.predicted[i];
                        for (const [key, value] of Object.entries(el_predicted)) {
                            if (value === true) {
                                elements[message.predicted[i].id_node].childNodes[message.predicted[i].id_childnode].nodeValue = message.predicted[i].text;
                                break;
                            }
                        }
                    }
                    break;
            }
        }, { action: "toxicity_predict", toxicContentPredict });
    }

    /**
     * * image_predicting
     * * Phản hồi từ extension khi xử lý xong chấm điểm hình ảnh.
     */
    if (imagePredict.length > 0) {
        // console.log('imagePredict', imagePredict);
        job.current += 1;
        sendMessageToExtension((message) => {
            job.current -= 1;
            switch (message.action) {
                case 'image_predicted':
                    // console.log("image_predicted `${message.predicted.length}`", message);
                    clearInterval(autoHideAllImgs);
                    for (let i = 0; i < message.predicted.length; i++) {
                        const el_predicted = message.predicted[i];
                        var predict_result = Ruler(el_predicted.predictions);
                        if (predict_result == 0) {
                            elements[el_predicted.id_node].style.filter = "blur(0px)";
                        } else if (predict_result > 0) {
                            TOTAL_POSITIVE += 1;
                            if (POSITIVE_IMAGES.indexOf(el_predicted.src) == -1) {
                                POSITIVE_IMAGES.push(el_predicted.src);
                            }
                        }

                        if (((process_images.length <= IMAGE_IN_NUMBER && TOTAL_POSITIVE >= POSITIVE_IN_NUMBER) ||
                                (process_images.length > IMAGE_IN_NUMBER && (TOTAL_POSITIVE / process_images.length) >= POSITIVE_IN_RATE)) &&
                            HIDETAB == 0) {

                            sendMessageToExtension((r) => {
                                HIDETAB = 1;
                            }, { action: "hidetab", url: window.location.href, POSITIVE_IMAGES });
                        }
                    }
                    break;
            }
        }, { action: "image_predict", imagePredict });
    }
}

/**
 *
 * @param {*} callback
 * @param {*} message
 * @return
 */
const sendMessageToExtension = (callback, message) => {
    chrome.runtime.sendMessage(message, function(response) {
        if (chrome.runtime.lastError) {
            // 'Could not establish connection. Receiving end does not exist.'
            console.log('lastError.message', chrome.runtime.lastError.message);
            return;
        }
        if (response) {
            return callback(response);
        }
    });
}

/**
 * * replace text UpperCase and non-uppercase
 * * replace multi text
 * * convert length text to number length *
 * @param {*} textnode
 * @param {string} choose
 * @returns {string}
 */
const replaceHateSpeech = (textnode, choose = 'default') => {
    // console.log('replaceHateSpeech', regexModelHateSpeech);
    let text_replace = '',
        t = '',
        character = '*';
    switch (choose) {
        case 'text':
            for (let i = 0; i < textnode.length; i++) {
                if (textnode[i] !== ' ') {
                    text_replace += character;
                } else {
                    text_replace += ' ';
                }
            }
            break;

        default:
            text_replace = textnode.nodeValue.replace(new RegExp(regexModelHateSpeech, "gi"), (matched) => {
                for (let i = 0; i < matched.length; i++) {
                    t += character;
                }
                return t;
            });
            break;
    }
    return text_replace;
}

var autoHideAllImgs = setInterval(() => {
    let elements = document.getElementsByTagName("img");
    Array.prototype.forEach.call(elements, (e) => {
        e.style.filter = "blur(25px)";
    });
    // Che nhanh nhất có thể
}, 100);

var start_watch_time = new Date().getTime();

function watchdog() {

    nativeSelector('imagenet');
    /* MutationObserver callback to add images when the body changes */
    const observer = new MutationObserver((mutationsList, observer) => {
        let current_time = new Date().getTime();
        if (current_time - start_watch_time > 100) {
            start_watch_time = current_time;
            // console.log("DOM CHANGED ");
            nativeSelector('imagenet');
            nativeSelector('text');
        }
    });

    observer.observe(document.body, {
        subtree: true,
        // characterData: true,
        attributes: true,
        childList: true,
    });
}

if (navigator.saysWho.toLowerCase().indexOf("safari") != -1) {
    var safari_not_fire_event = setInterval(function() {
        nativeSelector('imagenet');
        // Safari suck không return IMG TAG DOM event when load from cache
    }, 1000);
    window.onload = function() {
        watchdog();
        clearInterval(safari_not_fire_event);
    }

} else if (navigator.saysWho.toLowerCase().indexOf("firefox") != -1) {
    document.addEventListener('DOMContentLoaded', function() {
        watchdog();
    });

} else {
    document.addEventListener('DOMContentLoaded', function() {
        watchdog();
    });
}