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

// class name for all text nodes added by this script.
const TEXT_DIV_CLASSNAME = 'tfjs_mobilenet_extension_text';
// Thresholds for LOW_CONFIDENCE_THRESHOLD and HIGH_CONFIDENCE_THRESHOLD,
// controlling which messages are printed.
const HIGH_CONFIDENCE_THRESHOLD = 0.5;
const LOW_CONFIDENCE_THRESHOLD = 0.1;
const THIS_DOMAIN = window.location.hostname;
var images = [],
    bg_images = [],
    process_images = [],
    type_of_images = [],
    tfjs_images = [],
    image_parents = [],
    image_tags = ["IMG"],
    urlRegex = /url\((?!['"]?(?:data|http):)['"]?([^'"\)]*)['"]?\)/i;

var ban_image = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBwgIBwcHCAcHBwcHBwoHBwcHBw8ICQcKFREiFhURExMYHCggGCYlGxMTITEhMSkrLi4uFx8zODMsNygtLisBCgoKDQ0NDg0NDy0ZFRk3NysrKysrKysrKysrKysrKysrKys3KysrKysrKysrKysrKysrKysrKysrKysrKysrK//AABEIAKgBLAMBIgACEQEDEQH/xAAYAAEBAQEBAAAAAAAAAAAAAAAAAQIHA//EABYQAQEBAAAAAAAAAAAAAAAAAAABEf/EABcBAQEBAQAAAAAAAAAAAAAAAAABAgP/xAAYEQEBAQEBAAAAAAAAAAAAAAAAARESAv/aAAwDAQACEQMRAD8A7eAAAAACAAAAAAIoCAAgqAAAgqAgoCCgIKACgIKAKAKCgAAAAAAAAgoCCgIKAgqAIqAIoCAAAAAAAoIKAgoCKACigAACAKAAAAAAAAAAAAigIACCgIKAgoCCgIKAAAAAigAoAIAAIDQoCCgIKAgoCCgIKAgoCCgIKAgoCCgIKAgAAAAICiAKgUAQAABsAAAAAAAAAAAAAAAAAAAAEAAAEAUQAAAAAABBQEFAaAAAAAAAAAAAAAAAABAVAABAVAEEAAAFEAURRQAAAAFBQAAAAAAAAAAAAAEAAEBUAQEAAAAQRQBQABUAUAUUAAAUAAAAAAAAAAACotQAABFQBAQBA1AQNFEDTFEDTFVlTRRA0URTVVWVBVRVAAAAAAAAAAAACotQAEQEVE0QETVE0TU0xdNZ01OjF01nTU6Ma1dY006XG9NZ01ejGtNZ1ToxpWVXTGosZWLKjSpFaiACgAAAAAAAAABUWoAi1mpVKhWaxaoJqWsauGpalrNrF9LjWprOprPS43prGmp2uN6axpp0Y3q689XV6Mb1dY1ZV6TG5VYlalalTG41GI1G5UrUaZjTrGaAKgAAAAAAAAABUAEqUGasZrNByrUZtZtBytbjNrNqjna1Izamg521rE00Gdq4auoLpi6ugsqYutSg3KjUqwHSM1qNxR18sVqNA7eWK//Z";

var TOTAL_POSITIVE = 0;
var IMAGE_IN_NUMBER = 30;
var POSITIVE_IMAGES = [];
var POSITIVE_IN_NUMBER = 10;
var POSITIVE_IN_RATE = 0.3;
var HIDETAB = 0;
var BROWSER = "safari";

navigator.saysWho = (() => {
    const { userAgent } = navigator
    let match = userAgent.match(/(opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)/i) || []
    let temp

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

var md5cycle = function(x, k) {
    var a = x[0],
        b = x[1],
        c = x[2],
        d = x[3];

    a = ff(a, b, c, d, k[0], 7, -680876936);
    d = ff(d, a, b, c, k[1], 12, -389564586);
    c = ff(c, d, a, b, k[2], 17, 606105819);
    b = ff(b, c, d, a, k[3], 22, -1044525330);
    a = ff(a, b, c, d, k[4], 7, -176418897);
    d = ff(d, a, b, c, k[5], 12, 1200080426);
    c = ff(c, d, a, b, k[6], 17, -1473231341);
    b = ff(b, c, d, a, k[7], 22, -45705983);
    a = ff(a, b, c, d, k[8], 7, 1770035416);
    d = ff(d, a, b, c, k[9], 12, -1958414417);
    c = ff(c, d, a, b, k[10], 17, -42063);
    b = ff(b, c, d, a, k[11], 22, -1990404162);
    a = ff(a, b, c, d, k[12], 7, 1804603682);
    d = ff(d, a, b, c, k[13], 12, -40341101);
    c = ff(c, d, a, b, k[14], 17, -1502002290);
    b = ff(b, c, d, a, k[15], 22, 1236535329);

    a = gg(a, b, c, d, k[1], 5, -165796510);
    d = gg(d, a, b, c, k[6], 9, -1069501632);
    c = gg(c, d, a, b, k[11], 14, 643717713);
    b = gg(b, c, d, a, k[0], 20, -373897302);
    a = gg(a, b, c, d, k[5], 5, -701558691);
    d = gg(d, a, b, c, k[10], 9, 38016083);
    c = gg(c, d, a, b, k[15], 14, -660478335);
    b = gg(b, c, d, a, k[4], 20, -405537848);
    a = gg(a, b, c, d, k[9], 5, 568446438);
    d = gg(d, a, b, c, k[14], 9, -1019803690);
    c = gg(c, d, a, b, k[3], 14, -187363961);
    b = gg(b, c, d, a, k[8], 20, 1163531501);
    a = gg(a, b, c, d, k[13], 5, -1444681467);
    d = gg(d, a, b, c, k[2], 9, -51403784);
    c = gg(c, d, a, b, k[7], 14, 1735328473);
    b = gg(b, c, d, a, k[12], 20, -1926607734);

    a = hh(a, b, c, d, k[5], 4, -378558);
    d = hh(d, a, b, c, k[8], 11, -2022574463);
    c = hh(c, d, a, b, k[11], 16, 1839030562);
    b = hh(b, c, d, a, k[14], 23, -35309556);
    a = hh(a, b, c, d, k[1], 4, -1530992060);
    d = hh(d, a, b, c, k[4], 11, 1272893353);
    c = hh(c, d, a, b, k[7], 16, -155497632);
    b = hh(b, c, d, a, k[10], 23, -1094730640);
    a = hh(a, b, c, d, k[13], 4, 681279174);
    d = hh(d, a, b, c, k[0], 11, -358537222);
    c = hh(c, d, a, b, k[3], 16, -722521979);
    b = hh(b, c, d, a, k[6], 23, 76029189);
    a = hh(a, b, c, d, k[9], 4, -640364487);
    d = hh(d, a, b, c, k[12], 11, -421815835);
    c = hh(c, d, a, b, k[15], 16, 530742520);
    b = hh(b, c, d, a, k[2], 23, -995338651);

    a = ii(a, b, c, d, k[0], 6, -198630844);
    d = ii(d, a, b, c, k[7], 10, 1126891415);
    c = ii(c, d, a, b, k[14], 15, -1416354905);
    b = ii(b, c, d, a, k[5], 21, -57434055);
    a = ii(a, b, c, d, k[12], 6, 1700485571);
    d = ii(d, a, b, c, k[3], 10, -1894986606);
    c = ii(c, d, a, b, k[10], 15, -1051523);
    b = ii(b, c, d, a, k[1], 21, -2054922799);
    a = ii(a, b, c, d, k[8], 6, 1873313359);
    d = ii(d, a, b, c, k[15], 10, -30611744);
    c = ii(c, d, a, b, k[6], 15, -1560198380);
    b = ii(b, c, d, a, k[13], 21, 1309151649);
    a = ii(a, b, c, d, k[4], 6, -145523070);
    d = ii(d, a, b, c, k[11], 10, -1120210379);
    c = ii(c, d, a, b, k[2], 15, 718787259);
    b = ii(b, c, d, a, k[9], 21, -343485551);

    x[0] = add32(a, x[0]);
    x[1] = add32(b, x[1]);
    x[2] = add32(c, x[2]);
    x[3] = add32(d, x[3]);

}

var cmn = function(q, a, b, x, s, t) {
    a = add32(add32(a, q), add32(x, t));
    return add32((a << s) | (a >>> (32 - s)), b);
}

var ff = function(a, b, c, d, x, s, t) {
    return cmn((b & c) | ((~b) & d), a, b, x, s, t);
}

var gg = function(a, b, c, d, x, s, t) {
    return cmn((b & d) | (c & (~d)), a, b, x, s, t);
}

var hh = function(a, b, c, d, x, s, t) {
    return cmn(b ^ c ^ d, a, b, x, s, t);
}

var ii = function(a, b, c, d, x, s, t) {
    return cmn(c ^ (b | (~d)), a, b, x, s, t);
}

var md51 = function(s) {
    var txt = '',
        n = s.length,
        state = [1732584193, -271733879, -1732584194, 271733878],
        i;
    for (i = 64; i <= s.length; i += 64) {
        md5cycle(state, md5blk(s.substring(i - 64, i)));
    }
    s = s.substring(i - 64);
    var tail = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (i = 0; i < s.length; i++)
        tail[i >> 2] |= s.charCodeAt(i) << ((i % 4) << 3);
    tail[i >> 2] |= 0x80 << ((i % 4) << 3);
    if (i > 55) {
        md5cycle(state, tail);
        for (i = 0; i < 16; i++) tail[i] = 0;
    }
    tail[14] = n * 8;
    md5cycle(state, tail);
    return state;
}

/* there needs to be support for Unicode here,
 * unless we pretend that we can redefine the MD-5
 * algorithm for multi-byte characters (perhaps
 * by adding every four 16-bit characters and
 * shortening the sum to 32 bits). Otherwise
 * I suggest performing MD-5 as if every character
 * was two bytes--e.g., 0040 0025 = @%--but then
 * how will an ordinary MD-5 sum be matched?
 * There is no way to standardize text to something
 * like UTF-8 before transformation; speed cost is
 * utterly prohibitive. The JavaScript standard
 * itself needs to look at this: it should start
 * providing access to strings as preformed UTF-8
 * 8-bit unsigned value arrays.
 */
var md5blk = function(s) { /* I figured global was faster.   */
    var md5blks = [],
        i; /* Andy King said do it this way. */
    for (i = 0; i < 64; i += 4) {
        md5blks[i >> 2] = s.charCodeAt(i) + (s.charCodeAt(i + 1) << 8) + (s.charCodeAt(i + 2) << 16) + (s.charCodeAt(i + 3) << 24);
    }
    return md5blks;
}

var hex_chr = '0123456789abcdef'.split('');

var rhex = function(n) {
    var s = '',
        j = 0;
    for (; j < 4; j++)
        s += hex_chr[(n >> (j * 8 + 4)) & 0x0F] + hex_chr[(n >> (j * 8)) & 0x0F];
    return s;
}

var hex = function(x) {
    for (var i = 0; i < x.length; i++)
        x[i] = rhex(x[i]);
    return x.join('');
}

var md5 = function(s) {
    return hex(md51(s));
}

/* this function is much faster,
so if possible we use it. Some IEs
are the only ones I know of that
need the idiotic second function,
generated by an if clause.  */

var add32 = function(a, b) {
    return (a + b) & 0xFFFFFFFF;
}


function Ruler(classes) {
    labels = []
    Neutral_position = 7;
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

function is_valid_image(url) {
    if (
        url.indexOf("base64") != -1 ||
        url.indexOf(".png") != -1 ||
        url.indexOf(".svg") != -1 ||
        url.indexOf(".gif") != -1 ||
        url.indexOf(".jpg") != -1 ||
        url.indexOf(".jpeg") != -1
    ) {
        return true;
    }

    // return isImageURL(url);
    return false;

    // if(url.indexOf("http://")==-1 && url.indexOf("https://")==-1 && url.indexOf("base64")==-1 && url.indexOf("data:image/svg")!=-1 && url.indexOf(".png")==-1 && url.indexOf(".gif")==-1 && url.indexOf(".jpg")==-1 && url.indexOf(".jpeg")==-1){
    //   return 0;
    // }else{
    //   return 1;
    // }
}

function blurallimgs(srcUrl, srcType, predict_result) {

    var elements = document.querySelectorAll(image_tags.join(","));
    // var elements = document.body.getElementsByTagName("*");
    /* When the DOM is ready find all the images and background images
        initially loaded */
    Array.prototype.forEach.call(elements, function(el) {
        var style = window.getComputedStyle(el, false);
        if (el.src == srcUrl) {
            if (el.tagName === "IMG") {
                if (predict_result == 0) {
                    // el.style = "filter: blur(0px) !important;opacity:1 !important;";
                    // el.style.setProperty('filter', 'blur(0px) !important', "");
                    // el.setAttribute('cp-srcurl', el.src + " == " + srcUrl);
                    el.style.filter = "blur(0px)";
                    // el.style.visibility = "visible";
                } else {
                    // el.style = "-webkit-filter: blur(30px) !important;filter: blur(30px) !important;opacity:0.25 !important;";
                    // el.style.setProperty('filter', 'blur(30px) !important', "");
                    el.style.filter = "blur(30px)";
                    // el.style.visibility = "hidden";
                    // console.log(TOTAL_POSITIVE + "/" + process_images.length + " " + (TOTAL_POSITIVE / process_images.length))
                    if (
                        (process_images.length <= IMAGE_IN_NUMBER && TOTAL_POSITIVE >= POSITIVE_IN_NUMBER) ||
                        (process_images.length > IMAGE_IN_NUMBER && (TOTAL_POSITIVE / process_images.length) >= POSITIVE_IN_RATE)
                    ) {
                        if (HIDETAB == 0) {
                            HIDETAB = 1;
                            chrome.runtime.sendMessage({ action: "hidetab", url: window.location.href, POSITIVE_IMAGES }, function(response) {
                                // console.log(response.result);
                            });
                            // console.log("HIDETAB");
                        }
                    }
                }
            }

        } else if (style.backgroundImage != "none" && predict_result > 0 && style.backgroundImage.match(urlRegex)) {
            // bg_img_url = style.backgroundImage.slice(4, -1).replace(/['"]/g, "");
            bg_img_url = style.backgroundImage.match(urlRegex)[1];
            if (bg_img_url == srcUrl) {
                // el.style.backgroundImage = "url('" + ban_image + "')";
                el.style.backgroundImage = style.backgroundImage.replace(urlRegex, "url('" + ban_image + "')");
                // console.log(style.backgroundImage.replace(urlRegex, "url('" + ban_image + "')"));

                // console.log(TOTAL_POSITIVE + "/" + process_images.length + " FOUND bg_images " + bg_img_url);
                // console.log(TOTAL_POSITIVE + "/" + process_images.length + " " + (TOTAL_POSITIVE / process_images.length))
                if (
                    (process_images.length <= IMAGE_IN_NUMBER && TOTAL_POSITIVE >= POSITIVE_IN_NUMBER) ||
                    (process_images.length > IMAGE_IN_NUMBER && (TOTAL_POSITIVE / process_images.length) >= POSITIVE_IN_RATE)
                ) {
                    if (HIDETAB == 0) {
                        HIDETAB = 1;
                        chrome.runtime.sendMessage({ action: "hidetab", url: window.location.href, POSITIVE_IMAGES }, function(response) {
                            // console.log(response.result);
                        });
                        // console.log("HIDETAB");
                    }
                }
            }

        }
    });
}


// var wait_imgs = []

function getallimgs(tag) {

    // if(tag!="alltag"){
    //   var elements = document.querySelectorAll(image_tags.join(","));
    // }else{
    //   var elements = document.getElementsByTagName("*");
    // }

    var elements = document.querySelectorAll("img, div, i");
    // var elements = document.getElementsByTagName("*");
    /* When the DOM is ready find all the images and background images
        initially loaded */
    Array.prototype.forEach.call(elements, function(el) {
        var style = window.getComputedStyle(el, false);
        if (el.tagName === "IMG") {
            md5src = md5(`${ el.src }`);
            if (el.src != "" && process_images.indexOf(md5src) == -1) {
                process_images.push(md5src);
                // wait_imgs.push(el.src);
                // console.log(" FOUND IMG " + el.src);
                if (tag == "alltag") {
                    // el.style="-webkit-filter: blur(30px) !important;filter: blur(30px) !important;opacity:0.25 !important;";
                    // el.style.setProperty('filter','blur(30px) !important',"");
                    el.style.filter = "blur(30px)";
                    // el.style.visibility = "hidden";
                }

                el.setAttribute('draggable', false);
                // console.log({ action: "predict", srcUrl: el.src, srcType: "img" });
                chrome.runtime.sendMessage({ action: "predict", srcUrl: el.src, srcType: "img" }, function(response) {
                    // console.log(response);
                });
            }

        } else if (style.backgroundImage != "none" && style.backgroundImage.match(urlRegex)) {
            // bg_img_url = style.backgroundImage.slice(4, -1).replace(/['"]/g, "");
            bg_img_url = style.backgroundImage.match(urlRegex)[1];
            md5src = md5(bg_img_url);
            if (image_tags.indexOf(el.tagName) == -1) {
                image_tags.push(el.tagName);
            }

            if (bg_img_url != "" && process_images.indexOf(md5src) == -1) {
                process_images.push(md5src);
                // console.log({ action: "predict", srcUrl: bg_img_url, srcType: "bg", backgroundImage: style.backgroundImage.match(urlRegex)[1] });
                // console.log(" FOUND bg_images " + bg_img_url);
                chrome.runtime.sendMessage({ action: "predict", srcUrl: bg_img_url, srcType: "bg" }, function(response) {
                    // console.log(response.result);
                });
            }
        }
    });
}


// Add a listener to hear from the content.js page when the image is through
// processing.  The message should contin an action, a url, and predictions (the
// output of the classifier)
//
// message: {action, url, predictions}
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // alert(JSON.stringify(message))
    if (message && message.action === 'predict' && message.srcUrl && message.predictions) {
        FROM_CACHE = 0;
        var predict_result = Ruler(message.predictions);
        clearInterval(autohideallimgs);
        blurallimgs(message.srcUrl, message.srcType, predict_result);

        if (predict_result > 0) {
            TOTAL_POSITIVE += 1;
            if (POSITIVE_IMAGES.indexOf(message.srcUrl) == -1) {
                POSITIVE_IMAGES.push(message.srcUrl);
            }
        }
    }

});

chrome.runtime.sendMessage({ action: "checkdomain", url: window.location.href }, function(response) {});

// if (navigator.saysWho.toLowerCase().indexOf("safari") == -1) {
//     document.getElementsByTagName("html")[0].style.visibility = "hidden";
// }

var autohideallimgs = setInterval(function() {

    var elements = document.getElementsByTagName("img");
    Array.prototype.forEach.call(elements, function(el) {
        el.style.filter = "blur(30px)";
    });
    // Che nhanh nhất có thể
}, 100);


var start_watch_time = new Date().getTime();

function watchdog() {

    getallimgs("alltag");
    /* MutationObserver callback to add images when the body changes */
    var callback = function(mutationsList, observer) {
        var current_time = new Date().getTime();
        if (current_time - start_watch_time > 100) {
            start_watch_time = current_time;
            // console.log("DOM CHANGED ");
            // phải dùng alltag để tránh lỗi sử dụng background mặc dù chạy nặng hơn
            getallimgs("alltag");
        }
    }
    var observer = new MutationObserver(callback);
    var config = {
        characterData: true,
        attributes: true,
        childList: true,
        subtree: true
    };

    observer.observe(document.body, config);
}

if (navigator.saysWho.toLowerCase().indexOf("safari") != -1) {
    var safari_not_fire_event = setInterval(function() {
        getallimgs("sometag");
        //Safari suck không return IMG TAG DOM event when load from cache
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