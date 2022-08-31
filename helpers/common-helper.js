const _ = require("lodash");

/**
 * Common Helper
 */
exports.CommonHelper = class {
  /**
     *
     * @param {Object} dict ->
     * @param {...string} keys ->
     */
  static parseNumberByKey(dict, ...keys) {
    const mapped = _.transform(dict, (result, ie, key) => {
      // Convert to int if keys contain key.
      if (keys.includes(key)) {
        result[key] = Number(ie);
      } else {
        result[key] = ie;
      }
    });

    return mapped;
  }

  /**
   *
   * @param {Object} dict ->
   * @param {...string} keys ->
   */
  static parseFirebaseDateToDateByKey(dict, ...keys) {
    const mapped = _.transform(dict, (result, ie, key) => {
      // Convert to int if keys contain key.
      if (keys.includes(key) && ie) {
        result[key] = ie.toDate();
      } else {
        result[key] = ie;
      }
    });

    return mapped;
  }
};
