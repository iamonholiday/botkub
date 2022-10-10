const {OrderManager} = require("./orders/order-helper");
// const line = require("@line/bot-sdk");
// const _ = require("lodash");
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

const getEnvironmentToken = () => {
  const {env} = process;
  const {BINANCE_API_KEY, BINANCE_API_SECRET} = env;
  const rawData = `${BINANCE_API_KEY}:${BINANCE_API_SECRET}`;
  const hash = CommonHelper.hashCode(rawData);
  return hash;
};

const sanitizedData = (data) => {
  const separator = "##########";
  const [head, body] = data.split(separator);
  const newData = `${head}${separator}${body}`;
  return newData;
};

const pushMessageToLine = async (text, type = "text") => {
  return true;
  //
  // // Store line token.
  // const {env} = process;
  // const {LINE_CHANNEL_ACCESS_TOKEN, LINE_CHANNEL_ID} = env;
  // // LINE_CHANNEL_ACCESS_SECRET
  //
  // const client = new line.Client({
  //   channelAccessToken: LINE_CHANNEL_ACCESS_TOKEN,
  //   // channelSecret: LINE_CHANNEL_ACCESS_SECRET,
  // });
  //
  // const message = {
  //   type,
  //   text,
  // };
  //
  // let pushResult;
  // try {
  //   pushResult = await client.pushMessage(LINE_CHANNEL_ID, message);
  // } catch (e) {
  //   console.log(e);
  // }
  // return pushResult;
};

exports.cleanData = functions.https.onRequest(async (req, res) => {
  // Store dataType and token from body.
  const {dataType, token} = req.body;

  // Validate token.
  const hash = getEnvironmentToken();
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
  // pushMessageToLine("ake test").then(() => {});

  // eslint-disable-next-line no-unreachable
  const hash = getEnvironmentToken();
  const {token} = req.query;
  let message;

  if (hash !== token) {
    res.status(403).send("Invalid token");
    return;
  }

  const text = sanitizedData(req.body);
  const dataType = SignalHelper.isSignalOrPulse(text);

  let ret = {};

  if (dataType === "signal") {
    // ============================
    // ========== Signal ==========
    // ============================
    const {
      exchange,
      symbol,
      interval,
      messageType,
      side,
    } = await SignalHelper.signalHandler(text);
    ret = {message: "Signal has been updated successfully."};

    const recSignal = await SignalHelper.readSignal(exchange, symbol, interval, messageType, side);
    if (!recSignal) {
      return res.status(404).send({
        error: "Signal not meet criteria.",
      });
    }

    const toProposal = {
      signal: recSignal,
      pulse: null,
      pulses: [],
    };

    // Spawn proposals.
    doPost("exeProposal", toProposal)
        .then((result) => {
          functions.logger.info("result", "result", result);
        });
    // eslint-disable-next-line no-unreachable
  } else if (dataType === "pulse") {
    // ============================
    // ========== Pulses ==========
    // ============================

    const {
      exchange,
      symbol,
      interval,
      group,
    } = await SignalHelper.pulseHandler(text);
    ret ={message: "Pulse has been successfully."};

    const returnedRecs = await SignalHelper.readPulse(exchange, symbol, interval, group);
    const triggerPulse = returnedRecs.find((iPulse) => iPulse.group === group);
    const toProposal = {
      signal: null,
      pulse: triggerPulse,
      pulses: returnedRecs,
    };

    const ALLOW_PULSE_PROPOSAL_LIST = ["STOP LOSS", "TAKE PROFIT LIST"];
    if (ALLOW_PULSE_PROPOSAL_LIST.includes(group)) {
      // Store message as proposal is being executed.
      message = [
        `Proposal of ${symbol} is being executed.`,
        `- Group: ${group}`,
        `- Exchange: ${exchange}`,
        `- Interval: ${interval}`,
        `- Time: ${new Date().toLocaleString()}`,
      ].join("\n");
      pushMessageToLine(message).then(() => {});

      // Spawn proposals.
      // eslint-disable-next-line no-unreachable
      doPost("exeProposal", toProposal)
          .then((result) => {
            functions.logger.info("result", "result", result);
          });


      // eslint-disable-next-line no-unreachable
      return {
        message,
      };
    }
    // eslint-disable-next-line no-unreachable
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
 * Receive JSON for execute proposal.
 */
exports.exeProposal = functions.https.onRequest(async (req, res) => {
  // Log request data.
  functions.logger.info("req.body", "req.body", req.body);

  const {error: pingError, result: pingResult} = await OrderManager.ping();
  if (pingError) {
    // Log error.
    functions.logger.info("error", "ping error not be able to init communication to Binance server.", pingError);

    return res.status(500).send({
      error: pingError,
    });
  } else {
    // Log result.
    functions.logger.info("result", "ping result", pingResult);
  }

  const {signal, pulse, pulses} = req.body;
  const signalRFQ = signal ? await ProposalManager.createSignalRFQ(signal) : null;
  const pulseRFQ = pulse ? await ProposalManager.createPulseRFQ(pulse) : null;
  const listOfPulseRFQ = pulses.map((iPulse) => ProposalManager.createPulseRFQ(iPulse));
  const proposal = new ProposalManager(signalRFQ, pulseRFQ, ...listOfPulseRFQ);

  // LIMIT / MARKET / BEST_MARKET
  const purchaseOptions = {
    orderOption: "LIMIT",
  };

  try {
    await proposal.preparePurchaseOrder(purchaseOptions);
    await proposal.execute();

    const executedMessage = [
      `Proposal of ${proposal.symbol} has been executed.`,
      `- Signal: ${proposal.signal ? proposal.signal.signal : "N/A"}`,
      `- Pulse: ${proposal.pulse ? proposal.pulse.pulse : "N/A"}`,
      `- Exchange: ${proposal.exchange}`,

    ].join("\n");

    pushMessageToLine(executedMessage).then(() => {});
    console.log( signal, pulse, pulses, signalRFQ, pulseRFQ, listOfPulseRFQ);
    res.send({
      message: "Proposal has been executed successfully.",
    });
  } catch (err) {
    // Log error.
    functions.logger.info("error", "error", err);
    return res.status(500).send({
      error: err,
    });
  }
});
