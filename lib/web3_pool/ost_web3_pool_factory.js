"use strict";

const rootPrefix  = "../.."
    , Web3Pool    = require(rootPrefix + "/lib/web3_pool/ost_web3_pool")
;

const DEFAULT_POOL_SIZE = process.env[ "OST_WEB3_POOL_SIZE" ] || 10;

const Factory = function ( poolConfig ) {
  const oThis = this;

  poolConfig = poolConfig || {};

  oThis.poolConfig = {};

  let defaultPoolConfig = {
    poolSize: DEFAULT_POOL_SIZE
  };

  Object.assign( oThis.poolConfig, defaultPoolConfig, poolConfig );

  oThis._providerToPoolMap = {};

};

Factory.prototype = {
  constructor: Factory

  // Pool Size 
  , poolConfig: null

  // map of pools.
  , _providerToPoolMap : null

  , getPool: function ( provider, net, poolConfig ) {
    const oThis = this;

    let pool = oThis._providerToPoolMap[ provider ];

    if ( !pool ) {
      poolConfig = Object.assign({}, oThis.poolConfig, poolConfig);
      pool = oThis._providerToPoolMap[ provider ] = new Web3Pool( provider, net, poolConfig );
    }

    return pool;
  }

  , getWeb3: function ( provider, net, poolConfig ) {
    const oThis = this;

    let pool = oThis.getPool(provider, net, poolConfig);

    return pool.getInstance();
  }

};

module.exports = new Factory();

