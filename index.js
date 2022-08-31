const {ProposalManager} = require("./proposals");

const {SignalHelper} = require("./helpers/signal-helper");

// const {OrderManager} = require("./orders/order-helper");

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

exports.updateByData = functions.https.onRequest(async (req, res) => {
  const text = req.body;
  const dataType = SignalHelper.isSignalOrPulse(text);

  let ret = {};

  if (dataType === "signal") {
    const {
      exchange,
      symbol,
      interval,
      signal,
      side,
    } = await SignalHelper.signalHandler(req.body);
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
    } = await await SignalHelper.pulseHandler(req.body);
    ret ={message: "Pulse has been successfully."};

    const returnedRecs = await SignalHelper.readPulse(exchange, symbol, interval, pulse);

    const toProposal = {
      signal: null,
      pulses: returnedRecs,
    };

    // Spawn proposals.
    doPost("exeProposal", toProposal)
        .then((result) => {
          functions.logger.info("result", "result", result);
        });
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


exports.exeProposal = functions.https.onRequest(async (req, res) => {
  // Log request data.
  functions.logger.info("req.body", "req.body", req.body);


  const {signal, pulses} = req.body;
  const signalRFQ = signal ? ProposalManager.createSignalRFQ(signal) : null;
  const pulseRFQ = pulses.map((iPulse) => ProposalManager.createPulseRFQ(iPulse));


  // const proposal = new ProposalManager(signalRFQ, pulseRFQ);
  // await proposal.execute();
  console.log( signal, pulses, signalRFQ, pulseRFQ);
});
/*
exports.healthCheck = functions.https.onRequest(async (req, res) => {
  const order = new OrderManager("binance");

  // Check account.
  const account = await order.getAccount();
  functions.logger.info("account", "account", account);

  // Check balances.
  const balance = await order.getBalances("BTC", "BUSD");
  functions.logger.info("balance", "balance", balance);

  // Check assets.
  const assets = await order.getAssets("BTC", "USDT", "BUSD");
  functions.logger.info("assets", "assets", assets);

  const listOfPos = await order.getPositions("BTCUSDT");
  functions.logger.info("listOfPos", "listOfPos", listOfPos);

  const openOrders = await order.getOpenOrders("ETHUSDT");
  functions.logger.info("openOrders", "openOrders", openOrders);

  const orderHistory = await order.getOrderHistory("ETHUSDT");
  functions.logger.info("orderHistory", "orderHistory", orderHistory);

  const tradeHistory = await order.getTradeHistory("ETHUSDT");
  functions.logger.info("tradeHistory", "tradeHistory", tradeHistory);
});

exports.healthCheckOrder = functions.https.onRequest(async (req, res) => {
  const order = new OrderManager("binance");

  const {result: buyLimitResult} = await order.buyLimit({
    symbol: "ETHUSDT",
    qty: .1,
    price: 1592.82,
  });

  return res.json(buyLimitResult);
});
*/
