const {OrderManager} = require("../orders/order-helper");
const admin = require("firebase-admin");
const serviceAccount = require("../serviceAccount.json");
const {CommonHelper} = require("../helpers/common-helper");
const {logger} = require("firebase-functions");
const {SignalHelper} = require("../helpers/signal-helper");
const functions = require("firebase-functions");

const ENABLED_EXPIRED = false;

const initApp = () => {
  // Check if the app is initialized.
  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: "https://botkub-27c4e-default-rtdb.firebaseio.com",
    });
  }
};

// strikePriceOption
// LIMIT / MARKET / BEST_LIMIT / BEST_MARKET

exports.ProposalManager = class ProposalManager {
  static async createSignalRFQ(data,
      signalOptions = {strikePriceOption: "entry"},
      purchaseOptions = {orderOption: "MARKET"},
  ) {
    // Make sure "signal.time" and "signal.expiry" are Date object.
    const time = typeof data.time !== "object" ? new Date(data.time) : data.time;
    const expiry = typeof data.expiry !== "object" ? new Date(data.expiry) : data.expiry;

    const {
      messageType,
      group,
      side,
      symbol,
      interval,
      entry,
      mark,
      sl,
      exchange,
      leverage,
    } = data;

    const asset = "USDT";
    const winRate = .7;

    const riskExposurePercentage = .02;
    const requestType = "signal";

    const prop = new ProposalManager();
    const sanitizedSymbol = prop.sanitizeSymbolByRemovePERP(symbol);
    const orm = new OrderManager();
    const symbolInfo = await orm.getSymbolInfo(sanitizedSymbol);

    const balances = await orm.getBalances(asset);
    const {balance} = balances.find((iBalance) => iBalance.asset === asset);

    // rounded stop loss.
    const roundedSlPrice = await orm.roundPrice(sl, symbolInfo);

    // rounded entry price.
    const roundedEntry = await orm.roundPrice(entry, symbolInfo);

    // rounded mark price.
    const roundedMark = await orm.roundPrice(mark, symbolInfo);

    const {bidPrice, askPrice} = await orm.getQuote(symbol);
    let price;
    if (purchaseOptions.orderOption === "MARKET" && side === "buy") {
      price = bidPrice;
    } else if (purchaseOptions.orderOption === "MARKET" && side === "sell") {
      price = askPrice;
    } else if (purchaseOptions.orderOption === "LIMIT" && side === "buy") {
      price = roundedEntry;
    } else if (purchaseOptions.orderOption === "LIMIT" && side === "sell") {
      price = roundedEntry;
    } else if (purchaseOptions.orderOption === "BEST_LIMIT" && side === "buy") {
      price = askPrice;
    } else if (purchaseOptions.orderOption === "BEST_LIMIT" && side === "sell") {
      price = bidPrice;
    } else if (purchaseOptions.orderOption === "BEST_MARKET" && side === "buy") {
      price = bidPrice;
    } else if (purchaseOptions.orderOption === "BEST_MARKET" && side === "sell") {
      price = askPrice;
    } else {
      throw new Error("Not implemented");
    }

    const riskExposureValue = balance * riskExposurePercentage;
    const positionSize = riskExposureValue / Math.abs(price - sl);
    // const positionSize = Math.abs(price - sl);

    const roundedPrice = await orm.roundPrice(price, symbolInfo);
    const roundedQty = await orm.roundQty(price, positionSize, symbolInfo);
    const roundedSlQty = roundedQty;

    // Check information.
    const order = new OrderManager(exchange);
    const acc = await order.getAccount();
    const {totalMarginBalance} = acc;

    let adjLeverage = leverage;
    const margin = totalMarginBalance;
    let marginNeeded;
    while (adjLeverage > 1) {
      // Make sure margin is enough for order.
      marginNeeded = roundedQty * roundedEntry * adjLeverage;
      if (marginNeeded > margin) {
        adjLeverage--;
      }
    }

    const setLeverageResult = await ProposalManager.setLeverage(true, true, adjLeverage, exchange, sanitizedSymbol);
    if (!setLeverageResult) {
      throw new Error("Cannot set leverage.");
    }


    const [
      roundedTpPrice0,
      roundedTpPrice1,
      roundedTpPrice2,
      roundedTpPrice3,
      roundedTpPrice4,

      roundedTpPrice5,
      roundedTpPrice6,
      roundedTpPrice7,
      roundedTpPrice8,
      roundedTpPrice9,

    ] = await Promise.all([
      orm.roundPrice(data.tp0, symbolInfo),
      orm.roundPrice(data.tp1, symbolInfo),
      orm.roundPrice(data.tp2, symbolInfo),
      orm.roundPrice(data.tp3, symbolInfo),
      orm.roundPrice(data.tp4, symbolInfo),
      orm.roundPrice(data.tp5, symbolInfo),
      orm.roundPrice(data.tp6, symbolInfo),
      orm.roundPrice(data.tp7, symbolInfo),
      orm.roundPrice(data.tp8, symbolInfo),
      orm.roundPrice(data.tp9, symbolInfo),
    ]);

    const roundedTpQty0 = await orm.roundQty(roundedTpPrice0, positionSize, symbolInfo);
    const roundedTpQty1 = await orm.roundQty(roundedTpPrice1, roundedTpQty0 * .3, symbolInfo);
    const roundedTpQty2 = await orm.roundQty(roundedTpPrice2, roundedTpQty1 * .3, symbolInfo);
    const roundedTpQty3 = await orm.roundQty(roundedTpPrice3, roundedTpQty2 * .3, symbolInfo);
    const roundedTpQty4 = await orm.roundQty(roundedTpPrice4, roundedTpQty3 * .3, symbolInfo);
    const roundedTpQty5 = await orm.roundQty(roundedTpPrice5, roundedTpQty4 * .3, symbolInfo);
    const roundedTpQty6 = await orm.roundQty(roundedTpPrice6, roundedTpQty5 * .3, symbolInfo);
    const roundedTpQty7 = await orm.roundQty(roundedTpPrice7, roundedTpQty6 * .3, symbolInfo);
    const roundedTpQty8 = await orm.roundQty(roundedTpPrice8, roundedTpQty7 * .3, symbolInfo);
    const roundedTpQty9 = await orm.roundQty(roundedTpPrice9, roundedTpQty8 * .3, symbolInfo);

    const retObject = {
      messageType,
      group,
      side,
      symbol: sanitizedSymbol,
      time,
      interval,
      entry,
      mark,
      winRate,
      requestType,
      riskExposurePercentage,
      expiry,
      exchange,
      sl,
      leverage,
      adjLeverage,
      tp0: CommonHelper.toPriceNumber(data.tp0, 4),
      tp1: CommonHelper.toPriceNumber(data.tp1, 4),
      tp2: CommonHelper.toPriceNumber(data.tp2, 4),
      tp3: CommonHelper.toPriceNumber(data.tp3, 4),
      tp4: CommonHelper.toPriceNumber(data.tp4, 4),
      tp5: CommonHelper.toPriceNumber(data.tp5, 4),
      tp6: CommonHelper.toPriceNumber(data.tp6, 4),
      tp7: CommonHelper.toPriceNumber(data.tp7, 4),
      tp8: CommonHelper.toPriceNumber(data.tp8, 4),
      tp9: CommonHelper.toPriceNumber(data.tp9, 4),

      roundedEntry,
      roundedMark,

      roundedPrice,
      roundedQty,

      roundedSlPrice,
      roundedSlQty,

      roundedTpPrice0,
      roundedTpPrice1,
      roundedTpPrice2,
      roundedTpPrice3,
      roundedTpPrice4,

      roundedTpPrice5,
      roundedTpPrice6,
      roundedTpPrice7,
      roundedTpPrice8,
      roundedTpPrice9,

      roundedTpQty0,
      roundedTpQty1,
      roundedTpQty2,
      roundedTpQty3,
      roundedTpQty4,
      roundedTpQty5,
      roundedTpQty6,
      roundedTpQty7,
      roundedTpQty8,
      roundedTpQty9,


    };
    return retObject;
  }

  static async createPulseRFQ(rawData) {
    // log the raw data.
    functions.logger.info("createPulseRFQ", rawData);


    // Make sure "signal.time" and "signal.expiry" are Date object.
    const time = typeof rawData.time !== "object" ? new Date(rawData.time) : rawData.time;
    const expiry = typeof rawData.expiry !== "object" ? new Date(rawData.expiry) : rawData.expiry;
    const {
      group,
      symbol,
      interval,
      mark,
      exchange,
      side,
      entry,


    } = rawData;

    const winRate = .7;
    const riskExposurePercentage = .02;
    const requestType = "pulse";

    const orm = new OrderManager();
    const prop = new ProposalManager(null, null, null);
    const sanitizedSymbol = prop.sanitizeSymbolByRemovePERP(symbol);
    const symbolInfo = await orm.getSymbolInfo(sanitizedSymbol);

    // const signalProposal = await SignalHelper.getProposalBySymbol(sanitizedSymbol, swapSide,
    //     entry,
    // );
    // const {orderData} = signalProposal;


    // rounded entry price.
    const roundedEntry = await orm.roundPrice(entry, symbolInfo);

    // rounded mark price.
    const roundedMark = await orm.roundPrice(mark, symbolInfo);

    rawData.roundedEntry = roundedEntry;
    rawData.roundedMark = roundedMark;

    const positions = await orm.getPositions(sanitizedSymbol);
    const [position] = positions;

    // const openOrders = await orm.getOpenOrders(sanitizedSymbol);
    // const [openOrder] = openOrders;

    let currentQty = position ? position?.positionAmt : 0;
    currentQty = Math.abs(currentQty);


    if (currentQty === 0) {
      // const swapSide = side === "buy" ? "sell" : "buy";
      const signalProposal = await SignalHelper.getProposalBySymbol(
          sanitizedSymbol,
          side,
          entry,
      );
      currentQty = signalProposal?.orderData?.origQty;
    }


    if (group === "TAKE PROFIT LIST") {
      rawData.roundedTpPrice0 = ProposalManager.getAdjPrice(rawData.takeProfitList[0], symbolInfo);
      rawData.roundedTpPrice1 = ProposalManager.getAdjPrice(rawData.takeProfitList[1], symbolInfo);
      rawData.roundedTpPrice2 = ProposalManager.getAdjPrice(rawData.takeProfitList[2], symbolInfo);
      rawData.roundedTpPrice3 = ProposalManager.getAdjPrice(rawData.takeProfitList[3], symbolInfo);
      rawData.roundedTpPrice4 = ProposalManager.getAdjPrice(rawData.takeProfitList[4], symbolInfo);
      rawData.roundedTpPrice5 = ProposalManager.getAdjPrice(rawData.takeProfitList[5], symbolInfo);
      rawData.roundedTpPrice6 = ProposalManager.getAdjPrice(rawData.takeProfitList[6], symbolInfo);
      rawData.roundedTpPrice7 = ProposalManager.getAdjPrice(rawData.takeProfitList[7], symbolInfo);
      rawData.roundedTpPrice8 = ProposalManager.getAdjPrice(rawData.takeProfitList[8], symbolInfo);
      rawData.roundedTpPrice9 = ProposalManager.getAdjPrice(rawData.takeProfitList[9], symbolInfo);

      const qty0 = await orm.roundQty(rawData.roundedTpPrice0, currentQty * .3, symbolInfo);
      const qty1 = await orm.roundQty(rawData.roundedTpPrice1, qty0 * .3, symbolInfo);
      const qty2 = await orm.roundQty(rawData.roundedTpPrice2, qty1 * .3, symbolInfo);
      const qty3 = await orm.roundQty(rawData.roundedTpPrice3, qty2 * .3, symbolInfo);
      const qty4 = await orm.roundQty(rawData.roundedTpPrice4, qty3 * .3, symbolInfo);
      const qty5 = await orm.roundQty(rawData.roundedTpPrice5, qty4 * .3, symbolInfo);
      const qty6 = await orm.roundQty(rawData.roundedTpPrice6, qty5 * .3, symbolInfo);
      const qty7 = await orm.roundQty(rawData.roundedTpPrice7, qty6 * .3, symbolInfo);
      const qty8 = await orm.roundQty(rawData.roundedTpPrice8, qty7 * .3, symbolInfo);
      const qty9 = await orm.roundQty(rawData.roundedTpPrice9, qty8 * .3, symbolInfo);

      rawData.roundedTpQty0 = qty0;
      rawData.roundedTpQty1 = qty1;
      rawData.roundedTpQty2 = qty2;
      rawData.roundedTpQty3 = qty3;
      rawData.roundedTpQty4 = qty4;
      rawData.roundedTpQty5 = qty5;
      rawData.roundedTpQty6 = qty6;
      rawData.roundedTpQty7 = qty7;
      rawData.roundedTpQty8 = qty8;
      rawData.roundedTpQty9 = qty9;
    } else if (group === "STOP LOSS") {
      rawData.roundedSlPrice = ProposalManager.getAdjPrice(rawData.sl, symbolInfo);
      rawData.roundedSlQty = currentQty;
    }

    const ret = {

      // Extended data for pulse.
      ...rawData,

      side,

      // Common data.
      group,
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
    return ret;
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
    } else if (["STOP LOSS"].includes(this.pulseRfq?.group)) {
      await this.preparePurchaseOrderByPulseStopLoss();
    } else if (["TAKE PROFIT LIST"].includes(this.pulseRfq?.group)) {
      await this.preparePurchaseOrderByPulseTakeProfit();
    } else if (["CLOSE POSITION"].includes(this.pulseRfq?.group)) {
      throw new Error("Not implemented");
    } else {
      throw new Error("Not implemented");
    }
  }

  async preparePurchaseOrderBySignal(purchaseOptions) {
    if (this.hasPrepared) {
      return;
    }

    const {
      expiry,
    } = this.signalRfq;

    // Raise error if expiry is less than current time.
    if (ENABLED_EXPIRED == true && expiry < Date.now()) {
      throw new Error("Proposal is expired.");
    }


    // Store variable to proposal.
    this.proposal = {
      ...this.signalRfq,

    };

    await this.prepare();
  }

  async preparePurchaseOrderByPulseStopLoss() {
    if (this.hasPrepared) {
      return;
    }

    const {
      expiry,
    } = this.pulseRfq;


    // Raise error if expiry is less than current time.
    if (ENABLED_EXPIRED == true && expiry < Date.now()) {
      throw new Error("Proposal is expired.");
    }

    // Store variable to proposal.
    this.proposal = {
      ...this.pulseRfq,
    };

    await this.prepare();
  }

  async preparePurchaseOrderByPulseTakeProfit() {
    if (this.hasPrepared) {
      return;
    }

    const {
      expiry,
    } = this.pulseRfq;


    // Raise error if expiry is less than current time.
    if (ENABLED_EXPIRED == true && expiry < Date.now()) {
      throw new Error("Proposal is expired.");
    }


    // Store variable to proposal.
    this.proposal = {
      ...this.pulseRfq,
    };

    await this.prepare();
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
    let exeResult = "";
    const {proposal} = this;
    const {messageType, group, symbol} = proposal;

    let results;


    try {
      if (group === "BUYSELL" && messageType === "signal") {
        results = await this.executeBuySell(
            false,
            true,
            true,
            true,
        );

        // loops each results as iResult.
        for (const {result: iResult, error: iError} of results) {
          // Ignore if iResult.error.code is -2021 (Order would immediately trigger.).
          if (iResult?.code === -2021 || iError?.code === -2021) {
            continue;
          } else if (!iResult.orderId) {
            throw new Error(iResult.error);
          } else if (iError) {
            throw new Error(iError);
          }
        }

        exeResult = "BUYSELL: success";
      } else if (["STOP LOSS"].includes(group)) {
        results = await this.placeStopLoss();

        // loops each results as iResult.
        for (const {result: iResult, error: iError} of results) {
          logger.info("SL: result", iResult);
          logger.info("SL: error", iError);
          // Ignore if iResult.error.code is -2021 (Order would immediately trigger.).
          if (iResult?.code === -2021 || iError?.code === -2021) {
            exeResult = "SL: Order would immediately trigger.";
            break;
          } else if (!iResult.orderId) {
            exeResult = "SL: Order error.";
            break;
          } else if (iError) {
            exeResult = "SL: Order error.";
            break;
          } else {
            exeResult = "SL: Order success.";
          }
        }

        // log stop loss result.
      } else if (["TAKE PROFIT LIST"].includes(group)) {
        results = await this.placeTakeProfit();

        // loops each results as iResult.
        for (const {result: iResult, error: iError} of results) {
          logger.info("TP: result", iResult);
          logger.info("TP: error", iError);
          // Ignore if iResult.error.code is -2021 (Order would immediately trigger.).
          if (iResult?.code === -2021 || iError?.code === -2021) {
            exeResult = "TP: Order would immediately trigger.";
            break;
          } else if (!iResult.orderId) {
            exeResult = "TP: Order error.";
            break;
          } else if (iError) {
            exeResult = "TP: Order error.";
            break;
          } else {
            exeResult = "TP: Order success.";
          }
        }
      }

      // Log results.
      functions.logger.info("execute results", results);
    } catch (err) {
      await this.executeRollback(symbol, results);

      // Log error.
      functions.logger.error("SL: execute error: ", err);
      exeResult = `SL: execute error: ${err.message}`;
    }

    // Mark proposal as executed.
    const [buySellResult] = results;
    if (buySellResult?.result?.orderId) {
      await this.markProposalAsExecuted(buySellResult.result);
    }

    this.hasExecuted = true;
    return exeResult;
  }

  async executeBuySell(enableLimit = true,
      enableMarket = false,
      enableStop = true,
      enableTakeProfit = true) {
    // #1: Cancel all orders.
    // #2: Place order.
    // #3: Place stop loss.
    // #4: Place take profit.

    // Throws error if both enableLimit and enableMarket are true.
    if (enableLimit && enableMarket) {
      throw new Error("Both enableLimit and enableMarket are true.");
    }

    let limitResult;
    let marketResult;
    let slResult;
    let tpResult;

    if (enableLimit) {
      limitResult = await this.placeLimit();
    }
    if (enableMarket) {
      marketResult = await this.placeMarket();
    }
    if (enableStop) {
      slResult = await this.placeStopLoss();
    }
    if (enableTakeProfit) {
      tpResult = await this.placeTakeProfit();
    }


    const results = [
      limitResult,
      marketResult,
      slResult,
      tpResult,
    ].flat(5).filter(Boolean);
    functions.logger.info("executeBuySell results", results);
    return results;
  }

  async executeRollback(symbol, results) {
    const order = new OrderManager(this.proposal.exchange);

    // Log result.
    logger.info("executeRollback|results", results);
    const res = await order.cancelAllOrdersBySymbol(symbol);
    logger.info("executeRollback|cancelAllOrdersBySymbol", res);
  }

  // async cancelAllOrdersBySymbol(symbol) {
  //   const order = new OrderManager(this.proposal.exchange);
  //   const res = await order.cancelAllOrdersBySymbol(symbol);
  //   logger.info("executeRollback|cancelAllOrdersBySymbol", res);
  // }

  sanitizeSymbolByRemovePERP(symbol) {
    // Remove PERP from symbol.
    const sanitizedSymbol = symbol.replace(/PERP$/g, "");
    return sanitizedSymbol;
  }

  static async setLeverage(setLeverage = true,
      setMarginType = true,
      leverage = 1,
      exchange,
      sanitizedSymbol,
  ) {
    const order = new OrderManager(exchange);


    try {
      // Set margin type to "isolated".
      const marginResult = await order.adjMarginType(sanitizedSymbol, "ISOLATED");

      // Set leverage.
      const lvResult = await order.adjLeverage(sanitizedSymbol, leverage);
      functions.logger.info("lvResult", lvResult);
      functions.logger.info("marginResult", marginResult);
    } catch (err) {
      return false;
    }
    return true;
  }

  async placeLimit() {
    const {proposal} = this;
    const {symbol, exchange, roundedEntry, roundedQty} = proposal;
    const order = new OrderManager(exchange);
    let ret;
    // Place order.
    const exeOrder = {symbol, qty: roundedQty, price: roundedEntry};

    // Log exeOrder and side.
    functions.logger.info("placeLimit|exeOrder", exeOrder, proposal.side);


    // Close current position if exits.
    const closeResult = await order.closePosition(symbol);

    // log close result.
    functions.logger.info("placeLimit|closeResult", closeResult);

    if (proposal.side === "buy") {
      ret = await order.buyLimit(exeOrder);
    } else if (proposal.side === "sell") {
      ret = await order.sellLimit(exeOrder);
    } else {
      throw new Error("Invalid side");
    }

    functions.logger.info("placeLimit results", ret);
    if (ret.result.code) {
      throw new Error(ret.result.msg);
    }

    return ret;
  }

  async placeMarket() {
    const {proposal} = this;
    const {symbol, exchange, roundedEntry, roundedQty} = proposal;
    const order = new OrderManager(exchange);
    let ret;
    // Place order.
    const exeOrder = {symbol, qty: roundedQty, price: roundedEntry};

    // Log exeOrder and side.
    functions.logger.info("placeLimit|exeOrder", exeOrder, proposal.side);


    // Close current position if exits.
    const closeResult = await order.closePosition(symbol);

    // log close result.
    functions.logger.info("placeLimit|closeResult", closeResult);

    if (proposal.side === "buy") {
      ret = await order.buyMarket(exeOrder);
    } else if (proposal.side === "sell") {
      ret = await order.sellMarket(exeOrder);
    } else {
      throw new Error("Invalid side");
    }

    functions.logger.info("placeLimit results", ret);
    if (ret.result.code) {
      throw new Error(ret.result.msg);
    }

    return ret;
  }

  async placeStopLoss() {
    const {proposal} = this;
    const {exchange} = proposal;
    const order = new OrderManager(exchange);
    const ret = await order.placeStopLoss(proposal);
    functions.logger.info("placeStopLoss results", ret);
    const results = [ret].flat(5);
    return results;
  }

  async placeTakeProfit() {
    const {proposal} = this;
    const {exchange} = proposal;
    const order = new OrderManager(exchange);
    const ret = await order.placeTakeProfit(proposal);
    functions.logger.info("placeTakeProfit results", ret);
    const results = [ret].flat(5);
    return results;
  }

  static getAdjQty(qty, symbolInfo) {
    const {filters} = symbolInfo;
    const {stepSize, maxQty, minQty} = filters.find((iFilter) => iFilter.filterType === "LOT_SIZE");

    // Round to stepSize
    const bnbInstance = OrderManager.getExchangeInstance();
    const amountQty = bnbInstance.roundStep(qty, stepSize);

    if (amountQty < minQty) {
      return minQty;
    }

    if (amountQty > maxQty) {
      return maxQty;
    }

    return amountQty;
  }

  static getAdjPrice(price, symbolInfo) {
    const {filters} = symbolInfo;
    const {tickSize, maxPrice, minPrice} = filters.find((iFilter) => iFilter.filterType === "PRICE_FILTER");

    // Round to tickSize
    const bnbInstance = OrderManager.getExchangeInstance();
    const amountPrice = bnbInstance.roundStep(price, tickSize);

    if (amountPrice < minPrice) {
      return minPrice;
    }

    if (amountPrice > maxPrice) {
      return maxPrice;
    }

    return amountPrice;
  }
};


