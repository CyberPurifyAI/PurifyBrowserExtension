/**
 * ----------------------------------------------------------------------------------
 * PurifyBrowserExtension page-stats.js
 * Licensed under MIT (https://github.com/CyberPurify/CyberPurify/blob/main/LICENSE)
 * ----------------------------------------------------------------------------------
 */

/**
 * Global stats
 */
purify.pageStats = (function (purify) {
  "use strict";

  const MAX_HOURS_HISTORY = 24;
  const MAX_DAYS_HISTORY = 30;
  const MAX_MONTHS_HISTORY = 3;

  const TOTAL_GROUP = {
    groupId: "total",
    groupName: purify.i18n
      ? purify.i18n.getMessage("popup_statistics_total")
      : "Total",
  };

  const pageStatisticProperty = "page-statistic";

  const pageStatsHolder = {
    /**
     * Getter for total page stats (gets it from local storage)
     *
     * @returns {*}
     * @private
     */
    get stats() {
      return purify.lazyGet(pageStatsHolder, "stats", () => {
        let stats;
        try {
          const json = purify.localStorage.getItem(pageStatisticProperty);
          if (json) {
            stats = JSON.parse(json);
          }
        } catch (ex) {
          purify.console.error(
            "Error retrieve page statistic from storage, cause {0}",
            ex
          );
        }
        return stats || Object.create(null);
      });
    },

    save: purify.utils.concurrent.throttle(function () {
      purify.localStorage.setItem(
        pageStatisticProperty,
        JSON.stringify(this.stats)
      );
    }, purify.prefs.statsSaveInterval),

    clear: function () {
      purify.localStorage.removeItem(pageStatisticProperty);
      purify.lazyGetClear(pageStatsHolder, "stats");
    },
  };

  /**
   * Total count of blocked requests
   *
   * @returns {Number} Count of blocked requests
   */
  const getTotalBlocked = function () {
    const stats = pageStatsHolder.stats;
    if (!stats) {
      return 0;
    }
    return stats.totalBlocked || 0;
  };

  /**
   * Updates total count of blocked requests
   *
   * @param blocked Count of blocked requests
   */
  const updateTotalBlocked = function (blocked) {
    const stats = pageStatsHolder.stats;
    stats.totalBlocked = (stats.totalBlocked || 0) + blocked;
    pageStatsHolder.save();
  };

  /**
   * Resets tab stats
   */
  const resetStats = function () {
    pageStatsHolder.clear();
  };

  /**
   * Object used to cache bindings between filters and groups
   * @type {{filterId: {groupId: Number, groupName: String, displayNumber: Number}}}
   */
  const blockedGroupsFilters = {};

  // TODO check why not all filter stats appear here, for example cosmetic filters

  /**
   * Returns blocked group by filter id
   *
   * @param {number} filterId
   * @returns
   */
  const getBlockedGroupByFilterId = function (filterId) {
    let blockedGroup = blockedGroupsFilters[filterId];

    if (blockedGroup !== undefined) {
      return blockedGroup;
    }

    const filter = purify.subscriptions.getFilter(filterId);
    if (!filter) {
      return undefined;
    }

    const group = purify.subscriptions.getGroup(filter.groupId);
    if (!group) {
      return undefined;
    }

    const { groupId, groupName, displayNumber } = group;
    blockedGroup = { groupId, groupName, displayNumber };
    blockedGroupsFilters[filter.filterId] = blockedGroup;

    return blockedGroup;
  };

  const createStatsDataItem = function (type, blocked) {
    const result = new Object(null);
    if (type) {
      result[type] = blocked;
    }
    result[TOTAL_GROUP.groupId] = blocked;
    return result;
  };

  /**
   * Blocked types to filters relation dictionary
   */
  const createStatsData = function (now, type, blocked) {
    const result = Object.create(null);
    result.hours = [];
    result.days = [];
    result.months = [];

    for (let i = 1; i < MAX_HOURS_HISTORY; i += 1) {
      result.hours.push(createStatsDataItem(null, 0));
    }
    result.hours.push(createStatsDataItem(type, blocked));

    for (let j = 1; j < MAX_DAYS_HISTORY; j += 1) {
      result.days.push(createStatsDataItem(null, 0));
    }
    result.days.push(createStatsDataItem(type, blocked));

    for (let k = 1; k < MAX_MONTHS_HISTORY; k += 1) {
      result.months.push(createStatsDataItem(null, 0));
    }
    result.months.push(createStatsDataItem(type, blocked));

    result.updated = now.getTime();

    return result;
  };

  var updateStatsDataItem = function (type, blocked, current) {
    current[type] = (current[type] || 0) + blocked;
    current[TOTAL_GROUP.groupId] =
      (current[TOTAL_GROUP.groupId] || 0) + blocked;

    return current;
  };

  var updateStatsData = function (now, type, blocked, current) {
    const currentDate = new Date(current.updated);

    const result = current;

    if (
      purify.utils.dates.isSameHour(now, currentDate) &&
      result.hours.length > 0
    ) {
      result.hours[result.hours.length - 1] = updateStatsDataItem(
        type,
        blocked,
        result.hours[result.hours.length - 1]
      );
    } else {
      let diffHours = purify.utils.dates.getDifferenceInHours(now, currentDate);

      while (diffHours >= 2) {
        result.hours.push(createStatsDataItem(null, 0));
        diffHours -= 1;
      }

      result.hours.push(createStatsDataItem(type, blocked));
      if (result.hours.length > MAX_HOURS_HISTORY) {
        result.hours = result.hours.slice(-MAX_HOURS_HISTORY);
      }
    }

    if (
      purify.utils.dates.isSameDay(now, currentDate) &&
      result.days.length > 0
    ) {
      result.days[result.days.length - 1] = updateStatsDataItem(
        type,
        blocked,
        result.days[result.days.length - 1]
      );
    } else {
      let diffDays = purify.utils.dates.getDifferenceInDays(now, currentDate);

      while (diffDays >= 2) {
        result.days.push(createStatsDataItem(null, 0));
        diffDays -= 1;
      }

      result.days.push(createStatsDataItem(type, blocked));
      if (result.days.length > MAX_DAYS_HISTORY) {
        result.days = result.days.slice(-MAX_DAYS_HISTORY);
      }
    }

    if (
      purify.utils.dates.isSameMonth(now, currentDate) &&
      result.months.length > 0
    ) {
      result.months[result.months.length - 1] = updateStatsDataItem(
        type,
        blocked,
        result.months[result.months.length - 1]
      );
    } else {
      let diffMonths = purify.utils.dates.getDifferenceInMonths(
        now,
        currentDate
      );
      while (diffMonths >= 2) {
        result.months.push(createStatsDataItem(null, 0));
        diffMonths -= 1;
      }

      result.months.push(createStatsDataItem(type, blocked));
    }

    result.updated = now.getTime();
    return result;
  };

  /**
   * Updates stats data
   *
   * For every hour/day/month we have an object:
   * {
   *      blockedType: count,
   *      ..,
   *
   *      total: count
   * }
   *
   * We store last 24 hours, 30 days and all past months stats
   *
   * var data = {
   *              hours: [],
   *              days: [],
   *              months: [],
   *              updated: Date };
   *
   * @param filterId
   * @param blocked count
   * @param now date
   */
  const updateStats = function (filterId, blocked, now) {
    const blockedGroup = getBlockedGroupByFilterId(filterId);

    if (blockedGroup === undefined) {
      return;
    }

    const { groupId } = blockedGroup;
    const stats = pageStatsHolder.stats;

    let updated;

    if (!stats.data) {
      updated = createStatsData(now, groupId, blocked);
    } else {
      updated = updateStatsData(now, groupId, blocked, stats.data);
    }

    pageStatsHolder.stats.data = updated;
    pageStatsHolder.save();
  };

  const getBlockedGroups = () => {
    const groups = purify.subscriptions.getGroups().map((group) => {
      return {
        groupId: group.groupId,
        groupName: group.groupName,
        displayNumber: group.displayNumber,
      };
    });

    return [
      TOTAL_GROUP,
      ...groups.sort((prevGroup, nextGroup) => {
        return prevGroup.displayNumber - nextGroup.displayNumber;
      }),
    ];
  };

  /**
   * Returns statistics data object
   * @param {Date} [date] - used in the tests to provide time of stats object creation
   */
  const getStatisticsData = (date = new Date()) => {
    let stats = pageStatsHolder.stats;
    if (!stats) {
      stats = {};
    }

    if (!stats.data) {
      stats.data = createStatsData(date, null, 0);
      pageStatsHolder.stats.data = stats.data;
      pageStatsHolder.save();
    }

    return {
      today: stats.data.hours,
      lastWeek: stats.data.days.slice(-7),
      lastMonth: stats.data.days,
      lastYear: stats.data.months.slice(-12),
      overall: stats.data.months,
      blockedGroups: getBlockedGroups(),
    };
  };

  return {
    resetStats: resetStats,
    updateTotalBlocked: updateTotalBlocked,
    updateStats: updateStats,
    getTotalBlocked: getTotalBlocked,
    getStatisticsData: getStatisticsData,
  };
})(purify);
