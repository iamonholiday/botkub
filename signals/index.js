// Get Latest Comp Signal.
require("firebase-admin");
// const _ = require("lodash");

// Init firebase app.
const admin = require("firebase-admin");


const initApp = () => {
  // Check if the app is initialized.
  if (admin.apps.length === 0) {
    admin.initializeApp();
  }
};

const getDB = () => {
  initApp();
  return admin.firestore();
};

const ALLOW_PULSE_LIST = ["EMA", "CCI200"];

exports.Signal = class {
  /**
   * Get pulse by timeframe. *
   * @param {string} symbol -> Symbol of the symbol.
   * @param {string} pulse -> Pulse name.
   * @param {string} timeFrame -> Timeframe of the symbol.
   * @param {boolean} allowedLast24H -> If true, only return the last 24 hours.
   * @return {Promise<*[]|FirebaseFirestore.DocumentData[]>}
   */
  async getPulses(symbol, pulse, timeFrame, allowedLast24H = true) {
    // Validate if pulse is allowed.
    if (!ALLOW_PULSE_LIST.includes(pulse)) {
      throw new Error(`Pulse ${pulse} is not allowed.`);
    }


    const db = getDB();
    const collection = db.collection("pulse");
    const query = collection.where("ticker", "==", symbol)
        .where("interval", "==", timeFrame)
        .orderBy("time", "desc");
    const snapshot = await query.get();
    const json = snapshot.docs.map((doc) => {
      return doc.data();
    }).reverse();

    // Make sure json is not undefined or empty.
    if (!json || json.length === 0) {
      return [];
    }

    return json;
  }
};
