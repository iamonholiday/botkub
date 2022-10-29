const {OrderManager} = require("./orders/order-helper");
const {CommonHelper} = require("./helpers/common-helper");
const {ProposalManager} = require("./proposals");

const {SignalHelper} = require("./helpers/signal-helper");

const functions = require("firebase-functions");

// const getEnvironmentToken = () => {
//   const {env} = process;
//   const {BINANCE_API_KEY, BINANCE_API_SECRET} = env;
//   const rawData = `${BINANCE_API_KEY}:${BINANCE_API_SECRET}`;
//   const hash = CommonHelper.hashCode(rawData);
//   return hash;
// };

const sanitizedData = (data) => {
  const separator = "##########";
  const [head, body] = data.split(separator);
  const newData = `${head}${separator}${body}`;
  return newData;
};

async function exeProposal(adjData) {
  // Log request data.
  functions.logger.info("req.body", adjData);
  let countRetry = 5;
  CommonHelper.sleep = async function(number) {
    return new Promise((resolve) => {
      setTimeout(resolve, number);
    });
  };
  // Count retry.
  while (countRetry > 0) {
    countRetry--;
    const {error: pingError, result: pingResult} = await OrderManager.ping();
    if (pingError) {
      // Log error.
      functions.logger.info("ping error not be able to init communication to Binance server.", pingError);

      if (countRetry === 0) {
        return {error: pingError, result: null};
      } else {
        // Wait 1 second.
        await CommonHelper.sleep(1000);
      }
    } else {
      // Log result.
      functions.logger.info("ping result", pingResult);
      break;
    }
  }

  const {signal, pulse, pulses} = adjData;
  const signalRFQ = signal ? await ProposalManager.createSignalRFQ(signal) : null;
  const pulseRFQ = pulse ? await ProposalManager.createPulseRFQ(pulse) : null;

  const proposal = new ProposalManager(signalRFQ, pulseRFQ, []);

  // LIMIT / MARKET / BEST_MARKET
  const purchaseOptions = {
    orderOption: "LIMIT",
  };

  try {
    await proposal.preparePurchaseOrder(purchaseOptions);
    const exeResult = await proposal.execute();

    // function log.
    functions.logger.info(signal, pulse, pulses, signalRFQ, pulseRFQ, []);

    return {
      message: exeResult,
    };
  } catch (err) {
    // Log error.
    functions.logger.info("error", err);

    return {
      error: err,
    };
  }
}

exports.cleanData = functions.https.onRequest(async (req, res) => {
  // Store dataType and token from body.
  const {
    dataType,
    // token
  } = req.body;

  // Validate token.
  // const hash = getEnvironmentToken();
  // if (hash !== token) {
  //   res.status(403).send("Invalid token");
  //   return;
  // }

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

exports.exeProposal = exeProposal;

exports.updateByData = functions.https.onRequest(async (req, res) => {
  // const hash = getEnvironmentToken();
  // const {token} = req.query;
  let message;
  //
  // if (hash !== token) {
  //   res.status(403).send("Invalid token");
  //   return;
  // }

  const text = sanitizedData(req.body);
  const dataType = SignalHelper.isSignalOrPulse(text);

  let ret;

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

    // Log proposal execution.
    functions.logger.info("start execution", text);
    functions.logger.info("toProposal", toProposal);

    // Spawn proposals.
    const result = await exeProposal(toProposal);
    functions.logger.info("result", result);

    res.json(result);
    return {
      result,
    };
  } else if (dataType === "pulse") {
    // ============================
    // ========== Pulses ==========
    // ============================

    const {
      exchange,
      symbol,
      interval,
      group,
      entry,
    } = await SignalHelper.pulseHandler(text);
    ret ={message: "Pulse has been successfully."};

    const returnedRecs = await SignalHelper.readPulse(exchange, symbol, interval, group, entry);
    const triggerPulse = returnedRecs;
    const toProposal = {
      signal: null,
      pulse: triggerPulse,
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


      // Log proposal execution.
      functions.logger.info("start execution", message);

      // Spawn proposals.
      const result = await exeProposal(toProposal);
      functions.logger.info("result", result);


      res.json(result);
      return {
        result,
      };
    }
    // eslint-disable-next-line no-unreachable
  } else {
    // Log respond data.
    functions.logger.info("dataType is not found", dataType);
    ret = {
      "error": "dataType is not found",
      "data": dataType,
    };
  }
  res.json(ret);
  return;
});


exports.ping = functions.https.onRequest(async (req, res) => {
  // Store hostname to variable.
  const {hostname} = req;
  const {env} = process;

  // Respond ping.
  res.send({
    "hostname": hostname,
    // ...config(),
    ...env,
  });
});
