/**
 * ----------------------------------------------------------------------------------
 * PurifyBrowserExtension parental-control.js
 * Licensed under MIT (https://github.com/CyberPurify/CyberPurify/blob/main/LICENSE)
 * ----------------------------------------------------------------------------------
 */

/**
 * parentalControl
 */
purify.parentalControl = (function(purify) {
    "use strict";

    const clientId = purify.utils.browser.getClientId();

    const initDevice = function() {
        browser.storage.sync.get("puid", function(info) {
            if (Object.keys(info).length === 0 && info.constructor === Object) {
                const hub = atob(purify.HUB_SUBSCRIBE);
                const mqttc = mqtt.connect(hub);

                mqttc.on("connect", function() {
                    const payload = JSON.stringify({
                        action: "init_device",
                        client_id: clientId,
                        user_agent: navigator.userAgent,
                        client_lang: navigator.language,
                    });

                    mqttc.subscribe(clientId, function(err) {
                        if (!err) {
                            mqttc.publish("mqtt_proxy", payload);
                        }
                    });
                });

                mqttc.on("message", function(topic, message) {
                    const payload = JSON.parse(message.toString());
                    browser.storage.sync.set({ puid: payload.puid });
                    mqttc.end();
                });

                mqttc.on("error", (error) => {
                    purify.console.info("error init device");
                });
            }
        });
    };

    const syncData = function() {
        browser.storage.sync.get("puid", function(info) {
            if (Object.keys(info).length !== 0 && info.constructor === Object) {
                const hub = atob(purify.HUB_SUBSCRIBE);
                const mqttc = mqtt.connect(hub);

                mqttc.on("connect", function() {
                    const cache = purify.purifyFiltering.purifyUrlCache.cache.object();
                    const arrCache = cache.toJSON();

                    mqttc.subscribe(clientId, function(err) {
                        if (arrCache.length > 0) {
                            for (let idx = 0; idx < arrCache.length; idx++) {
                                let item = arrCache[idx];

                                if (!err &&
                                    typeof item.value !== "undefined" &&
                                    item.value.length > 0
                                ) {
                                    mqttc.publish(
                                        "mqtt_proxy",
                                        JSON.stringify({
                                            action: "stats_browser_ext",
                                            client_id: clientId,
                                            puid: info.puid,
                                            stat: item,
                                        })
                                    );
                                }

                                if (idx === arrCache.length - 1) {
                                    // cache.clear();
                                    mqttc.end();
                                }
                            }
                        } else {
                            mqttc.end();
                        }
                    });
                });

                mqttc.on("error", (error) => {
                    console.log(error);
                    purify.console.info("Error Hit Stats");
                });
            }
        });
    };

    const syncBlacklist = function(messages) {

        const hub = atob(purify.HUB_SUBSCRIBE);
        const mqttc = mqtt.connect(hub);

        mqttc.on("connect", function() {

            mqttc.subscribe(messages.clientId, function(err) {
                if (!err) {
                    mqttc.publish(
                        "mqtt_proxy",
                        JSON.stringify(messages)
                    );
                }
                mqttc.end();
            });
        });

        mqttc.on("error", (error) => {
            console.log(error);
            purify.console.info("Error Hit Stats");
        });
    };

    const updateUser = function(info) {
        const { email, name, sub } = info;

        browser.storage.sync.set({
            pemail: email,
            pname: name,
            psub: sub,
        });
    };

    const getUser = function(callback) {
        if (chrome.runtime.lastError) {
            return reject(chrome.runtime.lastError);
        }
        browser.storage.sync.get(null, function(info) {
            if (info) {
                const { pname } = info;
                callback({ name: pname });
            }
        });
    };

    const init = function() {
        initDevice();
        purify.console.info("Initializing Parental Control");
    };

    return {
        updateUser,
        getUser,
        init,
        syncData,
        syncBlacklist,
    };
})(purify);