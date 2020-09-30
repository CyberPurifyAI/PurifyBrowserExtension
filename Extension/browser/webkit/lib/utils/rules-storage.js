

/**
 * Filter rules storage implementation
 */
purify.rulesStorageImpl = (function (purify) {
  var read = function (path, callback) {
    try {
      var value = purify.localStorageImpl.getItem(path);
      var lines = [];
      if (value) {
        lines = value.split(/[\r\n]+/);
      }
      callback(null, lines);
    } catch (ex) {
      callback(ex);
    }
  };

  var write = function (path, data, callback) {
    var value = data.join("\n");
    try {
      purify.localStorageImpl.setItem(path, value);
      callback();
    } catch (ex) {
      callback(ex);
    }
  };

  var remove = function (path, successCallback) {
    purify.localStorageImpl.removeItem(path);
    successCallback();
  };

  return {
    write: write,
    read: read,
    remove: remove,
  };
})(purify);
