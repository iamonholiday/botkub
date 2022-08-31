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
    const mapped = _.transforms(dict, (result, ie, key) => {
      // Convert to int if keys contain key.
      if (keys.includes(key)) {
        result[key] = Number(ie);
      }
    });

    return mapped;
  }
};
