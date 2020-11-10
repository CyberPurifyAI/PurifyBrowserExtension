/**
 * ----------------------------------------------------------------------------------
 * PurifyBrowserExtension domains-lookup-table.js
 * Licensed under MIT (https://github.com/CyberPurify/CyberPurify/blob/main/LICENSE)
 * ----------------------------------------------------------------------------------
 */

(function (purify, api) {
  "use strict";

  /**
   * Special lookup table, which improves basic rules search speed by domain.
   */
  var DomainsLookupTable = function (rules) {
    this.lookupTable = Object.create(null);

    if (rules) {
      for (var i = 0; i < rules.length; i++) {
        this.addRule(rules[i]);
      }
    }
  };

  DomainsLookupTable.prototype = {
    /**
     * Adds specified rule to the lookup table (if it is possible).
     * If rule has no domain restriction, this method returns false.
     *
     * @param rule Url filter rule
     * @return boolean true if rule was added. Otherwise - false.
     */
    addRule: function (rule) {
      if (!rule.hasPermittedDomains()) {
        // No permitted domains, we can't do anything
        return false;
      }

      var permittedDomains = rule.getPermittedDomains();
      for (var i = 0; i < permittedDomains.length; i++) {
        var domainName = permittedDomains[i];
        var rules = this.lookupTable[domainName];
        if (!rules) {
          rules = [];
          this.lookupTable[domainName] = rules;
        }

        rules.push(rule);
      }

      return true;
    },

    /**
     * Removes specified rule from the lookup table
     *
     * @param rule Rule to remove
     */
    removeRule: function (rule) {
      if (!rule.hasPermittedDomains()) {
        // No permitted domains, we can't do anything
        return;
      }

      var permittedDomains = rule.getPermittedDomains();
      for (var i = 0; i < permittedDomains.length; i++) {
        var domainName = permittedDomains[i];
        var rules = this.lookupTable[domainName];
        if (rules) {
          purify.utils.collections.removeRule(rules, rule);
          if (rules.length === 0) {
            delete this.lookupTable[domainName];
          }
        }
      }
    },

    /**
     * Clears lookup table
     */
    clearRules: function () {
      this.lookupTable = Object.create(null);
    },

    /**
     * Searches for filter rules restricted to the specified domain
     *
     * @param domainName Domain name
     * @return List of filter rules or null if nothing found
     */
    lookupRules: function (domainName) {
      if (!domainName) {
        return null;
      }

      let parts = domainName.split(".");
      if (parts.length === 0) {
        return null;
      }

      // Resulting list of rules
      let result = null;

      // Iterate over all sub-domains
      let host = parts[parts.length - 1];
      for (let i = parts.length - 2; i >= 0; i--) {
        host = parts[i] + "." + host;
        let rules = this.lookupTable[host];
        if (rules && rules.length > 0) {
          if (result === null) {
            // Lazy initialization of the resulting list
            result = [];
          }
          result = result.concat(rules);
        }
      }

      return result;
    },

    /**
     * @returns {Array} rules in lookup table
     */
    getRules: function () {
      var result = [];
      for (var r in this.lookupTable) {
        // jshint ignore:line
        var value = this.lookupTable[r];
        if (value) {
          if (purify.utils.collections.isArray(value)) {
            result = result.concat(value);
          } else {
            result.push(value);
          }
        }
      }

      return purify.utils.collections.removeDuplicates(result);
    },
  };

  api.DomainsLookupTable = DomainsLookupTable;
})(purify, purify.rules);
