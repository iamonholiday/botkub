require("firebase-admin");
// const _ = require("lodash");

// Init firebase app.
const admin = require("firebase-admin");
const functions = require("firebase-functions");
const os = require("os");
const hostname = os.hostname();

const SEPERATOR = "##########";

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

const FIXED_LENGTH = 3;

const PULSE_COLLECTION = "pulses";
const SIGNAL_COLLECTION = "signals";

const toNumber = (value) => {
  return Number(parseFloat(value).toFixed(FIXED_LENGTH));
};

exports.SignalHelper = class SignalHelper {
  static formatSignalMayMae(data) {
    // original data
    // signal|side|ticker|time|interval|entry|stopLoss|fastLine|expiry|exchange
    const body = data.split(SEPERATOR).slice(1);
    const json = body.map((row) => {
      // eslint-disable-next-line max-len
      let [signal, side, ticker, time, interval, entry, stopLoss, fastLine, expiry, exchange] = row.split("|");

      // common fields
      const symbol = ticker;
      const obsoletedFlag = "n";
      const usedTime = null;
      time = new Date(time);
      entry = toNumber(entry); // parseFloat(entry).toFixed(FIXED_LENGTH);
      expiry = new Date(Number(expiry));


      // pulse fields.
      stopLoss = toNumber(stopLoss); // parseFloat(stopLoss).toFixed(FIXED_LENGTH);
      fastLine = toNumber(fastLine); // parseFloat(fastLine).toFixed(FIXED_LENGTH);

      return {
        signal, side, symbol, time, interval, entry, stopLoss, fastLine, expiry, exchange, obsoletedFlag, hostname, usedTime,
      };
    });

    return json;
  }

  static formatPulseStopLoss(data) {
    // original data
    // pulse|ticker|time|interval|mark|buyStopLoss|sellStopLoss|expiry|exchange##########STOP LOSS|BTCUSDTPERP|2022-08-30T12:55:00Z|5|20326.4|null|20406.584846685735|1661864700319|BINANCE

    const body = data.split(SEPERATOR).slice(1);
    const json = body.map((row) => {
      // eslint-disable-next-line max-len
      let [pulse, ticker, time, interval, mark, buyStopLoss, sellStopLoss, expiry, exchange] = row.split("|");

      // common fields
      const symbol = ticker;
      const obsoletedFlag = "n";
      const usedTime = null;
      time = new Date(time);
      mark = toNumber(mark); // parseFloat(mark).toFixed(FIXED_LENGTH);
      expiry = new Date(Number(expiry));
      mark = toNumber(mark); // parseFloat(mark).toFixed(FIXED_LENGTH);


      // pulse fields.
      buyStopLoss = toNumber(buyStopLoss); // parseFloat(buyStopLoss).toFixed(FIXED_LENGTH) || null;
      sellStopLoss = toNumber(sellStopLoss); // parseFloat(sellStopLoss).toFixed(FIXED_LENGTH) || null;

      return {
        pulse, symbol, time, interval, mark, buyStopLoss, sellStopLoss, expiry, exchange, obsoletedFlag, hostname, usedTime,
      };
    });

    return json;
  }

  static formatPulseLX(data) {
    // original data
    // pulse|ticker|time|interval|mark|lx|expiry|exchange##########LX|BTCUSDTPERP|2022-08-30T12:55:00Z|5|20326.4|7|1661864700318|BINANCE

    const body = data.split(SEPERATOR).slice(1);
    const json = body.map((row) => {
      // eslint-disable-next-line max-len
      let [pulse, ticker, time, interval, mark, lx, expiry, exchange] = row.split("|");

      // common fields
      const symbol = ticker;
      const obsoletedFlag = "n";
      const usedTime = null;
      time = new Date(time);
      mark = toNumber(mark); // parseFloat(mark).toFixed(FIXED_LENGTH);
      expiry = new Date(expiry);
      mark = toNumber(mark); // parseFloat(mark).toFixed(FIXED_LENGTH);

      // pulse fields.
      lx = toNumber(lx); // parseFloat(lx).toFixed(FIXED_LENGTH);

      return {
        pulse, symbol, time, interval, mark, lx, expiry, exchange, obsoletedFlag, hostname, usedTime,
      };
    });

    return json;
  }

  static formatPulseCCI200(data) {
    // original data
    // pulse|ticker|time|interval|mark|cci200|expiry|exchange##########CCI200|BTCUSDTPERP|2022-08-30T12:55:00Z|5|20326.4|80|1661864700318|BINANCE

    const body = data.split(SEPERATOR).slice(1);
    const json = body.map((row) => {
      // eslint-disable-next-line max-len
      let [pulse, ticker, time, interval, mark, cci200, expiry, exchange] = row.split("|");

      // common fields
      const symbol = ticker;
      const obsoletedFlag = "n";
      const usedTime = null;
      time = new Date(time);
      mark = toNumber(mark); // parseFloat(mark).toFixed(FIXED_LENGTH);
      expiry = new Date(expiry);
      mark = toNumber(mark); // parseFloat(mark).toFixed(FIXED_LENGTH);

      // pulse fields.
      cci200 = toNumber(cci200); // parseFloat(cci200).toFixed(FIXED_LENGTH);

      return {
        pulse, symbol, time, interval, mark, cci200, expiry, exchange, obsoletedFlag, hostname, usedTime,
      };
    });

    return json;
  }

  static getPulseName(data) {
    const body = data.split(SEPERATOR).slice(1);
    const [pulse] = body[0].split("|");
    return pulse;
  }

  static isSignalOrPulse(data) {
    if (data.indexOf("pulse") === 0) {
      return "pulse";
    } else if (data.indexOf("signal") === 0) {
      return "signal";
    }
    return "";
  }

  static async readPulse(ticker) {
    const db = getDB();
    const collection = db.collection(PULSE_COLLECTION);
    // Query collection where ticker is equal to ticker and readTime is not exits.
    const query = collection
        .where("ticker", "==", ticker)
        .where("readTime", "!=", null)
        .orderBy("time", "desc");

    const snapshot = await query.get();
    const json = snapshot.docs.map((doc) => {
      const docData = doc.data();

      // Store doc ID in docData.
      docData.id = doc.id;
      return docData;
    }).reverse();

    // Make sure json is not undefined or empty.
    if (!json || json.length === 0) {
      return [];
    }

    return json;
  }

  static async readSignal(ticker) {
    const db = getDB();
    const collection = db.collection(SIGNAL_COLLECTION);
    const query = collection.where("ticker", "==", ticker);
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

  static async markReadFlag(dataType, readRecs) {
    // Raise error if dataType is not valid.
    if (!["signals", "pulse"].includes(dataType)) {
      throw new Error("Invalid dataType");
    }

    // Update read records.
    const db = getDB();
    const collection = db.collection(dataType);
    const batch = db.batch();
    readRecs.forEach((row) => {
      const doc = collection.doc(row.id);
      batch.update(doc, {readTime: null});
    });
    await batch.commit();
  }

  static async signalHandler(data) {
    // Store text data from request body.
    const text = data;
    // Log text data.
    functions.logger.info("data", data);

    const json = SignalHelper.formatSignalMayMae(text);


    admin.initializeApp();

    const db = getDB();
    const collection = db.collection(SIGNAL_COLLECTION);

    // Find collection by symbol and update readTime.
    const query = collection
        .where("symbol", "==", json[0].symbol)
        .where("interval", "==", json[0].interval)
        .where("signal", "==", json[0].signal)
        .where("obsoletedFlag", "==", "n")
    ;
    const snapshot = await query.get();
    const readRecs = snapshot.docs.map((doc) => {
      const docData = doc.data();
      // Store doc ID in docData.
      docData.id = doc.id;
      return docData;
    });

    // Update read records.
    const batch = db.batch();
    readRecs.forEach((row) => {
      const doc = collection.doc(row.id);
      batch.update(doc, {
        obsoletedFlag: "y",
      });
    });

    // Add new records.
    json.forEach((row) => {
      const doc = collection.doc();
      batch.set(doc, row);
    });

    await batch.commit();
  }

  static async pulseHandler(data) {
    // Store text data from request body.
    const text = data;
    let json;

    // Log text data.
    functions.logger.info("data", data);


    const pulseName = SignalHelper.getPulseName(text);

    if (pulseName === "STOP LOSS") {
      json = SignalHelper.formatPulseStopLoss(text);
    } else if (pulseName === "LX") {
      json = SignalHelper.formatPulseLX(text);
    } else if (pulseName === "CCI200") {
      json = SignalHelper.formatPulseCCI200(text);
    } else {
      functions.logger.info("error", "pulseName is not found", pulseName);
    }

    const db = getDB();
    const collection = db.collection(PULSE_COLLECTION);

    // Find collection by symbol and update readTime.
    const query = collection
        .where("symbol", "==", json[0].symbol)
        .where("interval", "==", json[0].interval)
        .where("pulse", "==", json[0].pulse)
        .where("obsoletedFlag", "==", "n")
    ;
    const snapshot = await query.get();
    const readRecs = snapshot.docs.map((doc) => {
      const docData = doc.data();
      // Store doc ID in docData.
      docData.id = doc.id;
      return docData;
    });

    // Update read records.
    const batch = db.batch();
    readRecs.forEach((row) => {
      const doc = collection.doc(row.id);
      batch.update(doc, {
        obsoletedFlag: "y",
      });
    });

    // Add new records.
    json.forEach((row) => {
      const doc = collection.doc();
      batch.set(doc, row);
    });

    await batch.commit();
  }
};
