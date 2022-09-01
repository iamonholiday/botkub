const {OrderManager} = require("../orders/order-helper");
const admin = require("firebase-admin");
const serviceAccount = require("../serviceAccount.json");
const {CommonHelper} = require("../helpers/common-helper");

const initApp = () => {
  // Check if the app is initialized.
  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: "https://botkub-27c4e-default-rtdb.firebaseio.com",
    });
  }
};

const STAKE_PERCENTAGE = .1;

exports.ProposalManager = class {
  static createSignalRFQ(data) {
    // Make sure "signal.time" and "signal.expiry" are Date object.
    const time = typeof data.time !== "object" ? new Date(data.time) : data.time;
    const expiry = typeof data.expiry !== "object" ? new Date(data.expiry) : data.expiry;

    const {
      signal,
      side,
      symbol,
      interval,
      entry,
      stopLoss,
      fastLine,
      exchange,
    } = data;


    const winRate = .7;

    const riskExposurePercentage = .02;
    const requestType = "signal";

    return {
      signal,
      side,
      symbol,
      time,
      interval,
      entry,
      fastLine,
      winRate,
      requestType,
      riskExposurePercentage,
      expiry,
      exchange,
      stopLoss,
    };
  }

  static createPulseRFQ(rawData) {
    // Make sure "signal.time" and "signal.expiry" are Date object.
    const time = typeof rawData.time !== "object" ? new Date(rawData.time) : rawData.time;
    const expiry = typeof rawData.expiry !== "object" ? new Date(rawData.expiry) : rawData.expiry;
    const {
      pulse,
      symbol,
      interval,
      mark,
      exchange,
    } = rawData;

    const winRate = .7;
    const riskExposurePercentage = .02;
    const requestType = "pulse";

    const {

      lx, // LX
      buyTP, buySL, sellTP, sellSL, // ATR
      cci200, // CCI200
      fastEMA, slowEMA, // EMA
      buyStopLoss, sellStopLoss, // StopLoss
    } = rawData;

    const data =
        pulse === "LX" ? {lx} :
            pulse === "ATR" ? {buyTP, buySL, sellTP, sellSL} :
                pulse === "CCI200" ? {cci200} :
                    pulse === "EMA" ? {fastEMA, slowEMA} :
                        pulse === "STOP LOSS" ? {buyStopLoss, sellStopLoss} :
                        {};


    return {
      pulse,
      symbol,
      time,
      interval,
      mark,

      winRate,
      requestType,
      riskExposurePercentage,
      expiry,
      exchange,
      data,
    };
  }

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
      side, mark, winRate, expiry, exchange, stopLoss,
    } = this.signalRfq;

    // Raise error if expiry is less than current time.
    if (expiry < Date.now()) {
      throw new Error("Proposal is expired");
    }


    const balances = await this.orderManager.getBalances(asset);
    const {balance} = balances.find((iBalance) => iBalance.asset === "USDT");
    const riskExposureValue = balance * riskExposurePercentage;
    const stake = balance * STAKE_PERCENTAGE;
    const positionSize = riskExposureValue / Math.abs(mark - stopLoss); // (stake / mark).toFixed(3);


    // Calculate the leverage.
    const leverageByPositionSize = (positionSize * mark) / stake;
    const leverageByPulse = this.calLeverageByPulse();

    const leverage = leverageByPulse === null ? leverageByPositionSize :
        leverageByPulse;


    const {bidPrice, askPrice} = await this.orderManager.getQuote(symbol);
    const price = side === "buy" ? bidPrice : askPrice;


    // Store variable to proposal.
    this.proposal = {
      ...this.signalRfq,
      price: CommonHelper.toPriceNumber(price),
      qty: CommonHelper.toPriceNumber(positionSize),
      riskExposureValue: CommonHelper.toPriceNumber(riskExposureValue),
      riskExposurePercentage: CommonHelper.toPriceNumber(riskExposurePercentage),
      stake: CommonHelper.toPriceNumber(stake),
      balance: CommonHelper.toPriceNumber(balance),
      stopLoss: CommonHelper.toPriceNumber(stopLoss),
      leverage: CommonHelper.toPriceNumber(leverage),
      winRate: CommonHelper.toPriceNumber(winRate),
      exchange,
    };

    await this.prepare();
  }

  getPulseStopLoss() {
    const listOfPulses = ["STOP LOSS"];
    const selectedPulse = this.listOfPulseRfq.find((iPulse) => listOfPulses.includes(iPulse.pulse)) || null;
    return selectedPulse;
  }

  getPulseLX() {
    const listOfPulses = ["LX"];
    const selectedPulse = this.listOfPulseRfq.find((iPulse) => listOfPulses.includes(iPulse.pulse)) || null;
    return selectedPulse;
  }

  getPulseTakeProfit() {
    const listOfPulses = ["CCI200"];
    const selectedPulse = this.listOfPulseRfq.find((iPulse) => listOfPulses.includes(iPulse.pulse)) || null;
    return selectedPulse;
  }

  getPulseClosePosition() {
    const listOfPulses = ["CLOSE POSITION"];
    const selectedPulse = this.listOfPulseRfq.find((iPulse) => listOfPulses.includes(iPulse.pulse)) || null;
    return selectedPulse;
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
    const {signal, pulse} = proposal;

    const setupComplete = await this.setupOrder();
    if (!setupComplete) {
      throw new Error("Setup order failed");
    }

    let result;

    if (signal) {
      result = await this.placeLimit();
    } else if (pulse === "STOP LOSS") {
      result = await this.placeStopLoss();
    }


    // Mark proposal as executed.
    await this.markProposalAsExecuted(result);
    this.hasExecuted = true;
  }

  async setupOrder() {
    const {proposal} = this;
    const {exchange, symbol} = proposal;
    const order = new OrderManager(exchange);

    // Sanitized symbol.
    const sanitizedSymbol = symbol.replace("/", "");

    try {
      // Set margin type to "isolated".
      const marginResult = await order.adjMarginType(sanitizedSymbol, "ISOLATED");

      // Set leverage.
      const lvResult = await order.adjLeverage(sanitizedSymbol, proposal.leverage);
      console.log("lvResult", lvResult);
      console.log("marginResult", marginResult);
    } catch (err) {
      return false;
    }

    return true;
  }

  // async placeMarket() {
  //   const {proposal} = this;
  //   const {symbol, exchange, qty, price, signal} = proposal;
  //   throw new Error("Not implemented");
  // }

  async placeLimit() {
    const {proposal} = this;
    const {symbol, exchange, qty, price} = proposal;
    const order = new OrderManager(exchange);
    let ret;
    // Place order.
    const exeOrder = {symbol, qty, price};

    if (proposal.side === "buy") {
      ret = await order.buyLimit(exeOrder);
    } else if (proposal.side === "sell") {
      ret = await order.sellLimit(exeOrder);
    } else {
      throw new Error("Invalid side");
    }
    return ret;
  }

  async placeStopLoss() {
    const {proposal} = this;
    const {symbol, exchange, qty, price} = proposal;
    const order = new OrderManager(exchange);
    let ret;
    // Place order.
    const exeOrder = {symbol, qty, price};

    if (proposal.side === "buy") {
      ret = await order.sell;
    } else if (proposal.side === "sell") {
      ret = await order.sellLimit(exeOrder);
    } else {
      throw new Error("Invalid side");
    }
    return ret;
  }

  async placeTakeProfit() {
    throw new Error("Not implemented");
  }
};
