/*
const {OrderManager} = require("../orders/order-helper");
const cfg = require("dotenv").config().parsed;
const {expect} = require("chai");
const {step, xstep} = require("mocha-steps");
const _ = require("lodash");
const {CommonHelper} = require("../helpers/common-helper");
const {ProposalManager} = require("../proposals");

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


  // Test buy when got signals.
  step("Test buy when got signals.", async () => {
    const rfq = {
      symbol: TEST_SYMBOL_01,
      side: "buy",


    };

    const order = new ProposalManager();
  });

  // Test update order when got pulse.
});
*/
