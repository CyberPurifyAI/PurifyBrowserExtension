/**
 * ----------------------------------------------------------------------------------
 * PurifyBrowserExtension concurrent-queue.js
 * Licensed under MIT (https://github.com/CyberPurify/CyberPurify/blob/main/LICENSE)
 * ----------------------------------------------------------------------------------
 */

/**
 * concurrent queue
 */
(function () {
  "use strict";

  const concurrentQueue = function (
    concurrency,
    timeout,
    onProcess,
    onSuccess,
    onFailure,
    onDone,
    onDrain
  ) {
    const TIMEOUT = timeout;
    const count = 0;
    const waiting = [];
    const paused = false;

    const add = function (task) {
      const hasChannel = count < concurrency;

      if (hasChannel) {
        next(task);
        return;
      }

      waiting.push(task);
    };

    const next = function (task) {
      count++;

      onProcess(task, (err, result) => {
        if (err !== undefined) {
          onFailure(err);
        } else {
          onSuccess(result);
        }

        if (onDone !== undefined) onDone(err !== undefined ? err : result);

        count--;

        if (!paused && waiting.length > 0) {
          const task = waiting.shift();
          setTimeout(() => next(task), TIMEOUT);
          return;
        }

        if (count === 0 && waiting.length === 0) {
          if (onDrain !== undefined) onDrain();
        }
      });
    };

    const pause = function () {
      paused = true;
    };

    const resume = function () {
      if (waiting.length > 0) {
        const channels = concurrency - count;

        for (let i = 0; i < channels; i++) {
          const task = waiting.shift();
          next(task);
        }
      }
      paused = false;
    };

    const getTaskAmount = function () {
      return waiting.length;
    };

    return {
      add,
      next,
      pause,
      resume,
      getTaskAmount,
    };
  };

  api.concurrentQueue = concurrentQueue;
})(purify.utils, window);
