const Binance = require("node-binance-api");

const MAX_SYMBOL_NUMBERS = 12;

exports.OrderManager = class {
  /**
     * @param {string} market - The market to get the ticker for.
     */
  constructor(market) {
    this.market = market;
    this.binance = new Binance().options({
      APIKEY: process.env.BINANCE_API_KEY,
      APISECRET: process.env.BINANCE_API_SECRET,
      useServerTime: true, // If you get timestamp errors, synchronize to server time at startup
      test: true, // If you want to use sandbox mode where orders are simulated
    });
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
    const balances = await this.binance.futuresBalance();
    const filtered = assetNames.length > 0 ?
            balances.filter((p) => assetNames.includes(p.asset)) :
            balances;
    return filtered;
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
      return await this.binance.futuresOpenOrders(iSymbol);
    }));

    // Flatten array.
    const flattened = openOrders.reduce((acc, curr) => acc.concat(curr), []);
    return flattened;
  }

  /**
     * @param {string} symbols - The symbols to get the list of orders.
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
  async getOrderHistory(...symbols) {
    // Raise error if symbols more than 10.
    if (symbols.length > MAX_SYMBOL_NUMBERS) {
      throw new Error(`Maximum of ${MAX_SYMBOL_NUMBERS} symbols allowed`);
    }

    // Loop async call.
    const orderHistory = await Promise.all(symbols.map(async (iSymbol) => {
      return await this.binance.futuresAllOrders(iSymbol);
    }));

    // Flatten array.
    const flattened = orderHistory.reduce((acc, curr) => acc.concat(curr), []);
    return flattened;
  }


  /**
     * @param {string} symbols - The symbol to get the list of orders.
     * @return {Promise<*>}
     * example [{
     "symbol": "ETHUSDT",
     "id": 97195629,
     "orderId": 928253802,
     "side": "SELL",
     "price": "1695",
     "qty": "0.200",
     "realizedPnl": "0",
     "marginAsset": "USDT",
     "quoteQty": "339",
     "commission": "0.13560000",
     "commissionAsset": "USDT",
     "time": 1660922720082,
     "positionSide": "BOTH",
     "maker": false,
     "buyer": false
     }]
     */
  async getTradeHistory(...symbols) {
    // Raise error if symbols more than 10.
    if (symbols.length > MAX_SYMBOL_NUMBERS) {
      throw new Error(`Maximum of ${MAX_SYMBOL_NUMBERS} symbols allowed`);
    }

    // Loop async call.
    const tradeHistory = await Promise.all(symbols.map(async (iSymbol) => {
      return await this.binance.futuresUserTrades(iSymbol);
    }));

    // Flatten array.
    const flattened = tradeHistory.reduce((acc, curr) => acc.concat(curr), []);
    return flattened;
  }

  //
  // async buy(orderProposal) {
  //   throw new Error("Method not implemented.");
  // }
  //
  // async sell(orderProposal) {
  // }
  //
  // async closeOrder(orderProposal) {
  //   throw new Error("Method not implemented.");
  // }
  //
  // async cancelOrder(orderProposal) {
  //   throw new Error("Method not implemented.");
  // }
  //
  // async validateOrder(side, price, quantity, orderType) {
  //   throw new Error("Method not implemented.");
  // }
};


