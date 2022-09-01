const _ = require("lodash");
const {CommonHelper} = require("./helpers/common-helper");
const {ProposalManager} = require("./proposals");

const {SignalHelper} = require("./helpers/signal-helper");

const functions = require("firebase-functions");

const {config} = require("firebase-functions");

const doPost = async (functionName, body) => {
  const fetch = (...args) => import("node-fetch").then(({default: fetch}) => fetch(...args));

  const url = 1 === Number("1") ?
        `http://localhost:5001/botkub-27c4e/us-central1/${functionName}` :
        `https://us-central1-${config().firebase.projectId}.cloudfunctions.net/${functionName}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return res.json();
};

const getEnviromentToken = () => {
  const {env} = process;
  const {BINANCE_API_KEY, BINANCE_API_SECRET} = env;
  const rawData = `${BINANCE_API_KEY}:${BINANCE_API_SECRET}`;
  const hash = CommonHelper.hashCode(rawData);
  return hash;
};

const sanitizedData = (data) => {
  const seperator = "##########";
  const [head, body] = data.split(seperator);
  const newData = `${head}${seperator}${body}`;
  return newData;
};

exports.cleanData = functions.https.onRequest(async (req, res) => {
  // Store dataType and token from body.
  const {dataType, token} = req.body;

  // Validate token.
  const hash = getEnviromentToken();
  if (hash !== token) {
    res.status(403).send("Invalid token");
    return;
  }

  // Clean DB data.
  await SignalHelper.cleanUp(dataType);
  res.send({
    message: "Cleaned data.",
  });
});

exports.generateToken = functions.https.onRequest(async (req, res) => {
  // Store api key and secret from query string.
  const {apiKey, apiSecret} = req.query;
  const rawData = `${apiKey}:${apiSecret}`;
  const hash = CommonHelper.hashCode(rawData);
  res.send({
    token: hash,
  });
});

exports.updateByData = functions.https.onRequest(async (req, res) => {
  const hash = getEnviromentToken();
  const token = _.last(req.body.split("|"));

  if (hash !== token) {
    res.status(403).send("Invalid token");
    return;
  }

  const text = sanitizedData(req.body);
  const dataType = SignalHelper.isSignalOrPulse(text);

  let ret = {};

  if (dataType === "signal") {
    const {
      exchange,
      symbol,
      interval,
      signal,
      side,
    } = await SignalHelper.signalHandler(text);
    ret = {message: "Signal has been updated successfully."};

    const recSignal = await SignalHelper.readSignal(exchange, symbol, interval, signal, side);
    const recPulses = await SignalHelper.readPulse(exchange, symbol, interval);

    const toProposal = {
      signal: recSignal,
      pulses: recPulses,
    };

    // Spawn proposals.
    doPost("exeProposal", toProposal)
        .then((result) => {
          functions.logger.info("result", "result", result);
        });
  } else if (dataType === "pulse") {
    const {
      exchange,
      symbol,
      interval,
      pulse,
    } = await SignalHelper.pulseHandler(text);
    ret ={message: "Pulse has been successfully."};

    const returnedRecs = await SignalHelper.readPulse(exchange, symbol, interval, pulse);

    const toProposal = {
      signal: null,
      pulses: returnedRecs,
    };

    const ALLOW_PULSE_PROPOSAL_LIST = ["STOP LOSS", "CCI200"];
    if (ALLOW_PULSE_PROPOSAL_LIST.includes(pulse)) {
      // Spawn proposals.
      doPost("exeProposal", toProposal)
          .then((result) => {
            functions.logger.info("result", "result", result);
          });
    }
  } else {
    // Log respond data.
    functions.logger.info("error", "dataType is not found", dataType);
    ret = {
      "error": "dataType is not found",
      "data": dataType,
    };
  }
  res.json(ret);
});


/**
 * Receive JSON for excecute proposal.
 */
exports.exeProposal = functions.https.onRequest(async (req, res) => {
  // Log request data.
  functions.logger.info("req.body", "req.body", req.body);


  const {signal, pulses} = req.body;
  const signalRFQ = signal ? ProposalManager.createSignalRFQ(signal) : null;
  const pulseRFQ = pulses.map((iPulse) => ProposalManager.createPulseRFQ(iPulse));


  const proposal = new ProposalManager(signalRFQ, pulseRFQ);
  await proposal.execute();
  console.log( signal, pulses, signalRFQ, pulseRFQ);
});
