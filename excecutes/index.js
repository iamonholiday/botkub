const {OrderHelper} = require("../orders/order-helper");

/**
 *
 * @param {string} ticker - Ticker of coin.
 * @return {Promise<Object[]>}
 */
async function getPositions(ticker) {
  const orderHelper = new OrderHelper();
  const activeOrder = await orderHelper.getPositions(ticker);
  return activeOrder;
}

exports.exeSignalProposal = async (signalProposal) => {
  // Get active order from firebase.
  const listOfPos = await getPositions(signalProposal.ticker);
  // Check if there is any active order.
  if (listOfPos.length === 0) {
    // If there is no active order, then create new order.
    // await createNewOrder(signalProposal);
  }
};

exports.exePulseProposal = async (pulseProposal) => {


};

