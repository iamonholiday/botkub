const {OrderManager} = require("./order-helper");
const cfg = require("dotenv").config().parsed;
const {expect} = require("chai");

describe("Test functions/index.js", async () => {
  beforeEach(() => {
    process.env = cfg;
  });

  it("should has orderId.", async () => {
    const order = new OrderManager("binance");
    const {result: buyLimitResult} = await order.buyLimit({
      symbol: "ETHUSDT",
      qty: .1,
      price: 1592.82,
    });

    expect(buyLimitResult).to.have.property("orderId");
  });
});
