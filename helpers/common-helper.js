const _ = require("lodash");
const crypto = require("crypto");
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

  static toPriceNumber(value) {
    const FIXED_LENGTH = 3;
    return Number(parseFloat(value).toFixed(FIXED_LENGTH));
  }

  static hashCode(data) {
    // Digest data with seed.
    const hash = crypto.createHash("sha256");
    hash.update(data);
    const digest = hash.digest("hex");
    return digest;
  }
};
