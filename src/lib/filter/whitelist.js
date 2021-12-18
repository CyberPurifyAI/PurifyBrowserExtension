/**
 * ----------------------------------------------------------------------------------
 * PurifyBrowserExtension whitelist.js
 * Licensed under MIT (https://github.com/CyberPurify/CyberPurify/blob/main/LICENSE)
 * ----------------------------------------------------------------------------------
 */

purify.whitelist = (function(purify) {
    var WHITE_LIST_DOMAINS_LS_PROP = "white-list-domains";
    var BLOCK_LIST_DOMAINS_LS_PROP = "block-list-domains";
    var UNBLOCK_LIST_DOMAINS_LS_PROP = "unblock-list-domains";

    const BLACK_FILTERLIST_URL = purify.getURL("filters/filter_blacklist.txt");
    const WHITE_FILTERLIST_URL = purify.getURL("filters/filter_whitelist.txt");
    const BLACK_FILTERLIST_UPDATE_URL = 'https://api.cyberpurify.com/api/domains/blacklist-hash';

    var allowAllWhiteListRule = new purify.rules.UrlFilterRule(
        "@@whitelist-all$document",
        purify.utils.filters.WHITE_LIST_FILTER_ID
    );

    var whiteListFilter = new purify.rules.UrlFilter();
    var blockListFilter = new purify.rules.UrlFilter();

    /**
     * Whitelist filter may not have been initialized yet
     * @returns {*|UrlFilter}
     */
    function getWhiteListFilter() {
        // Request domains property for filter initialization
        whiteListDomainsHolder.domains; // jshint ignore:line
        return whiteListFilter;
    }

    /**
     * Blacklist filter may not have been initialized yet
     * @returns {*|UrlFilter}
     */
    function getBlockListFilter() {
        // Request domains property for filter initialization
        blockListDomainsHolder.domains; // jshint ignore:line
        return blockListFilter;
    }

    /**
     * Returns whitelist mode
     * In default mode filtration is enabled for all sites
     * In inverted model filtration is disabled for all sites
     */
    function isDefaultWhiteListMode() {
        return purify.settings.isDefaultWhiteListMode();
    }

    /**
     * Read domains and initialize filters lazy
     */
    var whiteListDomainsHolder = {
        get domains() {
            return purify.lazyGet(whiteListDomainsHolder, "domains", function() {
                whiteListFilter = new purify.rules.UrlFilter();
                // Reading from local storage
                var domains = getDomainsFromLocalStorage(WHITE_LIST_DOMAINS_LS_PROP);
                for (var i = 0; i < domains.length; i++) {
                    var rule = createWhiteListRule(domains[i]);
                    if (rule) {
                        whiteListFilter.addRule(rule);
                    }
                }
                return domains;
            });
        },
        add: function(domain) {
            if (this.domains.indexOf(domain) < 0) {
                this.domains.push(domain);
            }
        },
    };

    var unblockListDomainsHolder = {
        get domains() {
            return purify.lazyGet(unblockListDomainsHolder, "domains", function() {
                whiteListFilter = new purify.rules.UrlFilter();
                // Reading from local storage
                var domains = getDomainsFromLocalStorage(UNBLOCK_LIST_DOMAINS_LS_PROP);
                for (var i = 0; i < domains.length; i++) {
                    var rule = createWhiteListRule(domains[i]);
                    if (rule) {
                        whiteListFilter.addRule(rule);
                    }
                }
                return domains;
            });
        },
        add: function(domain) {
            if (this.domains.indexOf(domain) < 0) {
                this.domains.push(domain);
            }
        },
    };

    var blockListDomainsHolder = {
        get domains() {
            return purify.lazyGet(blockListDomainsHolder, "domains", function() {
                blockListFilter = new purify.rules.UrlFilter();
                // Reading from local storage
                var domains = getDomainsFromLocalStorage(BLOCK_LIST_DOMAINS_LS_PROP);
                for (var i = 0; i < domains.length; i++) {
                    var rule = createWhiteListRule(domains[i]);
                    if (rule) {
                        blockListFilter.addRule(rule);
                    }
                }
                return domains;
            });
        },
        init: function(domains) {
            if (!domains) {
                return;
            }

            for (var i = 0; i < domains.length; i++) {
                var domain = domains[i];
                this.domains.push(domain);
                var rule = createWhiteListRule(domain);
                if (rule) {
                    whiteListFilter.addRule(rule);
                }
            }
            saveDomainsToLocalStorage();
        },
        add: function(domain) {
            if (this.domains.indexOf(domain) < 0) {
                this.domains.push(domain);
            }
        },
    };

    /**
     *
     * @param {*} message
     * @param {*} url
     * @param {*} response
     * @returns
     */
    const createError = (message, url, response) => {
        const errorMessage = `
        error:                    ${message}
        requested url:            ${url}
        request status text:      ${response.statusText}`;
        return new Error(errorMessage);
    };

    /**
     * Loads whitelist domains
     */
    const initUnBlockListDomains = () =>
        new Promise((resolve, reject) => {

            const success = function(response) {
                if (response && response.responseText) {
                    const responseDomains = response.responseText.split('||');
                    if (!responseDomains) {
                        reject(createError("invalid response", WHITE_FILTERLIST_URL, response));
                        return;
                    }

                    const INIT_WHITELIST_DOMAINS = [];
                    for (var i = 1; i < responseDomains.length; i++) {
                        const explode = responseDomains[i].split('^$document');
                        if (INIT_WHITELIST_DOMAINS.indexOf(explode[0]) === -1) {
                            // Since we now know we haven't seen this car before,
                            // copy it to the end of the uniqueCars list.
                            INIT_WHITELIST_DOMAINS.push(explode[0].replace(/\n/g, ''));
                        }
                    }

                    if (INIT_WHITELIST_DOMAINS.length > unblockListDomainsHolder.domains.length) {
                        clearUnBlockListed();
                        addUnBlockListed(INIT_WHITELIST_DOMAINS);
                        purify.console.info("INIT_WHITELIST_DOMAINS --> " + unblockListDomainsHolder.domains.length);
                    }

                    resolve(responseDomains);
                } else {
                    reject(createError("empty response", WHITE_FILTERLIST_URL, response));
                }
            };

            const error = (request, ex) => {
                const exMessage =
                    (ex && ex.message) || "couldn't load local filters whitelist";
                reject(createError(exMessage, WHITE_FILTERLIST_URL, request));
            };

            purify.backend.executeRequestAsync(WHITE_FILTERLIST_URL, "application/json", success, error);
        });


    /**
     * Loads blacklist domains
     */
    const initBlockListDomains = () =>
        new Promise((resolve, reject) => {

            const success = function(response) {
                if (response && response.responseText) {
                    const responseDomains = response.responseText.split('||');
                    if (!responseDomains) {
                        reject(createError("invalid response", BLACK_FILTERLIST_URL, response));
                        return;
                    }

                    const INIT_BLACKLIST_DOMAINS = [];
                    for (var i = 1; i < responseDomains.length; i++) {
                        const explode = responseDomains[i].split('^$document');
                        INIT_BLACKLIST_DOMAINS.push(explode[0].replace(/\n/g, ''));
                    }

                    if (INIT_BLACKLIST_DOMAINS.length > blockListDomainsHolder.domains.length) {
                        clearBlockListed();
                        blockListDomainsHolder.init(INIT_BLACKLIST_DOMAINS);
                        purify.console.info("INIT_BLACKLIST_DOMAINS --> " + blockListDomainsHolder.domains.length);
                    }

                    resolve(responseDomains);
                } else {
                    reject(createError("empty response", BLACK_FILTERLIST_URL, response));
                }
            };

            const error = (request, ex) => {
                const exMessage =
                    (ex && ex.message) || "couldn't load local filters blacklist";
                reject(createError(exMessage, BLACK_FILTERLIST_URL, request));
            };

            purify.backend.executeRequestAsync(BLACK_FILTERLIST_URL, "application/json", success, error);
        });

    function notifyWhiteListUpdated() {
        purify.listeners.notifyListeners(
            purify.listeners.UPDATE_WHITELIST_FILTER_RULES
        );
    }

    /**
     * Create whitelist rule from input text
     * @param domain Domain
     * @returns {*}
     * @private
     */
    function createWhiteListRule(domain) {
        if (purify.utils.strings.isEmpty(domain)) {
            return null;
        }
        return purify.rules.builder.createRule(
            "@@//" + domain + "$document",
            purify.utils.filters.WHITE_LIST_FILTER_ID
        );
    }

    /**
     * Adds domain to array of whitelist domains
     * @param domain
     */
    function addDomainToWhiteList(domain) {
        if (!domain) {
            return;
        }
        if (isDefaultWhiteListMode()) {
            whiteListDomainsHolder.add(domain);
        } else {
            blockListDomainsHolder.add(domain);
        }
    }

    /**
     * Remove domain form whitelist domains
     * @param domain
     */
    function removeDomainFromWhiteList(domain) {
        if (!domain) {
            return;
        }
        if (isDefaultWhiteListMode()) {
            purify.utils.collections.removeAll(
                whiteListDomainsHolder.domains,
                domain
            );
        } else {
            purify.utils.collections.removeAll(
                blockListDomainsHolder.domains,
                domain
            );
        }
    }

    /**
     * Remove domain from whitelist
     * @param domain
     */
    function removeFromWhiteList(domain) {
        var rule = createWhiteListRule(domain);
        if (rule) {
            if (isDefaultWhiteListMode()) {
                getWhiteListFilter().removeRule(rule);
            } else {
                getBlockListFilter().removeRule(rule);
            }
        }
        removeDomainFromWhiteList(domain);
        saveDomainsToLocalStorage();
        notifyWhiteListUpdated();
    }

    /**
     * Save domains to local storage
     */
    function saveDomainsToLocalStorage() {
        purify.localStorage.setItem(
            WHITE_LIST_DOMAINS_LS_PROP,
            JSON.stringify(whiteListDomainsHolder.domains)
        );
        purify.localStorage.setItem(
            BLOCK_LIST_DOMAINS_LS_PROP,
            JSON.stringify(blockListDomainsHolder.domains)
        );
        purify.localStorage.setItem(
            UNBLOCK_LIST_DOMAINS_LS_PROP,
            JSON.stringify(unblockListDomainsHolder.domains)
        );
    }

    /**
     * Retrieve domains from local storage
     * @param prop
     * @returns {Array}
     */
    function getDomainsFromLocalStorage(prop) {
        var domains = [];
        try {
            var json = purify.localStorage.getItem(prop);
            if (json) {
                domains = JSON.parse(json);
            }
        } catch (ex) {
            purify.console.error(
                "Error retrieve whitelist domains {0}, cause {1}",
                prop,
                ex
            );
        }
        return domains;
    }

    /**
     * Adds domain to whitelist
     * @param domain
     */
    function addToWhiteList(domain) {
        var rule = createWhiteListRule(domain);
        if (rule) {
            if (isDefaultWhiteListMode()) {
                getWhiteListFilter().addRule(rule);
            } else {
                getBlockListFilter().addRule(rule);
            }
            addDomainToWhiteList(domain);
            saveDomainsToLocalStorage();
            notifyWhiteListUpdated();
        }
    }

    /**
     * Search for whitelist rule by url.
     */
    var findWhiteListRule = function(url) {
        if (!url) {
            return null;
        }

        var host = purify.utils.url.getHost(url);

        if (isDefaultWhiteListMode()) {
            return getWhiteListFilter().isFiltered(
                url,
                host,
                purify.RequestTypes.DOCUMENT,
                false
            );
        } else {
            var rule = getBlockListFilter().isFiltered(
                url,
                host,
                purify.RequestTypes.DOCUMENT,
                false
            );
            if (rule) {
                //filtering is enabled on this website
                return null;
            } else {
                return allowAllWhiteListRule;
            }
        }
    };

    /**
     * Changes whitelist mode
     * @param defaultMode
     */
    var changeDefaultWhiteListMode = function(defaultMode) {
        purify.settings.changeDefaultWhiteListMode(defaultMode);
        notifyWhiteListUpdated();
    };

    /**
     * Stop (or start in case of inverted mode) filtration for url
     * @param url
     */
    var whiteListUrl = function(url) {
        var domain = purify.utils.url.getHost(url);
        if (isDefaultWhiteListMode()) {
            addToWhiteList(domain);
        } else {
            removeFromWhiteList(domain);
        }
    };

    /**
     * Start (or stop in case of inverted mode) filtration for url
     * @param url
     */
    var unWhiteListUrl = function(url) {
        var domain = purify.utils.url.getHost(url);
        if (isDefaultWhiteListMode()) {
            removeFromWhiteList(domain);
        } else {
            addToWhiteList(domain);
        }
    };

    /**
     * Updates domains in whitelist
     * @param domains
     */
    var updateWhiteListDomains = function(domains) {
        domains = domains || [];
        if (isDefaultWhiteListMode()) {
            clearWhiteListed();
            addWhiteListed(domains);
        } else {
            clearBlockListed();
            addBlockListed(domains);
        }
        notifyWhiteListUpdated();
    };

    /**
     * Updates domains in blacklist
     * @param number_line
     */
    var updateBlackListDomains = function(number_line = 1) {
        new Promise((resolve, reject) => {
            let BLACK_FILTERLIST_URL = BLACK_FILTERLIST_UPDATE_URL + '?number_line=' + number_line;
            const success = function(response) {
                if (response && response.responseText) {
                    const responseDomains = JSON.parse(response.responseText);
                    if (!responseDomains) {
                        reject(createError("invalid response", BLACK_FILTERLIST_URL, response));
                        return;
                    }
                    const lines = responseDomains.data;
                    if (lines.length > 0) {
                        const INIT_BLACKLIST_DOMAINS = [];
                        for (var i = 1; i < lines.length; i++) {
                            const explode = lines[i].replace("||", "");
                            INIT_BLACKLIST_DOMAINS.push(explode.replace(/\n/g, ''));
                        }

                        addBlockListed(INIT_BLACKLIST_DOMAINS);
                        purify.console.info("UPDATED_BLACKLIST_DOMAINS --> " + INIT_BLACKLIST_DOMAINS.length);
                    }

                    resolve(responseDomains);
                } else {
                    reject(createError("empty response", BLACK_FILTERLIST_URL, response));
                }
            };

            const error = (request, ex) => {
                const exMessage =
                    (ex && ex.message) || "couldn't request filters update blacklist";
                reject(createError(exMessage, BLACK_FILTERLIST_URL, request));
            };

            purify.backend.executeRequestAsync(BLACK_FILTERLIST_URL, "application/json", success, error);
        });
    };

    /**
     * Add domains to whitelist
     * @param domains
     */
    var addWhiteListed = function(domains) {
        if (!domains) {
            return;
        }
        for (var i = 0; i < domains.length; i++) {
            var domain = domains[i];
            whiteListDomainsHolder.add(domain);
            var rule = createWhiteListRule(domain);
            if (rule) {
                whiteListFilter.addRule(rule);
            }
        }
        saveDomainsToLocalStorage();
    };

    /**
     * Add domains to blocklist
     * @param domains
     */
    var addBlockListed = function(domains) {
        if (!domains) {
            return;
        }
        for (var i = 0; i < domains.length; i++) {
            var domain = domains[i];
            blockListDomainsHolder.add(domain);
            var rule = createWhiteListRule(domain);
            if (rule) {
                blockListFilter.addRule(rule);
            }
        }
        saveDomainsToLocalStorage();
    };

    /**
     * Add domains to unblocklist
     * @param domains
     */
    var addUnBlockListed = function(domains) {
        if (!domains) {
            return;
        }
        for (var i = 0; i < domains.length; i++) {
            var domain = domains[i];
            unblockListDomainsHolder.add(domain);
            var rule = createWhiteListRule(domain);
            if (rule) {
                whiteListFilter.addRule(rule);
            }
        }
        saveDomainsToLocalStorage();
    };

    /**
     * Clear whitelisted only
     */
    var clearWhiteListed = function() {
        purify.localStorage.removeItem(WHITE_LIST_DOMAINS_LS_PROP);
        purify.lazyGetClear(whiteListDomainsHolder, "domains");
        whiteListFilter = new purify.rules.UrlFilter();
    };

    /**
     * Clear blocklisted only
     */
    var clearBlockListed = function() {
        purify.localStorage.removeItem(BLOCK_LIST_DOMAINS_LS_PROP);
        purify.lazyGetClear(blockListDomainsHolder, "domains");
        blockListFilter = new purify.rules.UrlFilter();
    };

    /**
     * Clear unblocklisted only
     */
    var clearUnBlockListed = function() {
        purify.localStorage.removeItem(UNBLOCK_LIST_DOMAINS_LS_PROP);
        purify.lazyGetClear(unblockListDomainsHolder, "domains");
        whiteListFilter = new purify.rules.UrlFilter();
    };

    /**
     * Configures whitelist service
     * @param whitelist Whitelist domains
     * @param blocklist Blocklist domains
     * @param whiteListMode Whitelist mode
     */
    var configure = function(whitelist, blocklist, whiteListMode) {
        clearWhiteListed();
        clearBlockListed();
        addWhiteListed(whitelist || []);
        addBlockListed(blocklist || []);
        purify.settings.changeDefaultWhiteListMode(whiteListMode);
        notifyWhiteListUpdated();
    };

    /**
     * Returns the array of whitelist domains
     */
    var getWhiteListDomains = function() {
        if (isDefaultWhiteListMode()) {
            return whiteListDomainsHolder.domains;
        } else {
            return blockListDomainsHolder.domains;
        }
    };

    /**
     * Returns the array of whitelisted domains
     */
    var getWhiteListedDomains = function() {
        return whiteListDomainsHolder.domains;
    };

    /**
     * Returns the array of blocklisted domains, inverted mode
     */
    var getBlockListedDomains = function() {
        return blockListDomainsHolder.domains;
    };

    /**
     * Returns the array of unblocklisted domains
     */
    var getUnBlockListedDomains = function() {
        return unblockListDomainsHolder.domains;
    };

    /**
     * Returns the array of loaded rules
     */
    var getRules = function() {
        //TODO: blockListFilter

        return getWhiteListFilter().getRules();
    };

    /**
     * Initializes whitelist filter
     */
    var init = function() {
        /**
         * Access to whitelist/blacklist domains before the proper initialization of localStorage leads to wrong caching of its values
         * To prevent it we should clear cached values
         * https://github.com/CyberPurify/PurifyBrowserExtension/issues/933
         */
        purify.lazyGetClear(whiteListDomainsHolder, "domains");
        purify.lazyGetClear(blockListDomainsHolder, "domains");
        purify.lazyGetClear(unblockListDomainsHolder, "domains");

        /*
         *
         * add initUnBlockListDomains & initBlockListDomains
         */
        // initWhiteListDomains();
        initUnBlockListDomains();
        initBlockListDomains();
    };

    return {
        init: init,
        getRules: getRules,
        getWhiteListDomains: getWhiteListDomains,

        getWhiteListedDomains: getWhiteListedDomains,
        getBlockListedDomains: getBlockListedDomains,
        getUnBlockListedDomains: getUnBlockListedDomains,

        findWhiteListRule: findWhiteListRule,

        whiteListUrl: whiteListUrl,
        unWhiteListUrl: unWhiteListUrl,

        updateWhiteListDomains: updateWhiteListDomains,
        updateBlackListDomains: updateBlackListDomains,

        configure: configure,

        isDefaultMode: isDefaultWhiteListMode,
        changeDefaultWhiteListMode: changeDefaultWhiteListMode,
    };
})(purify);