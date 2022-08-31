/**
 * @typedef SignalRFQ A request for executing a signal.
 * @property {string} signalName -> signal name.
 * @property {string} symbol -> ticker.
 * @property {'buy' | 'sell'} -> side.
 * @property {number} riskExposurePercentage -> riskExposurePercentage.
 * @property {number} requestType -> proposalType.
 * @property {number} mark -> entryPrice.
 * @property {number} winRate -> winRate.
 * @property {string} timeFrame -> timeFrame.
 * @property {any} data -> data.
 */

/**
 * @typedef PulseRFQ A request for executing a signal.
 * @property {string} pulseName -> signal name.
 * @property {string} symbol -> ticker.
 * @property {number} stakeRisk -> stakeRisk.
 * @property {number} requestType -> proposalType.
 * @property {number} markPrice -> entryPrice.
 * @property {number} winRate -> winRate.
 * @property {string} timeFrame -> timeFrame.
 * @property {any} data -> data.
 */

/**
 * @typedef PurchaseOrder A purchase order for executing a signal.
 * @property {string} symbol -> ticker.
 * @property {'buy' | 'sell'} -> side.
 * @property {number} price -> price.
 * @property {number} qty -> quantity.
 * @property {number} stakeRisk -> stakeRisk.
 * @property {number} proposalType -> proposalType.
 * @property {any} data -> data.
 * @property {number} walletBalance -> walletBalance.
 * @property {number} sl -> sl.
 * @property {number} tp -> tp.
 * @property {number} entryPrice -> entryPrice.
 * @property {number} leverage -> leverage.
 * @property {number} winRate -> winRate.
 * @property {string} timeFrame -> timeFrame.
 */

exports.unused = {};
