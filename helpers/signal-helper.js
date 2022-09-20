require("firebase-admin");
const _ = require("lodash");

// Init firebase app.
const admin = require("firebase-admin");
const functions = require("firebase-functions");
const os = require("os");
const {CommonHelper} = require("./common-helper");
const hostname = os.hostname();

const DEBUG_IGNORE_FULL_FILTER = false;


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
  const sanitized = value.toString().replace(/,/g, "");
  return Number(parseFloat(sanitized).toFixed(FIXED_LENGTH));
};
const toDate = (value) => {
  if (value.toDate) {
    return value.toDate();
  } else if (isNaN(Number(value))) {
    return new Date(value);
  }
  return new Date(Number(value));
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
      time = toDate(time);
      entry = toNumber(entry);
      expiry = toDate(expiry);


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
      time = toDate(time);
      mark = toNumber(mark);
      expiry = toDate(expiry);


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
      time = toDate(time);
      mark = toNumber(mark);
      expiry = toDate(expiry);

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
      let [
        pulse, ticker, time, interval, mark, cci200, tpBuy, tpSell, expiry, exchange,
      ] = row.split("|");

      // common fields
      const symbol = ticker;
      const obsoletedFlag = "n";
      const usedTime = null;
      time = toDate(time);
      mark = toNumber(mark);
      expiry = toDate(expiry);

      // pulse fields.
      cci200 = CommonHelper.toPriceNumber(cci200);
      tpBuy = CommonHelper.toPriceNumber(tpBuy);
      tpSell = CommonHelper.toPriceNumber(tpSell);


      return {
        pulse, symbol, time, interval, mark, cci200, tpBuy, tpSell, expiry, exchange, obsoletedFlag, hostname, usedTime,
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

  static async readPulse(exchange, symbol, interval, pulse = null) {
    const db = getDB();
    const collection = db.collection(PULSE_COLLECTION);
    // Query collection where ticker is equal to ticker and readTime is not exits.
    let query = collection
        .where("exchange", "==", exchange)
        .where("symbol", "==", symbol)
        .where("interval", "==", interval)
    ;

    if (DEBUG_IGNORE_FULL_FILTER === false) {
      query = collection
          .where("usedTime", "==", null)
          .where("obsoletedFlag", "==", "n")
          .where("expiry", ">", new Date());
    }

    // If pulse was sent.
    if (pulse) {
      query = query.where("pulse", "==", pulse);
    }

    const snapshot = await query.get();
    const json = snapshot.docs
        .sort((a, b) => a.data().time - b.data().time)
        .map((doc) => {
          const docData = doc.data();
          const iMapped = CommonHelper.parseFirebaseDateToDateByKey(docData, "expiry", "time", "usedTime" );
          return iMapped;
        });

    // Make sure json is not undefined or empty.
    if (!json || json.length === 0) {
      return [];
    }

    let ret = json;
    if (Array.isArray(json)) {
      ret = _.uniqBy(json, "pulse");
    }

    return ret;
  }

  static async readSignal(exchange, symbol, interval, signal, side) {
    let json;

    try {
      const db = getDB();
      const collection = db.collection(SIGNAL_COLLECTION);
      let query = collection
          .where("exchange", "==", exchange)
          .where("symbol", "==", symbol)
          .where("interval", "==", interval)
          .where("signal", "==", signal)
          .where("side", "==", side)

      ;

      if (DEBUG_IGNORE_FULL_FILTER === false) {
        query = query
            .where("usedTime", "==", null)
            .where("obsoletedFlag", "==", "n")
            .where("expiry", ">", new Date());
      }

      const snapshot = await query.get();
      json = snapshot.docs
          .sort((a, b) => a.data().time - b.data().time)
          .map((doc) => {
            const docData = doc.data();
            const iMapped = CommonHelper.parseFirebaseDateToDateByKey(docData, "expiry", "time", "usedTime" );
            return iMapped;
          });

      // Make sure json is not undefined or empty.
      if (!json || json.length === 0) {
        return null;
      }
    } catch (error) {
      // log error.
      console.log(error);
    }

    // Return latest signal.
    return json[0];
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

  static async cleanUp(dataType) {
    // Raise error if dataType is not valid.
    if (!["signals", "pulses"].includes(dataType)) {
      throw new Error("Invalid dataType");
    }

    // Update read records.
    const db = getDB();
    const collection = db.collection(dataType);
    // Find all records that are not read.
    const snapshot = await collection.where("hostname", "==", "codeengines-MacBook-Pro.local").get();
    const readRecs = snapshot.docs;

    // Delete all records that are not read by chunk.
    const chunkSize = 500;
    const chunked = _.chunk(readRecs, chunkSize);
    for (let i = 0; i < chunked.length; i++) {
      const batch = db.batch();
      chunked[i].forEach((row) => {
        batch.delete(collection.doc(row.id));
      });
      await batch.commit();
    }
  }

  static async signalHandler(data) {
    // Store text data from request body.
    const text = data;
    // Log text data.
    functions.logger.info("data", data);

    const json = SignalHelper.formatSignalMayMae(text);


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


    return {
      exchange: _.first(json).exchange,
      symbol: _.first(json).symbol,
      interval: _.first(json).interval,
      signal: _.first(json).signal,
      side: _.first(json).side,
    };
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

    return {
      exchange: _.first(json).exchange,
      symbol: _.first(json).symbol,
      interval: _.first(json).interval,
      pulse: _.first(json).pulse,
    };
  }

  static async getSymbolFromBody(data) {
    // original data
    // signal|side|ticker|time|interval
    const body = data.split(SEPERATOR).slice(1);
    const json = body.map((row) => {
      // eslint-disable-next-line max-len
      let [signal, side, ticker, time, interval] = row.split("|");

      // common fields
      const symbol = ticker;
      time = new Date(time);


      return {
        signal, side, symbol, time, interval,
      };
    });

    return _.first(json);
  }
};
