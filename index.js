const functions = require("firebase-functions");
const signalHelper = require("./helpers/signal-helper");


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
  const ticker = req.query.ticker;
  if (!ticker) {
    functions.logger.info("error", "ticker is not found", ticker);
    return res.json({"error": "ticker is not found"});
  }

  const returnedRecs = await signalHelper.readSignal(req.query.ticker);
  res.json({
    data: returnedRecs,
  });
});

exports.readPulse = functions.https.onRequest(async (req, res) => {
  // Make sure query ticker is not undefined or empty.
  const ticker = req.query.ticker;
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

