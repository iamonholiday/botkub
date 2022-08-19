const {OrderManager} = require("./orders/order-helper");
const {createSignalProposal, validateProposal} = require("./proposals");
const functions = require("firebase-functions");
const signalHelper = require("./helpers/signal-helper");


const {config} = require("firebase-functions");

const doPost = async (functionName, body) => {
  const fetch = (...args) => import("node-fetch").then(({default: fetch}) => fetch(...args));
  // http://localhost:5001/botkub-27c4e/us-central1/exeProposal
  const url = 1 === Number("1") ?
        `http://localhost:5001/botkub-27c4e/us-central1/${functionName}` :
        `https://us-central1-${config().firebase.projectId}.cloudfunctions.net/${functionName}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({body}),
  });
  return res.json();
};


exports.updateByData = functions.https.onRequest(async (req, res) => {
  const text = req.body;
  const dataType = signalHelper.isSignalOrPulse(text);

  if (dataType === "signal") {
    await signalHelper.signalHandler(req.body);
    res.json({message: "Signal has been updated successfully."});
  } else if (dataType === "pulse") {
    await signalHelper.pulseHandler(req.body);
    res.json({message: "pulseHandler is called"});
  } else {
    // Log respond data.
    functions.logger.info("error", "dataType is not found", dataType);
    res.json({
      "error": "dataType is not found",
      "data": dataType,
    });
  }
});

exports.readSignal = functions.https.onRequest(async (req, res) => {
  // Make sure query ticker is not undefined or empty.
  const {ticker} = req.query;
  if (!ticker) {
    functions.logger.info("error", "ticker is not found", ticker);
    return res.json({"error": "ticker is not found"});
  }

  const returnedRecs = await signalHelper.readSignal(req.query.ticker);

  // Try create a proposal.
  doPost("createProposal", returnedRecs).then((result) => {
    // Log result.
    functions.logger.info("result", "result", result);
  }).catch((error) => {
    // Log error.
    functions.logger.info("error", "error", error);
  });


  res.json({
    data: returnedRecs,
  });
});

exports.readPulse = functions.https.onRequest(async (req, res) => {
  // Make sure query ticker is not undefined or empty.
  const {ticker} = req.query;
  if (!ticker) {
    functions.logger.info("error", "ticker is not found", ticker);
    return res.json({"error": "ticker is not found"});
  }

  const returnedRecs = await signalHelper.readPulse(req.query.ticker);

  // Call async function to update DB and not wait for it to finish.
  signalHelper.markReadFlag("pulse", returnedRecs)
      .then(() => {
        // Log respond data.
        functions.logger.info(
            "returnedRecs has been marked as read.",
            returnedRecs);
      }).catch((error) => {
        // Log respond data.
        // eslint-disable-next-line max-len
        functions.logger.info("error", "Not be able to update readTime.", error);
      });


  return res.json({
    msg: "success",
  });
});

exports.exeProposal = functions.https.onRequest(async (req, res) => {
  // Log request data.
  functions.logger.info("req.body", "req.body", req.body);
  const {data} = req.body;
  const proposal = createSignalProposal(data);

  // Log proposal.
  functions.logger.info("proposal", "proposal", proposal);

  const {result: validateResult, error: errorProposal} = validateProposal(proposal);
  if (!validateResult) {
    functions.logger.info("error", "issues", errorProposal);
    return res.json({
      "error": "Proposal not approved.",
      "data": errorProposal,
    });
  }
  //
  // const order = new OrderManager();
  // const {result: orderResult, error: orderError, data: orderData} = await order.openOrder(proposal);
  //
  // // Log orderResult.
  // functions.logger.info("orderResult", "orderResult", orderResult);
});

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
