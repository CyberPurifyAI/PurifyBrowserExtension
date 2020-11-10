/**
 * ----------------------------------------------------------------------------------
 * PurifyBrowserExtension shortcuts-lookup-table.js
 * Licensed under MIT (https://github.com/CyberPurify/CyberPurify/blob/main/LICENSE)
 * ----------------------------------------------------------------------------------
 */

(function (purify, api) {
  "use strict";

  // Constants
  const SHORTCUT_LENGTH = 5;

  /**
   * Gets a list of shortcuts that can be used for the lookup table
   *
   * @param {UrlFilterRule} rule basic rule
   * @returns {Array<string>} a list of applicable shortcuts or null if no shortcuts found
   */
  function getRuleShortcuts(rule) {
    if (!rule.shortcut || rule.shortcut.length < SHORTCUT_LENGTH) {
      return null;
    }
    let shortcuts = [];
    for (let i = 0; i <= rule.shortcut.length - SHORTCUT_LENGTH; i++) {
      let shortcut = rule.shortcut.substring(i, i + SHORTCUT_LENGTH);
      shortcuts.push(shortcut);
    }
    return shortcuts;
  }

  /**
   * Avoid adding rules that match too many URLs.
   * We'd better use DomainsLookupTable for them.
   *
   * @param {UrlFilterRule} rule rule to check
   */
  function isAnyUrlShortcut(rule) {
    if (!rule.shortcut || rule.shortcut.length < SHORTCUT_LENGTH) {
      return true;
    }

    // Sorry for magic numbers
    // The numbers are basically ("PROTO://".length + 1)

    if (rule.shortcut.length < 6 && rule.shortcut.indexOf("ws:") === 0) {
      return true;
    }

    if (rule.shortcut.length < 7 && rule.shortcut.indexOf("|ws:") === 0) {
      return true;
    }

    if (rule.shortcut.length < 9 && rule.shortcut.indexOf("http") === 0) {
      return true;
    }

    if (rule.shortcut.length < 10 && rule.shortcut.indexOf("|http") === 0) {
      return true;
    }

    return false;
  }

  /**
   * djb2 hash algorithm
   *
   * @param {String} str string
   * @param {Number} begin start index
   * @param {Number} end end index
   * @param {Number} hash value
   */
  function djb2HashBetween(str, begin, end) {
    let hash = 5381;
    for (let i = begin; i < end; i += 1) {
      hash = (hash * 33) ^ str.charCodeAt(i);
    }
    return hash >>> 0;
  }

  /**
   * djb2 hash algorithm
   *
   * @param {String} str string
   * @returns {Number} hash value
   */
  function djb2Hash(str) {
    if (!str) {
      return 0;
    }
    return djb2HashBetween(str, 0, str.length);
  }

  /**
   * Special hash table that greatly increases speed of searching url filter rule by its shortcut
   */
  const ShortcutsLookupTable = function (rules) {
    this.lookupTable = new Map();
    this.histogram = new Map();

    if (rules) {
      for (let i = 0; i < rules.length; i++) {
        this.addRule(rules[i]);
      }
    }
  };

  ShortcutsLookupTable.prototype = {
    /**
     * Adds rule to the shortcuts lookup table
     *
     * @param {UrlFilterRule} rule Rule to add to the table
     * @return {Boolean} true if the rule shortcut is applicable and the rule was added
     */
    addRule: function (rule) {
      if (isAnyUrlShortcut(rule)) {
        return false;
      }

      let shortcuts = getRuleShortcuts(rule);
      if (!shortcuts) {
        return false;
      }

      // Find the applicable shortcut (the least used)
      let shortcutHash;
      let minCount = Number.MAX_SAFE_INTEGER;
      for (let shortcutToCheck of shortcuts) {
        let hash = djb2Hash(shortcutToCheck);
        let count = this.histogram.get(hash) || 0;
        if (count < minCount) {
          minCount = count;
          shortcutHash = hash;
        }
      }

      // Increment the histogram
      const count = this.histogram.get(shortcutHash) || 0;
      this.histogram.set(shortcutHash, count + 1);

      if (!this.lookupTable.has(shortcutHash)) {
        // Array is too "memory-hungry" so we try to store one rule instead
        this.lookupTable.set(shortcutHash, rule);
      } else {
        const obj = this.lookupTable.get(shortcutHash);
        if (purify.utils.collections.isArray(obj)) {
          // That is popular shortcut, more than one rule
          obj.push(rule);
        } else {
          this.lookupTable.set(shortcutHash, [obj, rule]);
        }
      }

      return true;
    },

    /**
     * Removes specified rule from the lookup table
     *
     * @param rule Rule to remove
     */
    removeRule: function (rule) {
      let shortcuts = getRuleShortcuts(rule);
      if (!shortcuts) {
        return false;
      }

      for (let shortcut of shortcuts) {
        const shortcutHash = djb2Hash(shortcut);

        if (this.lookupTable.has(shortcutHash)) {
          const obj = this.lookupTable.get(shortcutHash);
          if (purify.utils.collections.isArray(obj)) {
            purify.utils.collections.removeRule(obj, rule);
            if (obj.length === 0) {
              this.lookupTable.delete(shortcutHash);
            }
          } else if (obj.ruleText === rule.ruleText) {
            this.lookupTable.delete(shortcutHash);
          }
        }
      }
    },

    /**
     * Clears lookup table
     */
    clearRules: function () {
      this.lookupTable.clear();
      this.histogram.clear();
    },

    /**
     * Searches for filter rules restricted to the specified url
     *
     * @param url url
     * @return List of filter rules or null if nothing found
     */
    lookupRules: function (url) {
      let result = null;

      for (let i = 0; i <= url.length - SHORTCUT_LENGTH; i++) {
        const hash = djb2HashBetween(url, i, i + SHORTCUT_LENGTH);
        const value = this.lookupTable.get(hash);

        if (value) {
          if (purify.utils.collections.isArray(value)) {
            if (result === null) {
              result = [];
            }
            for (let rule of value) {
              if (url.indexOf(rule.shortcut) !== -1) {
                result.push(rule);
              }
            }
          } else {
            if (result === null) {
              result = [];
            }
            if (url.indexOf(value.shortcut) !== -1) {
              result.push(value);
            }
          }
        }
      }

      return result;
    },

    /**
     * @returns {Array} rules in lookup table
     */
    getRules: function () {
      const result = [];
      this.lookupTable.forEach((value) => {
        if (value) {
          if (purify.utils.collections.isArray(value)) {
            result = result.concat(value);
          } else {
            result.push(value);
          }
        }
      });
      return result;
    },
  };

  api.ShortcutsLookupTable = ShortcutsLookupTable;
})(purify, purify.rules);
