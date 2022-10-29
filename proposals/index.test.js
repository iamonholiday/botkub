const {expect} = require("chai");
// const faker = require("faker");
// const sinon = require("sinon");
// const {step, xstep} = require("mocha-steps");
const {createSignalRFQ, createPulseRFQ, ProposalManager} = require("./index");
const functions = require("firebase-functions");

const EXPIRED_LENGTH = 1 * 60 * 1000;
// Store current time as string.

const NOW_STRING = new Date().toISOString();
const NOW_DATE = new Date(NOW_STRING);
const NOW_DATE_EXPIRED = new Date(NOW_DATE.getTime() + EXPIRED_LENGTH);


const INPUT_SIGNAL_01 = {
  signalName: "MayMae-CROSS",
  side: "buy",
  ticker: "ETHUSDTPERP",
  time: NOW_DATE,
  interval: "5",
  mark: "21500",
  pp: "21500",
  l1: "21501",
  l2: "21502",
  l3: "21503",
  l4: "21504",
  l5: "21505",
  fastLine: "21500",
  expiry: NOW_DATE_EXPIRED,
  exchange: "BINANCE",
};

// pulse ATR -> pulse|ticker|time|interval|mark|buyTP|buySL|sellTP|sellSL
const INPUT_PULSE_ATR = {
  pulse: "ATR",
  ticker: "ETHUSDTPERP",
  time: NOW_DATE,
  interval: "5",
  mark: "21500",
  buyTP: "21590",
  buySL: "21490",
  sellTP: "21490",
  sellSL: "21590",
  expiry: NOW_DATE_EXPIRED,
  exchange: "BINANCE",
};

// pulse EMA -> pulse|ticker|time|interval|mark|fastEMA|slowEMA
const INPUT_PULSE_EMA = {
  pulse: "EMA",
  ticker: "ETHUSDTPERP",
  time: NOW_DATE,
  interval: "5",
  mark: "21500",
  fastEMA: "21500",
  slowEMA: "21501",
  expiry: NOW_DATE_EXPIRED,
  exchange: "BINANCE",
};

// pulse CCI200 -> pulse|ticker|time|interval|mark|cci200
const INPUT_PULSE_CCI200 = {
  pulse: "CCI200",
  ticker: "ETHUSDTPERP",
  time: NOW_DATE,
  interval: "5",
  mark: "21500",
  cci200: "21500",
  expiry: NOW_DATE_EXPIRED,
  exchange: "BINANCE",
};

// pulse LX -> pulse|ticker|time|interval|mark|lx
const INPUT_PULSE_LX = {
  pulse: "LX",
  ticker: "ETHUSDTPERP",
  time: NOW_DATE,
  interval: "5",
  mark: "21500",
  lx: "5",
  expiry: NOW_DATE_EXPIRED,
  exchange: "BINANCE",
};

describe("Test proposal.", async () => {
  it("should create signal RFQ.", async () => {
    const {
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
      data,
    } = createSignalRFQ(INPUT_SIGNAL_01);

    // Expect signalName, side, symbol, time, timeFrame, mark, fastLine, winRate, requestType, stakeRisk, data.
    expect(signalName).to.equal("MayMae-CROSS");
    expect(side).to.equal("buy");
    expect(symbol).to.equal("ETHUSDPERP");
    expect(time).to.equal(NOW_DATE);
    expect(timeFrame).to.equal("5");
    expect(mark).to.equal("21500");
    expect(fastLine).to.equal("21500");
    expect(winRate).to.equal(.7);
    expect(requestType).to.equal("signal");
    expect(riskExposurePercentage).to.equal(.02);
    expect(expiry).to.equal(NOW_DATE_EXPIRED);
    expect(data).to.deep.equal({
      pp: "21500",
      l1: "21501",
      l2: "21502",
      l3: "21503",
      l4: "21504",
      l5: "21505",
    });
  });

  it("should create pulse RFQ for ATR.", async () => {
    const {

      pulse,
      symbol,
      time,
      timeFrame,
      mark,

      winRate,
      requestType,
      stakeRisk,
      expiry,
      data,
    } = createPulseRFQ(INPUT_PULSE_ATR);

    // Expect pulse, symbol, time, timeFrame, mark, winRate, requestType, stakeRisk, data.
    expect(pulse).to.equal("ATR");
    expect(symbol).to.equal("ETHUSDPERP");
    expect(time).to.equal(NOW_DATE);
    expect(timeFrame).to.equal("5");
    expect(mark).to.equal("21500");
    expect(winRate).to.equal(.7);
    expect(requestType).to.equal("pulse");
    expect(stakeRisk).to.equal(.02);
    expect(expiry).to.equal(NOW_DATE_EXPIRED);
    expect(data).to.deep.equal({
      buyTP: "21500",
      buySL: "21501",
      sellTP: "21502",
      sellSL: "21503",
    });
  });

  it("should create pulse RFQ for EMA.", async () => {
    const {

      pulse,
      symbol,
      time,
      timeFrame,
      mark,

      winRate,
      requestType,
      stakeRisk,
      expiry,
      data,
    } = createPulseRFQ(INPUT_PULSE_EMA);

    // Expect pulse, symbol, time, timeFrame, mark, winRate, requestType, stakeRisk, data.
    expect(pulse).to.equal("EMA");
    expect(symbol).to.equal("ETHUSDPERP");
    expect(time).to.equal(NOW_DATE);
    expect(timeFrame).to.equal("5");
    expect(mark).to.equal("21500");
    expect(winRate).to.equal(.7);
    expect(requestType).to.equal("pulse");
    expect(stakeRisk).to.equal(.02);
    expect(expiry).to.equal(NOW_DATE_EXPIRED);
    expect(data).to.deep.equal({
      fastEMA: "21500",
      slowEMA: "21501",
    });
  });

  it("should create pulse RFQ for CCI200.", async () => {
    const {

      pulse,
      symbol,
      time,
      timeFrame,
      mark,

      winRate,
      requestType,
      stakeRisk,
      expiry,
      data,
    } = createPulseRFQ(INPUT_PULSE_CCI200);

    // Expect pulse, symbol, time, timeFrame, mark, winRate, requestType, stakeRisk, data.
    expect(pulse).to.equal("CCI200");
    expect(symbol).to.equal("ETHUSDPERP");
    expect(time).to.equal(NOW_DATE);
    expect(timeFrame).to.equal("5");
    expect(mark).to.equal("21500");
    expect(winRate).to.equal(.7);
    expect(requestType).to.equal("pulse");
    expect(stakeRisk).to.equal(.02);
    expect(expiry).to.equal(NOW_DATE_EXPIRED);
    expect(data).to.deep.equal({
      cci200: "21500",
    });
  });

  it("should create pulse RFQ for LX.", async () => {
    const {

      pulse,
      symbol,
      time,
      timeFrame,
      mark,

      winRate,
      requestType,
      stakeRisk,
      expiry,
      data,
    } = createPulseRFQ(INPUT_PULSE_LX);

    // Expect pulse, symbol, time, timeFrame, mark, winRate, requestType, stakeRisk, data.
    expect(pulse).to.equal("LX");
    expect(symbol).to.equal("ETHUSDTPERP");
    expect(time).to.equal(NOW_DATE);
    expect(timeFrame).to.equal("5");
    expect(mark).to.equal("21500");
    expect(winRate).to.equal(.7);
    expect(requestType).to.equal("pulse");
    expect(stakeRisk).to.equal(.02);
    expect(expiry).to.equal(NOW_DATE_EXPIRED);
    expect(data).to.deep.equal({
      lx: "5",
    });
  });

  it("should return leverage.", async () => {
    const signalRFQ = createSignalRFQ(INPUT_SIGNAL_01);
    const pulseATR = createPulseRFQ(INPUT_PULSE_ATR);
    const pulseEMA = createPulseRFQ(INPUT_PULSE_EMA);
    const pulseCCI200 = createPulseRFQ(INPUT_PULSE_CCI200);
    const pulseLX = createPulseRFQ(INPUT_PULSE_LX);
    const pmgr = new ProposalManager(
        signalRFQ,
        pulseATR,
        pulseEMA,
        pulseCCI200,
        pulseLX);

    const lv = await pmgr.calculateLeverage();
    expect(lv).to.equal(5);
  });

  it("should execute purchase order from signal.", async () => {
    const signalRFQ = createSignalRFQ(INPUT_SIGNAL_01);
    const pulseATR = createPulseRFQ(INPUT_PULSE_ATR);
    const pulseEMA = createPulseRFQ(INPUT_PULSE_EMA);
    const pulseCCI200 = createPulseRFQ(INPUT_PULSE_CCI200);
    const pulseLX = createPulseRFQ(INPUT_PULSE_LX);

    const pmgr = new ProposalManager(
        signalRFQ,
        ...[pulseATR,
          pulseEMA,
          pulseCCI200,
          pulseLX],
    );

    // Expect this.hasPrepared = false.
    expect(pmgr.hasPrepared).to.equal(false);


    try {
      // Prepare and populate proposal.
      await pmgr.preparePurchaseOrder();

      // Expect this.hasPrepared = true;
      expect(pmgr.hasPrepared).to.equal(true);

      // Expect proposal deep equal to expected purchase order.

      const {symbol} = pmgr.proposal;
      const expectedPurchaseOrder = {symbol};

      expect(expectedPurchaseOrder).to.deep.equal({
        symbol: "ETHUSDTPERP",
      });

      // Expect execute order as proposal.
      await pmgr.execute();

      // Expect this.hasExecuted = true;
      expect(pmgr.hasExecuted).to.equal(true);
    } catch (err) {
      functions.logger.error(err);

      // Expect no error.
      expect(err).to.equal(null);
    }
  });

  it("should execute purchase order from pulse ATR.", async () => {
    const pulseATR = createPulseRFQ(INPUT_PULSE_ATR);


    const pmgr = new ProposalManager(
        null,
        ...[pulseATR],
    );

    // Expect this.hasPrepared = false.
    expect(pmgr.hasPrepared).to.equal(false);

    // Prepare and populate proposal.
    await pmgr.preparePurchaseOrder();

    // Expect proposal deep equal to expected purchase order.

    const {symbol} = pmgr.proposal;
    const expectedPurchaseOrder = {symbol};

    expect(expectedPurchaseOrder).to.deep.equal({
      symbol: "ETHUSDTPERP",
    });

    // Expect execute order as proposal.
    await pmgr.execute();
  });
});
