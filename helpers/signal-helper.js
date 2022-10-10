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
    const firestore = admin.firestore();
    firestore.settings({ignoreUndefinedProperties: true});
  }
};

const getDB = () => {
  initApp();
  const firestore = admin.firestore();
  return firestore;
};

const FIXED_LENGTH = 3;

const PULSE_COLLECTION = "pulses";
const SIGNAL_COLLECTION = "signals";
const PROPOSALS_COLLECTION = "proposals";

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
  static formatSignal(data) {
    // messageType|group|indy|side|ticker|time|interval|entry|mark|sl|leverage|expiry|exchange
    const body = data.split(SEPERATOR).slice(1);
    const json = body.map((row) => {
      // eslint-disable-next-line max-len
      let [messageType, group, indy, side, ticker, time, interval, entry, mark, sl, leverage,
        tp0, tp1, tp2, tp3, tp4, tp5, tp6, tp7, tp8, tp9,
        expiry, exchange] = row.split("|");

      // common fields
      const symbol = ticker;
      const obsoletedFlag = "n";
      const usedTime = null;
      time = toDate(time);
      entry = toNumber(entry);
      expiry = toDate(expiry);
      mark = toNumber(mark);

      side = side === "1" ? "buy" : "sell";

      // pulse fields.
      sl = toNumber(sl);
      leverage = toNumber(leverage);

      tp0 = toNumber(tp0);
      tp1 = toNumber(tp1);
      tp2 = toNumber(tp2);
      tp3 = toNumber(tp3);
      tp4 = toNumber(tp4);
      tp5 = toNumber(tp5);
      tp6 = toNumber(tp6);
      tp7 = toNumber(tp7);
      tp8 = toNumber(tp8);
      tp9 = toNumber(tp9);

      const retData = {
        // core data.
        messageType, group, indy, side, symbol, time, interval, entry, mark, sl, expiry, exchange,
        leverage,
        tp0, tp1, tp2, tp3, tp4, tp5, tp6, tp7, tp8, tp9,
        // extension.
        obsoletedFlag, hostname, usedTime,
      };

      return retData;
    });

    return json;
  }

  static formatPulseStopLoss(data) {
    // original data
    // messageType|group|indy|side|ticker|time|interval|entry|mark|sl|expiry|exchange

    const body = data.split(SEPERATOR).slice(1);
    const json = body.map((row) => {
      // eslint-disable-next-line max-len
      let [messageType, group, indy, side, ticker, time, interval, entry, mark, sl, expiry, exchange] = row.split("|");

      // common fields
      const symbol = ticker;
      const obsoletedFlag = "n";
      const usedTime = null;
      time = toDate(time);
      entry = toNumber(entry);
      expiry = toDate(expiry);
      mark = toNumber(mark);

      side = side === "1" ? "buy" : "sell";


      return {
        // core data.
        messageType, group, indy, side, symbol, time, interval, entry, mark, sl,
        expiry, exchange,
        // extension.
        obsoletedFlag, hostname, usedTime,
      };
    });

    return json;
  }

  static formatPulseTakeProfit(data) {
    // original data
    // messageType|group|indy|side|ticker|time|interval|entry|mark|tp0|tp1|tp2|tp3|tp4|tp5|tp6|tp7|tp9|tp9|expiry|exchange

    const body = data.split(SEPERATOR).slice(1);
    const json = body.map((row) => {
      // eslint-disable-next-line max-len
      let [
        messageType, group, indy, side, ticker, time, interval, entry, mark, tp0, tp1, tp2, tp3, tp4, tp5, tp6, tp7, tp8, tp9, expiry, exchange,
      ] = row.split("|");

      // common fields
      const symbol = ticker;
      const obsoletedFlag = "n";
      const usedTime = null;
      time = toDate(time);
      mark = toNumber(mark);
      expiry = toDate(expiry);

      side = side === "1" ? "buy" : "sell";

      // pulse fields.
      const takeProfitList = [];
      takeProfitList.push(toNumber(tp0));
      takeProfitList.push(toNumber(tp1));
      takeProfitList.push(toNumber(tp2));
      takeProfitList.push(toNumber(tp3));
      takeProfitList.push(toNumber(tp4));
      takeProfitList.push(toNumber(tp5));
      takeProfitList.push(toNumber(tp6));
      takeProfitList.push(toNumber(tp7));
      takeProfitList.push(toNumber(tp8));
      takeProfitList.push(toNumber(tp9));


      return {
        messageType, group, indy, side, symbol, time, interval, entry, mark, expiry, exchange,
        takeProfitList,
        obsoletedFlag, hostname, usedTime,

      };
    });

    return json;
  }

  static getPulseName(data) {
    const body = data.split(SEPERATOR).slice(1);
    // eslint-disable-next-line prefer-destructuring
    const group = body[0].split("|")[1];
    return group;
  }

  static isSignalOrPulse(data) {
    if (data.indexOf(`${SEPERATOR}signal|`) > -1) {
      return "signal";
    } else if (data.indexOf(`${SEPERATOR}pulse|`) > -1) {
      return "pulse";
    }
    return null;
  }

  static async readPulse(exchange, symbol, interval, group = null) {
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
    if (group) {
      query = query.where("group", "==", group);
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

  static async readSignal(exchange, symbol, interval, messageType, side) {
    let json;

    try {
      const db = getDB();
      const collection = db.collection(SIGNAL_COLLECTION);
      let query = collection
          .where("exchange", "==", exchange)
          .where("symbol", "==", symbol)
          .where("interval", "==", interval)
          .where("messageType", "==", messageType)
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
      if (error.message.indexOf("The query requires an index.") > -1) {
        console.warn("The query requires an index. Please create index on firestore.");
      } else {
        console.log(error);
      }
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
    functions.logger.info("signalHandler:raw data", data);

    const json = SignalHelper.formatSignal(text);
    const db = getDB();
    const collection = db.collection(SIGNAL_COLLECTION);

    // Find collection by symbol and update readTime.
    const query = collection
        .where("symbol", "==", json[0].symbol)
        .where("interval", "==", json[0].interval)
        .where("messageType", "==", json[0].messageType)
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
      messageType: _.first(json).messageType,
      side: _.first(json).side,
    };
  }

  static async pulseHandler(data) {
    // Store text data from request body.
    const text = data;
    let json;

    // Log text data.
    functions.logger.info("pulseHandler:raw data", data);


    const pulseName = SignalHelper.getPulseName(text);

    if (pulseName === "STOP LOSS") {
      json = SignalHelper.formatPulseStopLoss(text);
    } else if (pulseName === "TAKE PROFIT LIST") {
      json = SignalHelper.formatPulseTakeProfit(text);
    } else {
      functions.logger.info("error", "pulseName is not found", pulseName);
    }

    const db = getDB();
    const collection = db.collection(PULSE_COLLECTION);

    // Find collection by symbol and update readTime.
    const query = collection
        .where("symbol", "==", json[0].symbol)
        .where("interval", "==", json[0].interval)
        .where("messageType", "==", json[0].messageType)
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
      side: _.first(json).side,
      messageType: _.first(json).messageType,
      group: _.first(json).group,
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

  static async getProposalBySymbol(symbol, side, entryPrice,exchange="binance") {

    const db = getDB();
    const collection = db.collection(PROPOSALS_COLLECTION);

    // Find collection by symbol and update readTime.
    const query = collection
        .where("symbol", "==", symbol)
        .where("side", "==", side)
        .where("entry", "==", entryPrice)
        .where("messageType", "==", "signal")
        .where("group", "==", "BUYSELL")
    ;
    const snapshot = await query.get();
    const readRecs = snapshot.docs.map((doc) => {
      const docData = doc.data();
      // Store doc ID in docData.
      docData.id = doc.id;
      return docData;
    });

    // Return latest data by time.
    return _.first(_.orderBy(readRecs, ["time"], ["desc"]));
  }
};
