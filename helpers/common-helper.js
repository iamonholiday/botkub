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

  static toPriceNumber(value, decimal = 3) {
    const temp = typeof value === "string" ? value.replace(",", "") : value;
    return Number(parseFloat(temp).toFixed(decimal));
  }

  static toQtyNumber(value, decimal = 3) {
    const temp = typeof value === "string" ? value.replace(",", "") : value;
    let nValue = Number(parseFloat(temp).toFixed(decimal));

    if (`${nValue}`.split(".")[1].length > decimal) {
      return nValue;
    } else {
      let tempText = ".";
      for (let i = 0; i < decimal - 1; i++) {
        tempText += "0";
      }
      tempText += "1";
      nValue = Number(tempText);
    }
    return nValue;
  }

  static hashCode(data) {
    // Digest data with seed.
    const hash = crypto.createHash("sha256");
    hash.update(data);
    const digest = hash.digest("hex");
    return digest;
  }
};
