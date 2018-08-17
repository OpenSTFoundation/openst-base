'use strict';

const rootPrefix = '../..',
  WebsocketProvider = require('web3-providers-ws'),
  OSTWeb3 = require(rootPrefix + '/lib/ost_web3/ost-web3'),
  Logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  logger = new Logger('Web3Pool');

const WS_OPEN_STATE = 1;

const DEFAULT_POOL_SIZE = process.env['OST_WEB3_POOL_SIZE'] || 10;

/**
 * Creates a new Web3 Pool.
 * @class
 * @param {string} provider - web3 provider end-point url/path.
 * @param {object} {optional} net - object to connet with IPC.
 * @param {object} {optional} options - Web3Pool supported config options.
 */

const Web3Pool = (module.exports = function(provider, net, options) {
  const oThis = this;

  Object.assign(oThis, options);

  // set the provider
  oThis.provider = provider || oThis.provider;

  // set the net
  oThis.net = net || oThis.net;

  // Init the instance.
  oThis.setPoolSize(oThis.poolSize);
});

Web3Pool.prototype = /** @lends Web3Pool# */ {
  constructor: Web3Pool,

  // {number} Maximum number of web3 instances to create
  poolSize: DEFAULT_POOL_SIZE,

  // {object} Options to be passed to OSTWeb3 Class
  ostWeb3Options: null,

  // {string}
  provider: null,

  // {object} net object to be passed Web3 Constructor
  net: null,

  _pool: null,
  _getCnt: 0,
  // Once _getCnt reaches _maxSafeCnt, it will be reset to zero.
  _maxSafeCnt: Number.MAX_SAFE_INTEGER,

  setPoolSize: function(poolSize) {
    const oThis = this;

    oThis.poolSize = poolSize;

    // Initialize pool Array
    oThis._pool = [];

    // Set the cnt to zero.
    oThis._getCnt = 0;

    // Set the maxSafeCnt
    oThis._maxSafeCnt = Number.MAX_SAFE_INTEGER - (Number.MAX_SAFE_INTEGER % oThis.poolSize);
  },

  getInstance: function() {
    const oThis = this;
    return oThis.getInstanceWithRetryCnt(oThis.poolSize);
  },

  getInstanceWithRetryCnt: function(retryCnt) {
    const oThis = this;

    let poolIndx = oThis._getCnt % oThis.poolSize;

    let web3 = oThis._pool[poolIndx];

    if (!web3) {
      logger.log('Creating new instance of web3. poolIndx:', poolIndx);
      // Create a new web3 instance.
      web3 = oThis._pool[poolIndx] = new OSTWeb3(oThis.provider, oThis.net, oThis.ostWeb3Options);
    } else if (retryCnt > 0) {
      logger.log('Choosing Existing Connection. poolIndx:', poolIndx);
      // Deal with existing connection.
      let web3Provider = web3.currentProvider;

      // Ensure its a WebsocketProvider
      if (web3Provider instanceof WebsocketProvider) {
        let connection = web3Provider.connection;

        // Ensure connection is open.
        if (connection._readyState !== WS_OPEN_STATE) {
          // Increase the _getCnt
          oThis._incrGetCnt();

          logger.log('poolIndx:', poolIndx, 'is not open. Trying next connection in pool. retryCnt:', retryCnt);
          // Let try next connection in pool.
          return oThis.getInstanceWithRetryCnt(--retryCnt);
        }
      }
    } else {
      logger.log('retryCnt has reached 0. poolIndx:', poolIndx);
    }

    // Increase the _getCnt
    oThis._incrGetCnt();

    return web3;
  },

  _incrGetCnt: function() {
    const oThis = this;

    //Increase the _getCnt
    oThis._getCnt++;

    if (oThis._getCnt >= oThis._maxSafeCnt) {
      // Reset the _getCnt to zero.
      oThis._getCnt = 0;
    }
  }
};
