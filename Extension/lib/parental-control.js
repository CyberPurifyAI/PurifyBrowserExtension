/**
 * ----------------------------------------------------------------------------------
 * PurifyBrowserExtension parental.js
 * Licensed under MIT (https://github.com/CyberPurify/CyberPurify/blob/main/LICENSE)
 * ----------------------------------------------------------------------------------
 */

/**
 * parentalControl
 */
purify.parentalControl = (function (purify) {
  "use strict";

  const MQTT_CONFIG = {
    path: "/ws",
    clientId: "chrome_ext_" + Math.random().toString(16).substr(2, 8),
  };

  const initDevice = function () {
    browser.storage.sync.get("puid", function (info) {
      if (Object.keys(info).length === 0 && info.constructor === Object) {
        const hub = atob(purify.HUB_SUBSCRIBE);
        const mqttc = mqtt.connect(hub, MQTT_CONFIG);

        mqttc.on("connect", function () {
          const payload = JSON.stringify({
            action: "init_device",
            client_id: MQTT_CONFIG.clientId,
          });

          mqttc.subscribe(MQTT_CONFIG.clientId, function (err) {
            if (!err) {
              mqttc.publish("mqtt_proxy", payload);
            }
          });
        });

        mqttc.on("message", function (topic, message) {
          const payload = JSON.parse(message.toString());
          browser.storage.sync.set({ puid: payload.puid });
          mqttc.end();
        });

        mqttc.on("error", (error) => {
          purify.console.info("error");
        });
      }
    });
  };

  const syncParentalControl = function () {
    browser.storage.sync.get("puid", function (info) {
      if (Object.keys(info).length !== 0 && info.constructor === Object) {
        const hub = atob(purify.HUB_SUBSCRIBE);
        const mqttc = mqtt.connect(hub, MQTT_CONFIG);

        mqttc.on("connect", function () {
          const cache = purify.nsfwFiltering.nsfwUrlCache.cache.object();
          const arrCache = cache.toJSON();

          for (let idx = 0; idx < arrCache.length; idx++) {
            let item = arrCache[idx];

            if (typeof item.value !== "undefined" && item.value.length > 0) {
              mqttc.subscribe(MQTT_CONFIG.clientId, function (err) {
                if (!err) {
                  mqttc.publish(
                    "mqtt_proxy",
                    JSON.stringify({
                      action: "record_browser_ext",
                      client_id: MQTT_CONFIG.clientId,
                      puid: info.puid,
                      data: item,
                    })
                  );
                }
              });
            }

            if (idx === arrCache.length - 1) {
              cache.clear();
              mqttc.end();
            }
          }
        });

        mqttc.on("error", (error) => {
          purify.console.info("error");
        });
      }
    });
  };

  const init = async function () {
    initDevice();
    purify.console.info("Initializing Parental Control");
  };

  return {
    init,
    syncParentalControl,
  };
})(purify);
