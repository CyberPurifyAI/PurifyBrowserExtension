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
    const data = purify.nsfwFiltering.nsfwUrlCache.cache.getJSON();
    purify.nsfwFiltering.nsfwUrlCache.cache.saveValue("https://tinhte.vn", true);
    console.log(data);
    // console.log(
    //   purify.nsfwFiltering.nsfwUrlCache.cache.saveValue("https://tinhte.vn", [
    //     "test",
    //     "test",
    //   ])
    // );
    // browser.storage.sync.get("puid", function (info) {
    //   if (Object.keys(info).length === 0 && info.constructor === Object) {
    //     const hub = atob(purify.HUB_SUBSCRIBE);
    //     const mqttc = mqtt.connect(hub, MQTT_CONFIG);

    //     mqttc.on("connect", function () {
    //       const payload = JSON.stringify({
    //         action: "record_browser_ext",
    //         client_id: MQTT_CONFIG.clientId,
    //         data: {},
    //       });

    //       mqttc.subscribe(MQTT_CONFIG.clientId, function (err) {
    //         if (!err) {
    //           mqttc.publish("mqtt_proxy", payload);
    //         }
    //       });
    //     });

    //     mqttc.on("message", function (topic, message) {
    //       const payload = JSON.parse(message.toString());
    //       console.log(payload);
    //       // browser.storage.sync.set({ puid: payload.puid });
    //       mqttc.end();
    //     });

    //     mqttc.on("error", (error) => {
    //       purify.console.info("error");
    //     });
    //   }
    // });
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
