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

  const init = async function () {
    const syncStore = new OptionsSync();
    const mqttc = mqtt.connect(
      "ws://chrome_ext:3oKdFYHg4j1JUuYsGp93iuH21c7j3XTP@10.148.0.7:15675",
      MQTT_CONFIG
    );

    mqttc.on("connect", function () {
      console.log("connected");

      const payload = JSON.stringify({
        action: "init_device",
        client_id: MQTT_CONFIG.clientId,
      });

      mqttc.subscribe("listen_" + MQTT_CONFIG.clientId, function (err) {
        if (!err) {
          mqttc.publish("mqtt_proxy", payload, function () {
            console.log("init_device");
          });
        }
      });
    });

    mqttc.on("message", function (topic, message) {
      console.log(message.toString());
      mqttc.end();
    });

    mqttc.on("error", (error) => {
      purify.console.info("error");
    });

    purify.console.info("Initializing Parental Control");
  };

  const syncNSFW = function () {};

  return {
    init,
    syncNSFW,
  };
})(purify);
