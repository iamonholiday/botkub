const {OrderManager} = require("../orders/order-helper");
const admin = require("firebase-admin");
const serviceAccount = require("../serviceAccount.json");

const initApp = () => {
  // Check if the app is initialized.
  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: "https://botkub-27c4e-default-rtdb.firebaseio.com",
    });
  }
};

/**
 * Get pulse by timeframe. *
 * @param {string} symbol -> Symbol of the symbol.
 * @param {string} timeFrame -> Pulse name.
 */
const fetchListOfPulseRFQ = async (symbol, timeFrame) => {
  const getDB = () => {
    initApp();
    return admin.firestore();
  };

  // 1. Load list of pulses from DB where pulse is not expired.
  const pulseRef = getDB().collection("pulses")
      .where("ticker", "==", symbol)
      .where("interval", "==", timeFrame)
      .where("expirationTime", ">", Date.now());
  const pulseSnapshot = await pulseRef.get();
  const pulses = pulseSnapshot.docs.map((doc) => doc.data()) || [];

  // 2. Convert pulse data to PulseRFQ.
  const mapped = pulses.map((iPulse) => {
    const iMap = createPulseRFQ(iPulse);
    return iMap;
  });

  // 3. Return pulseRFQ.
  return mapped;
};

exports.fetchListOfPulseRFQ = fetchListOfPulseRFQ;

// const PULSE_LEVERAGE = "LX";

const createSignalRFQ = (signal) => {
  // Make sure "signal.time" and "signal.expiry" are Date object.
  const time = typeof signal.time !== "object" ? new Date(signal.time) : signal.time;
  const expiry = typeof signal.expiry !== "object" ? new Date(signal.expiry) : signal.expiry;

  const {
    signalName,
    side,
    ticker: symbol,
    interval: timeFrame,
    mark,
    pp,
    l1,
    l2,
    l3,
    l4,
    l5,
    fastLine,
    exchange,
  } = signal;


  const winRate = signalName == "MayMae-ATR" ? .7 : .7;

  const riskExposurePercentage = .02;
  const requestType = "signal";

  return {
    signalName,
    side,
    symbol,
    time,
    timeFrame,
    mark,
    fastLine,
    winRate,
    requestType,
    riskExposurePercentage,
    expiry,
    exchange,
    data: {
      pp,
      l1,
      l2,
      l3,
      l4,
      l5,
    },
  };
};
exports.createSignalRFQ = createSignalRFQ;

const createPulseRFQ = (signal) => {
  // Make sure "signal.time" and "signal.expiry" are Date object.
  const time = typeof signal.time !== "object" ? new Date(signal.time) : signal.time;
  const expiry = typeof signal.expiry !== "object" ? new Date(signal.expiry) : signal.expiry;
  const {
    pulse,
    ticker: symbol,
    interval: timeFrame,
    mark,
    exchange,
  } = signal;

  const winRate = .7;
  const stakeRisk = .02;
  const requestType = "pulse";

  const {

    lx, // LX
    buyTP, buySL, sellTP, sellSL, // ATR
    cci200, // CCI200
    fastEMA, slowEMA, // EMA
  } = signal;

  const data =
      pulse === "LX" ? {lx} :
      pulse === "ATR" ? {buyTP, buySL, sellTP, sellSL} :
      pulse === "CCI200" ? {cci200} :
      pulse === "EMA" ? {fastEMA, slowEMA} :
      {};


  return {
    pulse,
    symbol,
    time,
    timeFrame,
    mark,

    winRate,
    requestType,
    stakeRisk,
    expiry,
    exchange,
    data,
  };
};
exports.createPulseRFQ = createPulseRFQ;

const STAKE_PERCENTAGE = .1;

exports.ProposalManager = class {
  getDB() {
    initApp();
    const firestore = admin.firestore();
    return firestore;
  }

  /**
      * @constructs ProposalManager
      * @param {SignalRFQ} signalRfq -> SignalRFQ.
      * @param {PulseRFQ} pulseRfq -> PulseRFQ.
  */
  constructor(signalRfq, ...listOfPulseRfq) {
    this.signalRfq = signalRfq;
    this.listOfPulseRfq = listOfPulseRfq;
    this.orderManager = new OrderManager();
    this.proposal = {};
    this.hasPrepared = false;
    this.hasExecuted = false;
  }

  async preparePurchaseOrder() {
    if (this.hasPrepared) {
      return;
    }

    const asset = "USDT";
    const {symbol, riskExposurePercentage,
      side, mark, winRate, expiry, exchange,
    } = this.signalRfq;

    // Raise error if expiry is less than current time.
    if (expiry < Date.now()) {
      throw new Error("Proposal is expired");
    }


    const {tp, sl} = this.getTpAndSlByAtr();
    const balances = await this.orderManager.getBalances(asset);
    const {balance} = balances.find((iBalance) => iBalance.asset === "USDT");
    const riskExposureValue = balance * riskExposurePercentage;
    const stake = balance * STAKE_PERCENTAGE;
    const positionSize = riskExposureValue / Math.abs(mark - sl); // (stake / mark).toFixed(3);


    // Calculate the leverage.
    const leverageByPositionSize = (positionSize * mark) / stake;
    const leverageByPulse = this.calLeverageByPulse();

    const leverage = leverageByPulse === null ? leverageByPositionSize :
        leverageByPulse;


    const {bidPrice, askPrice} = await this.orderManager.getQuote(symbol);
    const price = side === "buy" ? bidPrice : askPrice;

    // Calculate risk and reward ratio.
    /* risk, reward, rewardRisk, minRewardRisk */
    const {rrr} = this.calculateRiskAndReward(
        mark,
        sl,
        tp,
        side,
        winRate,
    );


    const FIXED = 3;
    // Number().toFixed(FIXED)
    // Store variable to proposal.
    this.proposal = {
      ...this.signalRfq,
      price: Number(price).toFixed(FIXED),
      qty: Number(positionSize).toFixed(FIXED),
      riskExposureValue: Number(riskExposureValue).toFixed(FIXED),
      riskExposurePercentage: Number(riskExposurePercentage).toFixed(FIXED),
      stake: Number(stake).toFixed(FIXED),
      balance: Number(balance).toFixed(FIXED),
      tp: Number(tp).toFixed(FIXED),
      sl: Number(sl).toFixed(FIXED),
      rrr: Number(rrr).toFixed(FIXED),
      leverage: Number(leverage).toFixed(FIXED),
      exchange,
    };

    await this.prepare();
  }

  /**
   * Get Take Profit and Stop Loss *
   * @param {number} riskExposure -> Risk exposure.
   * @return {{sl: (string|*), tp: (string|*)}}
   */
  getTpAndSlByAtr() {
    // This function is subject to revamp.

    const selectedATR = this.listOfPulseRfq.find((iPulse) => iPulse.pulse === "ATR").data;
    const {side} = this.signalRfq;

    const tp = side === "buy" ? selectedATR.buyTP :
               side === "sell" ? selectedATR.sellTP : null;
    const sl = side === "buy" ? selectedATR.buySL :
               side === "sell" ? selectedATR.sellSL : null;

    return {
      tp,
      sl,
    };
  }

  calculateRiskAndReward(entryPrice, stopLoss, takeProfit, side, winRate) {
    let risk; let reward;

    // Calculate risk and reward ratio for buy side.
    if (side === "buy") {
      risk = (entryPrice - stopLoss);
      reward = (takeProfit - entryPrice);
    } else if (side === "sell") {
      risk = (takeProfit - entryPrice);
      reward = (entryPrice - stopLoss);
    }

    const rrr = reward / risk;
    const riskPerReward = risk / reward;
    const minRewardRisk = (1 / winRate) -1;


    return {risk, reward, rrr, riskPerReward, minRewardRisk};
  }

  calLeverageByPulse() {
    const {
      lx: leverage,
    } = this.listOfPulseRfq.find((pulse) => pulse.pulse === "LX").data;
    if (!leverage) {
      throw new Error("Leverage RFQ not found");
    }

    return Number(leverage);
  }

  /**
   * For calculate leverage. *
   * @param {number} riskExposureValue
   * @param {number} deltaLossValue
   * @return {number}
   */
  calLeverageByFormula(riskExposureValue, deltaLossValue) {
    const leverage = Math.ceil(riskExposureValue / deltaLossValue);
    return leverage;
  }

  async prepare() {
    // Add new proposal to proposals collection.
    const db = this.getDB();
    const proposalRef = db.collection("proposals").doc();
    const proposal = {
      ...this.proposal,
      id: proposalRef.id,
      status: "pending",
    };
    await proposalRef.set(proposal);
    this.hasPrepared = true;
    this.proposal.id = proposalRef.id;
  }

  async markProposalAsExecuted(order) {
    const db = this.getDB();
    const proposalRef = db.collection("proposals").doc(this.proposal.id);
    await proposalRef.update({
      status: "executed",
      orderData: order,
      orderId: order.orderId,
    });
  }

  async execute() {
    const {proposal} = this;
    const {symbol, exchange, qty, price} = proposal;
    const order = new OrderManager(exchange, symbol);

    // Set margin type to "isolated".
    const marginResult = await order.adjMarginType(symbol, "ISOLATED");

    // Set leverage.
    const lvResult = await order.adjLeverage(symbol, proposal.leverage);

    console.log("lvResult", lvResult);
    console.log("marginResult", marginResult);

    const exeOrder = {symbol, qty, price};
    let ret = null;
    if (proposal.side === "buy") {
      ret = await order.buyLimit(exeOrder);
    } else if (proposal.side === "sell") {
      ret = await order.sellLimit(exeOrder);
    } else {
      throw new Error("Invalid side");
    }
    const {result} = ret;

    // Mark proposal as executed.
    await this.markProposalAsExecuted(result);
    this.hasExecuted = true;
  }

  async cancel() {
    const db = this.getDB();

    // Cancel current proposal.
    const proposalRef = db.collection("proposals").doc(this.proposal.id);
    await proposalRef.update({
      status: "cancelled",
    });
  }

  async validate() {
    // this.orderManager.validateProposal(this.proposal);

    // 1. Get positions, open orders.
    const {proposal} = this;
    const balance = await this.orderManager.getBalance();
    const positions = await this.orderManager.getPositions(proposal.symbol);
    const openOrders = await this.orderManager.getOpenOrders(proposal.symbol);


    // 2. Reject if there is any the same side open order, positions.
    const testSameSizePosition = positions.find((iPosition) => iPosition.side === proposal.side);
    if (testSameSizePosition) {
      return {
        error: "There is already a same side open order.",
        result: false,
      };
    }

    const testSameSidePosition = openOrders.find((iOrder) => iOrder.side === proposal.side);
    if (testSameSidePosition) {
      return {
        error: "There is already a same side position.",
        result: false,
      };
    }

    // 3. Reject if obsolete.
    if (proposal.expirationTime < new Date().getTime()) {
      return {
        error: "Proposal is obsolete.",
        result: false,
      };
    }

    // 4. Reject if insufficient balance.
    if (proposal.side === "buy") {
      if (balance.available < proposal.entry * proposal.size) {
        return {
          error: "Insufficient balance.",
          result: false,
        };
      }
    }

    // 5. Reject if exceeding max open order.
    if (openOrders.length >= 10) {
      return {
        error: "Exceeding max open order.",
        result: false,
      };
    }

    return {
      error: null,
      result: true,
    };
  }
};
