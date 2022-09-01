/*
exports.healthCheck = functions.https.onRequest(async (req, res) => {
const order = new OrderManager("binance");

// Check account.
const account = await order.getAccount();
functions.logger.info("account", "account", account);

// Check balances.
const balance = await order.getBalances("BTC", "BUSD");
functions.logger.info("balance", "balance", balance);

// Check assets.
const assets = await order.getAssets("BTC", "USDT", "BUSD");
functions.logger.info("assets", "assets", assets);

const listOfPos = await order.getPositions("BTCUSDT");
functions.logger.info("listOfPos", "listOfPos", listOfPos);

const openOrders = await order.getOpenOrders("ETHUSDT");
functions.logger.info("openOrders", "openOrders", openOrders);

const orderHistory = await order.getOrderHistory("ETHUSDT");
functions.logger.info("orderHistory", "orderHistory", orderHistory);

const tradeHistory = await order.getTradeHistory("ETHUSDT");
functions.logger.info("tradeHistory", "tradeHistory", tradeHistory);
});

exports.healthCheckOrder = functions.https.onRequest(async (req, res) => {
const order = new OrderManager("binance");

const {result: buyLimitResult} = await order.buyLimit({
symbol: "ETHUSDT",
qty: .1,
price: 1592.82,
});

return res.json(buyLimitResult);
});
*/










// Obsoleted Risk and Rewards

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
