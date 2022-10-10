/**
 * The complete Triforce, or one or more components of the Triforce.
 * @typedef {Object} OrderProposal
 * @property {string} symbol - Symbol of coin pair.
 * @property {number} qty - Order quantity.
 * @property {number} price - Price to execute order.
 * @property {...any} params - Order side.
 */


/**
 * @typedef {Object} Ordered
 * @property {string} orderId - Order id.
 */
require("dotenv").config();
const Binance = require("node-binance-api");

const MAX_SYMBOL_NUMBERS = 12;
const MIN_LEVERAGE = 1;
const MAX_LEVERAGE = 125;
const MARGIN_TYPES = ["ISOLATED", "CROSSED"];
const MAX_SYMBOL_QUERY = 1000;

const PULSES_TAKE_PROFIT_LIST = ["CCI200", "TAKE PROFIT"];
const PULSES_STOP_LOSS_LIST = ["STOP LOSS"];

const sanitizeSymbol = (symbol) => {
  // Replace "PERP" with "".
  return symbol.replace(/PERP$/g, "");
};

exports.OrderManager = class OrderManager {
  static getExchangeInstance() {
    const instance = new Binance().options({
      APIKEY: process.env.BINANCE_API_KEY,
      APISECRET: process.env.BINANCE_API_SECRET,
      useServerTime: true, // If you get timestamp errors, synchronize to server time at startup
      test: true, // If you want to use sandbox mode where orders are simulated
    });
    return instance;
  }

  /**
     * @param {'binance'} market - The market to get the ticker for.
     */
  constructor(market = "binance") {
    this.market = market;
    this.binance = OrderManager.getExchangeInstance();
  }

  static async ping() {
    let ret;

    try {
      const instance = OrderManager.getExchangeInstance();
      ret = await instance.futuresTime();
    } catch (err) {
      return {
        error: err,
      };
    }

    return {
      result: ret,
    };
  }

  /**
     *
     * @return {Promise<object>} - The account info.
     * @example {
        "feeTier": 0,
        "canTrade": true,
        "canDeposit": true,
        "canWithdraw": true,
        "updateTime": 0,
        "totalInitialMargin": "8.54229400",
        "totalMaintMargin": "2.13557350",
        "totalWalletBalance": "4907.74174267",
        "totalUnrealizedProfit": "-32.88214978",
        "totalMarginBalance": "4874.85959289",
        "totalPositionInitialMargin": "8.54229400",
        "totalOpenOrderInitialMargin": "0.00000000",
        "totalCrossWalletBalance": "4907.74174267",
        "totalCrossUnPnl": "-32.88214978",
        "availableBalance": "4866.25694867",
        "maxWithdrawAmount": "4866.25694867",
        "assets": [    {
          "asset": "BNB",
          "walletBalance": "0.00000000",
          "unrealizedProfit": "0.00000000",
          "marginBalance": "0.00000000",
          "maintMargin": "0.00000000",
          "initialMargin": "0.00000000",
          "positionInitialMargin": "0.00000000",
          "openOrderInitialMargin": "0.00000000",
          "maxWithdrawAmount": "0.00000000",
          "crossWalletBalance": "0.00000000",
          "crossUnPnl": "0.00000000",
          "availableBalance": "0.00000000",
          "marginAvailable": true,
          "updateTime": 0
        }],
        "positions": [{
          "symbol": "RAYUSDT",
          "initialMargin": "0",
          "maintMargin": "0",
          "unrealizedProfit": "0.00000000",
          "positionInitialMargin": "0",
          "openOrderInitialMargin": "0",
          "leverage": "20",
          "isolated": false,
          "entryPrice": "0.0",
          "maxNotional": "25000",
          "positionSide": "BOTH",
          "positionAmt": "0.0",
          "notional": "0",
          "isolatedWallet": "0",
          "updateTime": 0,
          "bidNotional": "0",
          "askNotional": "0"
        }]
      }
     */
  async getAccount() {
    // Get account.
    const account = await this.binance.futuresAccount();
    return account;
  }

  /**
   * @param {string} asset -> The ticker to get the ticker for.
   * @param {number} riskExposurePercentage -> The percentage to get the ticker for.
   * @return {Promise<{riskExposure: number, stakeValue: number, balance: number}>}
   */
  async calAssetToStake(asset, riskExposurePercentage = 0.02) {
    const selectedAsset = "USDT";

    // Get account.
    const account = await this.binance.futuresAccount();
    const assetInWallet = account.assets.find((p) => p.asset === selectedAsset);
    if (assetInWallet === undefined) {
      throw new Error(`Asset ${selectedAsset} not found in wallet.`);
    }

    const riskExposureValue = (assetInWallet.availableBalance * riskExposurePercentage).toFixed(3);
    const stakeValue = (assetInWallet.availableBalance * .1).toFixed(3);
    const balance = Number(assetInWallet.availableBalance).toFixed(3);

    return {
      riskExposureValue,
      stakeValue,
      balance,
    };
  }

  /**
     *
     * @param {string} assetNames - Asset names to get the ticker for.
     * @return {Promise<object[]>} - The list of balances.
     * @example [
     {
      "accountAlias": "TiTioCSgTioC",
      "asset": "BNB",
      "balance": "0.00000000",
      "crossWalletBalance": "0.00000000",
      "crossUnPnl": "0.00000000",
      "availableBalance": "0.00000000",
      "maxWithdrawAmount": "0.00000000",
      "marginAvailable": true,
      "updateTime": 0
    },
     {
      "accountAlias": "TiTioCSgTioC",
      "asset": "USDT",
      "balance": "4907.74174267",
      "crossWalletBalance": "4907.74174267",
      "crossUnPnl": "-32.96249767",
      "availableBalance": "4866.24016491",
      "maxWithdrawAmount": "4866.24016491",
      "marginAvailable": true,
      "updateTime": 1660896000195
    },
     {
      "accountAlias": "TiTioCSgTioC",
      "asset": "BUSD",
      "balance": "0.00000000",
      "crossWalletBalance": "0.00000000",
      "crossUnPnl": "0.00000000",
      "availableBalance": "0.00000000",
      "maxWithdrawAmount": "0.00000000",
      "marginAvailable": true,
      "updateTime": 0
    }
     ]
     */
  async getBalances(...assetNames) {
    // Raise error if symbols size larger than MAX_SYMBOL_NUMBERS.
    if (assetNames.length > MAX_SYMBOL_NUMBERS) {
      throw new Error(`Maximum of ${MAX_SYMBOL_NUMBERS} symbols allowed`);
    }

    // Get balance.
    let balances;

    try {
      balances = await this.binance.futuresBalance();
    } catch (error) {
      console.log(error);
    }

    const filtered = assetNames.length > 0 ?
            balances.filter((p) => assetNames.includes(p.asset)) :
            balances;
    return filtered.map((ie) => ({
      ...ie,
      balance: Number(ie.balance),
      availableBalance: Number(ie.availableBalance),

    }));
  }

  /**
     * @param {string} symbols - eg. "BTCUSDT".
     * @return {Promise<object[]>}
     * @example [ {
     "symbol": "RAYUSDT",
     "initialMargin": "0",
     "maintMargin": "0",
     "unrealizedProfit": "0.00000000",
     "positionInitialMargin": "0",
     "openOrderInitialMargin": "0",
     "leverage": "20",
     "isolated": false,
     "entryPrice": "0.0",
     "maxNotional": "25000",
     "positionSide": "BOTH",
     "positionAmt": "0.0",
     "notional": "0",
     "isolatedWallet": "0",
     "updateTime": 0,
     "bidNotional": "0",
     "askNotional": "0"
     } ]
     */
  async getPositions(...symbols) {
    // Raise error if symbols size larger than MAX_SYMBOL_NUMBERS.
    if (symbols.length > MAX_SYMBOL_NUMBERS) {
      throw new Error(`The number of symbols must be less than ${MAX_SYMBOL_NUMBERS}`);
    }

    const listOfPos = await this.binance.futuresPositionRisk();

    const filtered = symbols.length > 0 ?
            listOfPos.filter((p) => symbols.includes(p.symbol)) :
            listOfPos;

    return filtered;
  }

  /**
     * @param {string} assetNames - List of asset names.
     * @example
     [{
     "asset": "BNB",
     "walletBalance": "0.00000000",
     "unrealizedProfit": "0.00000000",
     "marginBalance": "0.00000000",
     "maintMargin": "0.00000000",
     "initialMargin": "0.00000000",
     "positionInitialMargin": "0.00000000",
     "openOrderInitialMargin": "0.00000000",
     "maxWithdrawAmount": "0.00000000",
     "crossWalletBalance": "0.00000000",
     "crossUnPnl": "0.00000000",
     "availableBalance": "0.00000000",
     "marginAvailable": true,
     "updateTime": 0
     }]
     */
  async getAssets(...assetNames) {
    // Raise error if assetNames size larger than MAX_SYMBOL_NUMBERS.
    if (assetNames.length > MAX_SYMBOL_NUMBERS) {
      throw new Error(`Asset names size larger than ${MAX_SYMBOL_NUMBERS}`);
    }

    const account = await this.binance.futuresAccount();
    const {assets} = account;
    const filtered = assets.length > 0 ?
            assets.filter((p) => assetNames.includes(p.asset)) :
            assets;
    return filtered;
  }

  /**
     *
     * @param {string} symbol - The ticker to get the ticker for.
     * @return {Promise<*>} - XXXXX.
     */
  async getOpenOrders(...symbols) {
    // Raise error if symbols more than MAX_SYMBOL_NUMBERS.
    if (symbols.length > MAX_SYMBOL_NUMBERS) {
      throw new Error(`Maximum of ${MAX_SYMBOL_NUMBERS} symbols allowed`);
    }

    // Loop async call.
    const openOrders = await Promise.all(symbols.map(async (iSymbol) => {
      return await this.binance.futuresOpenOrders(sanitizeSymbol(iSymbol));
    }));

    // Flatten array.
    const flattened = openOrders.reduce((acc, curr) => acc.concat(curr), []);
    return flattened;
  }

  /**
     * @param {...string} symbols - The symbols to get the list of orders.
     * @return {Promise<*>} - List of orders.
     * example [{
     "orderId": 928253802,
     "symbol": "ETHUSDT",
     "status": "FILLED",
     "clientOrderId": "web_jcqmX9RqiAv629rIFp0a",
     "price": "0",
     "avgPrice": "1695.00000",
     "origQty": "0.200",
     "executedQty": "0.200",
     "cumQuote": "339",
     "timeInForce": "GTC",
     "type": "MARKET",
     "reduceOnly": false,
     "closePosition": false,
     "side": "SELL",
     "positionSide": "BOTH",
     "stopPrice": "0",
     "workingType": "CONTRACT_PRICE",
     "priceProtect": false,
     "origType": "MARKET",
     "time": 1660922720082,
     "updateTime": 1660922720082
     }]
     */
  async getOrderHistoryLast24H(...symbols) {
    // Raise error if symbols more than 10.
    if (symbols.length > MAX_SYMBOL_NUMBERS) {
      throw new Error(`Maximum of ${MAX_SYMBOL_NUMBERS} symbols allowed`);
    }

    // Store startTime by last 24 hours.
    const startTime = new Date().getTime() - 24 * 60 * 60 * 1000;
    const endTime = new Date().getTime();

    // Loop async call.
    const orderHistory = await Promise.all(symbols.map(async (iSymbol) => {
      const iOrdered = await this.binance.futuresAllOrders(
          iSymbol,
          {
            symbol: iSymbol,
            limit: MAX_SYMBOL_QUERY,
            startTime: startTime,
            endTime: endTime,
          },
      );
      return iOrdered;
    }));

    // Flatten array.
    const flattened = orderHistory.reduce((acc, curr) => acc.concat(curr), []);
    return flattened;
  }

  /**
     *
     * @param {{symbol: string, qty: number, price: number}} orderProposal - The order proposal to place.
     * @param {any?} options - Options.
     * @return {Promise<any>}
     */
  async buyLimit(orderProposal, options) {
    let error;
    const data = orderProposal;
    const symbol = sanitizeSymbol(data.symbol);

    const result = options ?
            await this.binance.futuresBuy(symbol, data.qty, data.price, options) :
            await this.binance.futuresBuy(symbol, data.qty, data.price);

    if (!result.orderId) {
      error = result;
    }

    return {
      result,
      error,
      data,
    };
  }

  /**
     *
     * @param {{symbol: string, qty: number, price: number}} orderProposal - The order proposal to place.
     * @param {any?} options - Options.
     * @return {Promise<any>}
     */
  async sellLimit(orderProposal, options) {
    let error;
    const data = orderProposal;
    const symbol = sanitizeSymbol(data.symbol);
    const result = options ?
            await this.binance.futuresSell(symbol, data.qty, data.price, options) :
            await this.binance.futuresSell(symbol, data.qty, data.price);

    if (!result.orderId) {
      error = result;
    }

    return {
      result,
      error,
      data,
    };
  }

  async placeStopLoss(orderProposal, options) {
    const symbol = sanitizeSymbol(orderProposal.symbol);
    const {
      roundedSlQty,
      side,
      roundedSlPrice,
      roundedMark,
    } = orderProposal;

    const type = "STOP";


    // If buyStopLoss is true, then use futuresSell.
    // Otherwise, use futuresBuy.
    const action = side === "buy" ?
        this.binance.futuresSell :
        this.binance.futuresBuy;

    let res;
    try {
      res = await action(
          symbol,
          roundedSlQty,
          roundedSlPrice,
          {
            stopPrice: roundedMark,
            type: type,
            workingType: "MARK_PRICE",
          },
      );
    } catch (error) {
      return {
        error: error,
        result: null,
        data: null,
      };
    }

    return {
      result: res,
      error: null,
      data: null,
    };
  }

  async placeTakeProfit(orderProposal, options) {
    const symbol = sanitizeSymbol(orderProposal.symbol);
    const {
      side, roundedMark,
    } = orderProposal;


    const results = [];

    // Loop inc from 0 to 9.
    for (let i = 0; i < 9; i++) {

      // Skip if takeProfit is not set.
      if (orderProposal[`roundedTpQty${i}`] === 0) {
        continue;
      }

      const buyTakeProfit = side === "buy" ? orderProposal[`roundedTpPrice${i}`] : null;
      const sellTakeProfit = side === "sell" ? orderProposal[`roundedTpPrice${i}`] : null;


      const type = "TAKE_PROFIT";

      // If buyTakeProfit is true, then use futuresSell.
      // Otherwise, use futuresBuy.
      let action;
      let price;

      if (!(buyTakeProfit ^ sellTakeProfit)) {
        return {
          error: "Invalid take profit order proposal",
        };
      } else if (buyTakeProfit) {
        action = this.binance.futuresSell;
        price = roundedMark;
      } else {
        action = this.binance.futuresBuy;
        price = roundedMark;
      }

      const roundedTakeProfit = buyTakeProfit ? buyTakeProfit : sellTakeProfit;
      const roundedQty = orderProposal[`roundedTpQty${i}`];

      let res;
      try {
        res = await action(
            symbol,
            roundedQty,
            roundedTakeProfit,
            {
              stopPrice: price,
              type: type,
              workingType: "CONTRACT_PRICE",
            },
        );
      } catch (error) {
        return {
          error: error,
          result: null,
          data: {
            action: "TAKE_PROFIT",
            value: {
              symbol,
              roundedQty,
              roundedTakeProfit,
            },
          },
        };
      }


      if (!res.orderId) {
        results.push({
          error: res,
          result: null,
          data: null,
        });
      } else {
        results.push({
          result: res,
          error: null,
          data: null,
        });
      }
    }

    return results;
  }

  async sanitizeOrder(orderProposal) {
    const {signal, pulse, symbol} = orderProposal;
    let listOfOrders;
    const results = [];

    if (PULSES_TAKE_PROFIT_LIST.includes(pulse)) {
      // If pulse is take profit, then cancel all take profit orders.
      listOfOrders = (await this.getOpenOrders(symbol)).filter((iOrder) => {
        return ["TAKE_PROFIT", "TAKE_PROFIT_MARKET"].includes(iOrder.type);
      } );

      // For loop to cancel all orders.
      for (const iOrder of listOfOrders) {
        // Log the order.
        console.log(iOrder);

        const {result: cancelResult} = await this.cancelOrder(
            sanitizeSymbol(symbol),
            iOrder.orderId);
        results.push(cancelResult);
      }
    } else if (PULSES_STOP_LOSS_LIST.includes(pulse)) {
      // If the pulse is stop loss, then cancel all stop loss orders.
      listOfOrders = (await this.getOpenOrders(symbol)).filter((iOrder) => {
        return ["STOP", "STOP_MARKET"].includes(iOrder.type);
      } );

      // For loop to cancel all orders.
      for (const iOrder of listOfOrders) {
        // Log the order.
        console.log(iOrder);

        const {result: cancelResult} = await this.cancelOrder(
            sanitizeSymbol(symbol),
            iOrder.orderId,
        );
        results.push(cancelResult);
      }
    } else if (signal) {
      // If signal is true, then clear all orders.
      listOfOrders = await this.getOpenOrders(symbol);
      // For loop to cancel all orders.
      for (const iOrder of listOfOrders) {
        // Log the order.
        console.log(iOrder);

        const {result: cancelResult} = await this.cancelOrder(sanitizeSymbol(symbol),
            iOrder.orderId);
        results.push(cancelResult);
      }
    }

    return results;
  }

  /**
   * @param {string} symbol -> The symbol to place the order.
   * @return {Promise<any>}
   */
  async getQuote(symbol) {
    // Replace last word "PERP" from symbol.
    const symbolPerp = symbol.replace(/PERP$/, "");

    let resp;
    try {
      resp = await this.binance.futuresQuote(symbolPerp);
    } catch (err) {
      // Log error.
      console.log(err);
    }
    return resp;
  }

  /**
   *
   * @param {any[]} orders - Orders.
   * @return {Promise<{result: *}>}
   */
  async manualOrder(order) {
    const resp = await this.binance.futuresOrder(
        // side: 'BUY' | 'SELL', symbol: _symbol, price?: number, params?: any
        order.side,
        order.symbol,
        order);
    return {
      result: resp,
    };
  }

  /**
     * @param {string} symbol - The symbol to get the list of orders.
     * @param {number} leverage - The leverage to use.
     * @return {Promise<*>}
     */
  async adjLeverage(symbol, leverage) {
    // Make sure symbol is not empty.
    if (!symbol) {
      throw new Error("Symbol is required");
    }

    // Make sure leverage in rage.
    if (leverage < MIN_LEVERAGE || leverage > MAX_LEVERAGE) {
      throw new Error(`Leverage must be between ${MIN_LEVERAGE} and ${MAX_LEVERAGE}`);
    }

    const resp = await this.binance.futuresLeverage(sanitizeSymbol(symbol), Number(leverage));
    return resp;
  }

  /**
     *
     * @param {string} symbol
     * @param {'ISOLATED' | 'CROSSED'} marginType
     * @return {Promise<void>}
     */
  async adjMarginType(symbol, marginType) {
    // Make sure symbol is not empty.
    if (!symbol) {
      throw new Error("Symbol is required");
    }

    // Make sure margin type is valid.
    if (!marginType || !MARGIN_TYPES.includes(marginType)) {
      throw new Error(`Margin type must be one of ${MARGIN_TYPES.join(", ")}`);
    }

    const resp = await this.binance.futuresMarginType(sanitizeSymbol(symbol), marginType);
    return resp;
  }

  /**
     *
     * @param {string} symbol
     * @param {Ordered} ordered
     * @return {Promise<void>}
     */
  async cancelOrder(symbol, orderId) {
    // Make sure symbol is not empty.
    if (!symbol) {
      return {
        error: "Symbol is required",
      };
    }

    let respCancelOrder;
    try {
      respCancelOrder = await this.binance.futuresCancel(symbol, {

        orderId: orderId,

      });
    } catch (error) {
      return {
        error: error,
      };
    }

    return {
      result: respCancelOrder,
    };
  }

  /**
     * @param {string} symbol
     * @return {Promise<*>}
     */
  async cancelAllOrdersBySymbol(symbol) {
    const respCancelAllOrders = await this.binance.futuresCancelAll(symbol);
    return {
      result: respCancelAllOrders,

    };
  }

  /**
     * @param {any?} options - An options object.
     * @return {Promise<{result: (*|*)}>}
     */
  async futuresPrices(options) {
    const prices = options ?
            await this.binance.futuresPrices(options) :
            await this.binance.futuresPrices();

    const newPrices = {};
    // Loop each key and convert value to number.
    Object.keys(prices).forEach((key) => {
      newPrices[key] = parseFloat(prices[key]);
    });

    return newPrices;
  }

  /**
     *
     * @param {string} symbol
     * @param {number?} limit
     * @return {Promise<{result: *}>}
     */
  async futuresDepth(symbol) {
    const resp = await this.binance.futuresDepth(symbol);
    const {bids, asks} = resp;
    return {

      bids,
      asks,
      symbol,

    };
  }

  async roundQty(price, amountQty, symbolInfo) {
    const {filters} = symbolInfo;
    const filter = filters.find((iFilter) => iFilter.filterType === "LOT_SIZE");
    const {stepSize} = filter;

    const {minQty, minNotional}= symbolInfo;

    // Set minimum order amount with minQty
    if ( amountQty < minQty ) amountQty = minQty;

    // Set minimum order amount with minNotional
    if ( price * amountQty < minNotional ) {
      amountQty = minNotional / price;
    }

    // Round to stepSize
    amountQty = this.binance.roundStep(amountQty, stepSize);
    return amountQty;
  }

  async roundPrice(price, symbolInfo) {
    const {filters} = symbolInfo;
    const filter = filters.find((iFilter) => iFilter.filterType === "PRICE_FILTER");
    const {tickSize} = filter;
    price = this.binance.roundStep(price, tickSize);
    return price;
  }

  async getSymbolInfo(symbol) {
    const exchangeInstance = OrderManager.getExchangeInstance();
    const exchangeInfo = await exchangeInstance.futuresExchangeInfo();
    const {symbols} = exchangeInfo;
    const symbolInfo = symbols.find((iSymbol) => iSymbol.symbol === symbol);

    return symbolInfo;
  }
};


