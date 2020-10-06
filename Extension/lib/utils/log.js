/**
 * ----------------------------------------------------------------------------------
 * PurifyBrowserExtension log.js
 * Licensed under MIT (https://github.com/CyberPurify/CyberPurify/blob/main/LICENSE)
 * ----------------------------------------------------------------------------------
 */

/* eslint-disable no-console */

/**
 * Simple logger with log levels
 */
purify.console = (function () {
  // Redefine if you need it
  const CURRENT_LEVEL = "INFO";

  const LEVELS = {
    ERROR: 1,
    WARN: 2,
    INFO: 3,
    DEBUG: 4,
  };

  /**
   * Pretty-print javascript error
   */
  const errorToString = function (error) {
    return `${error.toString()}\nStack trace:\n${error.stack}`;
  };

  const getLocalTimeString = (date) => {
    const ONE_MINUTE_MS = 60 * 1000;
    const timeZoneOffsetMs = date.getTimezoneOffset() * ONE_MINUTE_MS;
    const localTime = new Date(date - timeZoneOffsetMs);
    return localTime.toISOString().replace("Z", "");
  };

  /**
   * Prints log message
   */
  const print = function (level, method, args) {
    // check log level
    if (LEVELS[CURRENT_LEVEL] < LEVELS[level]) {
      return;
    }
    if (!args || args.length === 0 || !args[0]) {
      return;
    }

    const str = `${args[0]}`;
    args = Array.prototype.slice.call(args, 1);
    let formatted = str.replace(/{(\d+)}/g, (match, number) => {
      if (typeof args[number] !== "undefined") {
        let value = args[number];
        if (value instanceof Error) {
          value = errorToString(value);
        } else if (value && value.message) {
          value = value.message;
        } else if (typeof value === "object") {
          value = JSON.stringify(value);
        }
        return value;
      }

      return match;
    });

    formatted = `${getLocalTimeString(new Date())}: ${formatted}`;
    console[method](formatted);
  };

  /**
   * Expose public API
   */
  return {
    debug(...args) {
      print("DEBUG", "log", args);
    },

    info(...args) {
      print("INFO", "info", args);
    },

    warn(...args) {
      print("WARN", "info", args);
    },

    error(...args) {
      print("ERROR", "error", args);
    },
  };
})();
