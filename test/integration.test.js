const {OrderManager} = require("../orders/order-helper");
const cfg = require("dotenv").config().parsed;
const {expect} = require("chai");
const {step, xstep} = require("mocha-steps");
// const _ = require("lodash");
// const {CommonHelper} = require("../helpers/common-helper");

const TEST_SYMBOL_01 = "ETHUSDT";


describe("From check to executes.", async () => {
  let order;
  let limitOrderedBuy;
  // eslint-disable-next-line no-unused-vars
  let futurePrices;
  let DEPT_01;


  beforeEach(() => {
    process.env = cfg;
    order = new OrderManager("binance");
  });

  xstep("should fetch future prices", async () => {
    // Store future prices.
    futurePrices = await order.futuresPrices();

    // Store DEPT for buy and sell.
    DEPT_01 = await order.futuresDepth(TEST_SYMBOL_01);
  });

  xstep("should has open orderId when place spread more than 10.", async () => {
    // eslint-disable-next-line prefer-destructuring
    const [bidPrice] = DEPT_01.bids[10];

    // Test buy side by using qty and price from dept.
    const {result: buyLimitResult} = await order.buyLimit({
      symbol: TEST_SYMBOL_01,
      qty: .01,
      price: bidPrice,

    }, {timeInForce: "GTC"});

    limitOrderedBuy = buyLimitResult;
    expect(limitOrderedBuy).to.have.property("orderId");

    // Test open order.
    const openOrders= await order.getOpenOrders(TEST_SYMBOL_01);

    // Expect open order to be one.
    expect(openOrders.length).to.equal(1);
  });

  xstep("should has a buy order in history.", async () => {
    // Wait for order to be placed.
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Check order.
    const openOrdersResult = await order.getOrderHistoryLast24H(TEST_SYMBOL_01);

    // Expect order to be in history.
    expect(openOrdersResult).to.have.lengthOf.at.least(1);

    // Check ordered has this order ID.
    const foundOrderId = openOrdersResult.find((iOrder) => iOrder.orderId === limitOrderedBuy.orderId);
    expect(foundOrderId).to.exist;

    // Expected to have the following properties.
    expect(foundOrderId).to.have.property("orderId");
    expect(foundOrderId).to.have.property("symbol");
    expect(foundOrderId).to.have.property("status");
    expect(foundOrderId).to.have.property("clientOrderId");
    expect(foundOrderId).to.have.property("price");
    expect(foundOrderId).to.have.property("avgPrice");
    expect(foundOrderId).to.have.property("origQty");
    expect(foundOrderId).to.have.property("executedQty");
    expect(foundOrderId).to.have.property("cumQuote");
    expect(foundOrderId).to.have.property("timeInForce");
    expect(foundOrderId).to.have.property("type");
    expect(foundOrderId).to.have.property("reduceOnly");
    expect(foundOrderId).to.have.property("closePosition");
    expect(foundOrderId).to.have.property("side");
    expect(foundOrderId).to.have.property("positionSide");
    expect(foundOrderId).to.have.property("stopPrice");
    expect(foundOrderId).to.have.property("workingType");
    expect(foundOrderId).to.have.property("priceProtect");
    expect(foundOrderId).to.have.property("origType");
    expect(foundOrderId).to.have.property("time");
    expect(foundOrderId).to.have.property("updateTime");
  });

  xstep("should update TP and SL.", async (orderProposal, options) => {
    /*
    {
      "symbol": "ETHUSDT",
      "positionAmt": "0.000",
      "entryPrice": "0.0",
      "markPrice": "1614.97707445",
      "unRealizedProfit": "0.00000000",
      "liquidationPrice": "0",
      "leverage": "7",
      "maxNotionalValue": "2000000",
      "marginType": "isolated",
      "isolatedMargin": "0.00000000",
      "isAutoAddMargin": "false",
      "positionSide": "BOTH",
      "notional": "0",
      "isolatedWallet": "0",
      "updateTime": 1661246580069
    }
    * * */


    // const deeps = await order.futuresDepth(TEST_SYMBOL_01);
    // // eslint-disable-next-line prefer-destructuring
    // // const [bidPrice] = deeps.bids[0];
    // // eslint-disable-next-line prefer-destructuring
    // const [askPrice] = deeps.asks[2];
    //
    // // Test buy side by using qty and price from dept.
    // const {result: buyLimitResult} = await order.buyLimit({
    //   symbol: TEST_SYMBOL_01,
    //   qty: 1,
    //   price: bidPrice,
    //
    // }, {timeInForce: "GTC"});
    //
    // // Expect buyLimitResult to be a object.
    // expect(buyLimitResult).to.be.an("object");
    //
    //
    // // Test buy side by using qty and price from dept.
    // // const {result: slResult} = await order.takeProfitMarket(
    // //     "SELL", TEST_SYMBOL_01,
    // //     1,
    // //     {
    // //       symbol: TEST_SYMBOL_01,
    // //       stopPrice: Number(askPrice).toFixed(2),
    // //       type: "TAKE_PROFIT_MARKET",
    // //     });
    // //
    // //
    // // // Expected slResult has value.
    // // expect(slResult).to.have.property("orderId");
  });

  xstep("check balances", async () => {
    const balances = await order.getBalances();
    expect(balances).to.be.an("array");

    expect(balances[0]).to.have.property("asset");
    expect(balances[0]).to.have.property("balance");
    expect(balances[0]).to.have.property("availableBalance");
  });

  step("test anything.", async () => {
    const {price, qty, percentage, side} = await order.calStake(TEST_SYMBOL_01, .02, "BUY");
    expect(price).to.equal(0.0);
    expect(qty).to.equal(0.0);
    expect(percentage).to.equal(0.0);
    expect(side).to.equal("BUY");
  });
});
