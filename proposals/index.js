const {functions} = require("lodash");
const {OrderManager} = require("../orders/order-helper");

/**
 *
 * @param {{side:string, entry: float, fastEMA: float, interval: string, l0: float, l1: float, l2: float,l3: float, l4: float,l5: float,createdTime: string}} signal - Signal.
 */
exports.createSignalProposal = (signal) => {
  // Log signal data.
  functions.logger.info("signal", "signal", signal);

  const proposal = {

    ticker: signal.ticker,
    entry: signal.entry,
    fastEMA: signal.fastEMA,
    interval: signal.interval,
    l0: signal.l0,
    l1: signal.l1,
    l2: signal.l2,
    l3: signal.l3,
    l4: signal.l4,
    l5: signal.l5,
    createdTime: signal.createdTime,
    expirationTime: signal.expirationTime,
    proposalType: "signal",
    side: signal.side,
    signalName: signal.signalName,
  };

  // Log proposal data.
  functions.logger.info("proposal", "proposal is created", proposal);
};


exports.createPulseProposal = (signal) => {
  // Log signal data.
  functions.logger.info("signal", "signal", signal);

  // Deconstruct signal data.
  const {ticker, ...data} = signal;

  const
    proposal = {
      ticker,
      entry: signal.entry,
      interval: signal.interval,
      createdTime: signal.createdTime,
      expirationTime: signal.expirationTime,
      proposalType: "pulse",
      side: signal.side,
      pulseName: signal.pulse,
      data,
    };

  // Log proposal data.
  functions.logger.info("proposal", "proposal is created", proposal);
};

exports.validateProposal = (proposal) => {
  const {ticker, market} = proposal;
  const order = new OrderManager(market, ticker);
  order.validateProposal(proposal);
};
