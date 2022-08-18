require("firebase-admin");
const _ = require("lodash");

// Init firebase app.
const admin = require("firebase-admin");
const functions = require("firebase-functions");


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

const formatPulseEMA = (data) => {
  const body = data.split("\n").slice(1);
  const json = body.map((row) => {
    // eslint-disable-next-line max-len
    let [pulse, ticker, time, interval, mark, fastEMA, slowEMA] = row.split("|");
    time = new Date(time);
    mark = parseFloat(mark);
    fastEMA = parseFloat(fastEMA);
    slowEMA = parseFloat(slowEMA);

    return {
      pulse, ticker, time, interval, mark, fastEMA, slowEMA,
    };
  });

  return json;
};

const formatPulseCCI200 = (data) => {
  // original data
  // pulse|ticker|time|interval|mark|CCI200
  const body = data.split("\n").slice(1);
  const json = body.map((row) => {
    let [pulse, ticker, time, interval, mark, cci200] = row.split("|");
    time = new Date(time);
    mark = parseFloat(mark);
    cci200 = parseFloat(cci200);

    return {
      pulse, ticker, time, interval, mark, cci200,
    };
  });

  return json;
};

const formatSignalMayMae = (data) => {
  // original data
  // side|ticker|time|interval|entry|pp|r1|r2|r3|r4|r5|fastEMA
  const body = data.split("\n").slice(1);
  const json = body.map((row) => {
    // eslint-disable-next-line max-len
    let [side, ticker, time, interval, entry, pp, l1, l2, l3, l4, l5, fastEMA] = row.split("|");
    time = new Date(time);
    entry = parseFloat(entry);
    pp = parseFloat(pp);
    l1 = parseFloat(l1);
    l2 = parseFloat(l2);
    l3 = parseFloat(l3);
    l4 = parseFloat(l4);
    l5 = parseFloat(l5);
    fastEMA = parseFloat(fastEMA);


    return {
      side, ticker, time, interval, entry, pp, l1, l2, l3, l4, l5, fastEMA,
    };
  });

  return json;
};

const getPulseName = (data) => {
  const body = data.split("\n").slice(1);
  const [pulse] = body[0].split("|");
  return pulse;
};

const isSignalOrPulse = (data) => {
  if (data.indexOf("pulse") === 0) {
    return "pulse";
  } else if (data.indexOf("side") === 0) {
    return "signal";
  }
  return "";
};

const readPulse = async (ticker) => {
  const db = getDB();
  const collection = db.collection("pulse");
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
};

const readSignal = async (ticker) => {
  const db = getDB();
  const collection = db.collection("signals");
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
};

exports.formatPulseEMA = formatPulseEMA;

exports.formatPulseCCI200 = formatPulseCCI200;

exports.formatSignalMayMae = formatSignalMayMae;

exports.getPulseName = getPulseName;

exports.isSignalOrPulse = isSignalOrPulse;

exports.signalHandler = async (data) => {
  // Store text data from request body.
  const text = data;
  // Log text data.
  functions.logger.info("data", data);

  const json = formatSignalMayMae(text);


  admin.initializeApp();

  // Write JSON array to Firebase.
  const db = getDB();
  const collection = db.collection("signals");
  const batch = db.batch();
  json.forEach((row) => {
    const doc = collection.doc();
    const iRefinedData = _.pickBy(row, (v) => v !== null && v !== undefined);
    iRefinedData.readTime = null;
    batch.set(doc, iRefinedData);
  });
  await batch.commit();
};

exports.pulseHandler = async (data) => {
  // Store text data from request body.
  const text = data;
  let json;

  // Log text data.
  functions.logger.info("data", data);


  const pulseName = getPulseName(text);
  if (pulseName === "EMA") {
    json = formatPulseEMA(text);
  } else if (pulseName === "CCI200") {
    json = formatPulseCCI200(text);
  } else {
    functions.logger.info("error", "pulseName is not found", pulseName);
  }

  const db = getDB();
  const collection = db.collection("pulse");
  const batch = db.batch();
  json.forEach((row) => {
    const doc = collection.doc();
    const iRefinedData = _.pickBy(row, (v) => v !== null && v !== undefined);
    iRefinedData.readTime = null;
    batch.set(doc, iRefinedData);
  });
  await batch.commit();
};

exports.readSignal = readSignal;

exports.readPulse = readPulse;

exports.markReadFlag = async (dataType, readRecs) => {
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
};
