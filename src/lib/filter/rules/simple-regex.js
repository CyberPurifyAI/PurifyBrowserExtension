/**
 * ----------------------------------------------------------------------------------
 * PurifyBrowserExtension simple-regex.js
 * Licensed under MIT (https://github.com/CyberPurify/CyberPurify/blob/main/LICENSE)
 * ----------------------------------------------------------------------------------
 */

(function (api) {
  "use strict";

  /**
   * Helper class for creating regular expression from a simple wildcard-syntax used in basic filters
   */
  var SimpleRegex = (function () {
    // Constants
    var regexConfiguration = {
      maskStartUrl: "||",
      maskPipe: "|",
      maskSeparator: "^",
      maskAnySymbol: "*",

      regexAnySymbol: ".*",
      regexSeparator: "([^ a-zA-Z0-9.%_-]|$)",
      regexStartUrl: "^(http|https|ws|wss)://([a-z0-9-_.]+\\.)?",
      regexStartString: "^",
      regexEndString: "$",
    };

    // https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/regexp
    // should be escaped . * + ? ^ $ { } ( ) | [ ] / \
    // except of * | ^
    var specials = [
      ".",
      "+",
      "?",
      "$",
      "{",
      "}",
      "(",
      ")",
      "[",
      "]",
      "\\",
      "/",
    ];
    var specialsRegex = new RegExp("[" + specials.join("\\") + "]", "g");

    /**
     * Escapes regular expression string
     */
    var escapeRegExp = function (str) {
      return str.replace(specialsRegex, "\\$&");
    };

    /**
     * Checks if string "str" starts with the specified "prefix"
     */
    var startsWith = function (str, prefix) {
      return str && str.indexOf(prefix) === 0;
    };

    /**
     * Checks if string "str" ends with the specified "postfix"
     */
    var endsWith = function (str, postfix) {
      if (!str || !postfix) {
        return false;
      }

      if (str.endsWith) {
        return str.endsWith(postfix);
      }
      var t = String(postfix);
      var index = str.lastIndexOf(t);
      return index >= 0 && index === str.length - t.length;
    };

    /**
     * Replaces all occurencies of a string "find" with "replace" str;
     */
    var replaceAll = function (str, find, replace) {
      if (!str) {
        return str;
      }
      return str.split(find).join(replace);
    };

    /**
     * Creates regex
     */
    var createRegexText = function (str) {
      if (
        str === regexConfiguration.maskStartUrl ||
        str === regexConfiguration.maskPipe ||
        str === regexConfiguration.maskAnySymbol
      ) {
        return regexConfiguration.regexAnySymbol;
      }

      var regex = escapeRegExp(str);

      if (startsWith(regex, regexConfiguration.maskStartUrl)) {
        regex =
          regex.substring(0, regexConfiguration.maskStartUrl.length) +
          replaceAll(
            regex.substring(
              regexConfiguration.maskStartUrl.length,
              regex.length - 1
            ),
            "|",
            "\\|"
          ) +
          regex.substring(regex.length - 1);
      } else if (startsWith(regex, regexConfiguration.maskPipe)) {
        regex =
          regex.substring(0, regexConfiguration.maskPipe.length) +
          replaceAll(
            regex.substring(
              regexConfiguration.maskPipe.length,
              regex.length - 1
            ),
            "|",
            "\\|"
          ) +
          regex.substring(regex.length - 1);
      } else {
        regex =
          replaceAll(regex.substring(0, regex.length - 1), "|", "\\|") +
          regex.substring(regex.length - 1);
      }

      // Replacing special url masks
      regex = replaceAll(
        regex,
        regexConfiguration.maskAnySymbol,
        regexConfiguration.regexAnySymbol
      );
      regex = replaceAll(
        regex,
        regexConfiguration.maskSeparator,
        regexConfiguration.regexSeparator
      );

      if (startsWith(regex, regexConfiguration.maskStartUrl)) {
        regex =
          regexConfiguration.regexStartUrl +
          regex.substring(regexConfiguration.maskStartUrl.length);
      } else if (startsWith(regex, regexConfiguration.maskPipe)) {
        regex =
          regexConfiguration.regexStartString +
          regex.substring(regexConfiguration.maskPipe.length);
      }
      if (endsWith(regex, regexConfiguration.maskPipe)) {
        regex =
          regex.substring(0, regex.length - 1) +
          regexConfiguration.regexEndString;
      }

      return regex;
    };

    // EXPOSE
    return {
      // Function for creating regex
      createRegexText: createRegexText,

      // Configuration used for the transformation
      regexConfiguration: regexConfiguration,
      escapeRegExp: escapeRegExp,
    };
  })();

  api.SimpleRegex = SimpleRegex;
})(purify.rules);
