const {OrderManager} = require("../orders/order-helper");
const admin = require("firebase-admin");
const serviceAccount = require("../serviceAccount.json");
const {CommonHelper} = require("../helpers/common-helper");
const {logger} = require("firebase-functions");

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

const ASSET = "USDT";

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

    let side;
    if (pulse === "STOP LOSS" && rawData.buyStopLoss) {
      side = "buy";
    } else if (pulse === "STOP LOSS" && rawData.sellStopLoss) {
      side = "sell";
    }

    return {

      // Extended data for pulse.
      ...rawData,

      side,

      // Common data.
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
  constructor(signalRfq, pulseRfq, ...listOfPulseRfq) {
    this.signalRfq = signalRfq;
    this.pulseRfq = pulseRfq;
    this.listOfPulseRfq = listOfPulseRfq;
    this.orderManager = new OrderManager();
    this.proposal = {};
    this.hasPrepared = false;
    this.hasExecuted = false;
  }

  async preparePurchaseOrder() {
    if (this.signalRfq) {
      await this.preparePurchaseOrderBySignal();
    } else if (["STOP LOSS"].includes(this.pulseRfq?.pulse)) {
      await this.preparePurchaseOrderByPulseStopLoss();
    } else if (["TAKE PROFIT", "CCI200"].includes(this.pulseRfq?.pulse)) {
      await this.preparePurchaseOrderByPulseTakeProfit();
    } else if (["CLOSE POSITION"].includes(this.pulseRfq?.pulse)) {
      throw new Error("Not implemented");
    } else {
      throw new Error("Not implemented");
    }
  }

  async preparePurchaseOrderBySignal() {
    if (this.hasPrepared) {
      return;
    }

    const asset = "USDT";
    const {symbol, riskExposurePercentage,
      side, entry, winRate, expiry, exchange, stopLoss,
    } = this.signalRfq;

    // Entry and Mark are the same value for signal.
    const mark = entry;

    // Raise error if expiry is less than current time.
    if (expiry < Date.now()) {
      throw new Error("Proposal is expired.");
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

  async preparePurchaseOrderByPulseStopLoss() {
    if (this.hasPrepared) {
      return;
    }


    const {symbol, riskExposurePercentage,
      mark, winRate, expiry, exchange, buyStopLoss, sellStopLoss,
    } = this.pulseRfq;

    const stopLoss =
            buyStopLoss ?
            buyStopLoss :
            sellStopLoss ?
            sellStopLoss :
            null;

    if (!stopLoss) {
      throw new Error("Stop Loss is null.");
    }

    const side =
        buyStopLoss ?
        "buy" :
        sellStopLoss ?
        "sell" :
        null;


    // Raise error if expiry is less than current time.
    if (expiry < Date.now()) {
      throw new Error("Proposal is expired.");
    }

    const balances = await this.orderManager.getBalances(ASSET);
    const listOfPosition = await this.orderManager.getPositions(this.sanitizeSymbolByRemovePERP(symbol));
    const currentPosition = listOfPosition.find((position) => position.symbol === this.sanitizeSymbolByRemovePERP(symbol));
    const {positionAmt} = currentPosition; // entryPrice,
    const {balance} = balances.find((iBalance) => iBalance.asset === ASSET);
    const riskExposureValue = balance * riskExposurePercentage;
    const stake = balance * STAKE_PERCENTAGE;
    const positionSize = positionAmt;

    // riskExposureValue / Math.abs(entryPrice - stopLoss);
    // if (!positionSize) {
    //   positionSize = positionAmt;
    // }

    // Calculate the leverage.
    let leverage = this.calLeverageByPulse();
    // Manual calculate the leverage if no leverage pulse.
    if (!leverage) {
      leverage = (positionSize * mark) / stake;
    }

    const {bidPrice, askPrice} = await this.orderManager.getQuote(symbol);
    const price = side === "buy" ? bidPrice : askPrice;

    // Store variable to proposal.
    this.proposal = {
      ...this.pulseRfq,
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

  async preparePurchaseOrderByPulseTakeProfit() {
    if (this.hasPrepared) {
      return;
    }


    const {symbol, riskExposurePercentage,
      winRate, expiry, exchange, tpBuy, tpSell,
    } = this.pulseRfq;

    let takeProfit; let side;
    if (tpBuy) {
      takeProfit = tpBuy;
      side = "sell";
    } else if (tpSell) {
      takeProfit = tpSell;
      side = "buy";
    } else {
      throw new Error("Take Profit is null.");
    }


    // Raise error if expiry is less than current time.
    if (expiry < Date.now()) {
      throw new Error("Proposal is expired.");
    }

    const balances = await this.orderManager.getBalances(ASSET);
    const listOfPosition = await this.orderManager.getPositions(this.sanitizeSymbolByRemovePERP(symbol));
    const currentPosition = listOfPosition.find((position) => position.symbol === this.sanitizeSymbolByRemovePERP(symbol));
    const {positionAmt, entryPrice} = currentPosition; // ,
    const {balance} = balances.find((iBalance) => iBalance.asset === ASSET);
    const riskExposureValue = balance * riskExposurePercentage;
    const stake = balance * STAKE_PERCENTAGE;
    const positionAmtPeriod = positionAmt.split(".")[1].length;

    const positionSize = CommonHelper.toQtyNumber(positionAmt / 2, positionAmtPeriod);


    // Store variable to proposal.
    this.proposal = {
      ...this.pulseRfq,
      price: CommonHelper.toPriceNumber(takeProfit),
      qty: CommonHelper.toPriceNumber(positionSize),
      riskExposureValue: CommonHelper.toPriceNumber(riskExposureValue),
      riskExposurePercentage: CommonHelper.toPriceNumber(riskExposurePercentage),
      stake: CommonHelper.toPriceNumber(stake),
      balance: CommonHelper.toPriceNumber(balance),
      takeProfit: CommonHelper.toPriceNumber(takeProfit),
      winRate: CommonHelper.toPriceNumber(winRate),
      side,
      entryPrice: CommonHelper.toPriceNumber(entryPrice),
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
    const found = this.listOfPulseRfq.find((pulse) => pulse.pulse === "LX");
    if (found) {
      const {lx} = found;
      return Number(lx);
    }

    return null;
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
    const {signal, pulse, exchange} = proposal;
    const SETUP_ERROR = "Setup order failed";

    let res;
    const order = new OrderManager(exchange);

    // Sanitized order by symbol.
    const cancelResult = await order.sanitizeOrder(proposal);

    logger.info("cancelResult", cancelResult);

    if (signal) {
      const setupComplete = await this.setupOrder(true, true);
      if (!setupComplete) {
        throw new Error(SETUP_ERROR);
      }
      res = await this.placeLimit();
    } else if (["STOP LOSS"].includes(pulse)) {
      const setupComplete = await this.setupOrder(false, true);
      if (!setupComplete) {
        throw new Error(SETUP_ERROR);
      }
      res = await this.placeStopLoss();
    } else if (["TAKE PROFIT", "CCI200"].includes(pulse)) {
      const setupComplete = await this.setupOrder(false, true);
      if (!setupComplete) {
        throw new Error(SETUP_ERROR);
      }
      res = await this.placeTakeProfit();
    }


    // Mark proposal as executed.
    await this.markProposalAsExecuted(res.result);
    this.hasExecuted = true;
  }

  sanitizeSymbolByRemovePERP(symbol) {
    // Remove PERP from symbol.
    const sanitizedSymbol = symbol.replace(/PERP$/g, "");
    return sanitizedSymbol;
  }

  async sanitizeOrder() {
    const {proposal} = this;
    const {exchange} = proposal;
    const order = new OrderManager(exchange);
    const ret = await order.placeTakeProfit(proposal);
    return ret;
  }

  async setupOrder(setLeverage = true, setMarginType = true) {
    const {proposal} = this;
    const {exchange, symbol} = proposal;
    const order = new OrderManager(exchange);

    // Sanitized symbol.
    const sanitizedSymbol = this.sanitizeSymbolByRemovePERP(symbol);

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
    const {exchange} = proposal;
    const order = new OrderManager(exchange);
    const ret = await order.placeStopLoss(proposal);
    return ret;
  }

  async placeTakeProfit() {
    const {proposal} = this;
    const {exchange} = proposal;
    const order = new OrderManager(exchange);
    const ret = await order.placeTakeProfit(proposal);
    return ret;
  }
};


