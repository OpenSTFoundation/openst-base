"use strict";
//This is a derived class of web3js

// Third Party Requires.
const Web3 = require('web3');

// Other Requires
const rootPrefix    = "../.."
    , OstWSProvider = require(rootPrefix + '/lib/ost_web3/ost-web3-providers-ws')
    , Logger        = require(rootPrefix + "/lib/logger/custom_console_logger")
;

const logger = new Logger("OSTWeb3");

const OSTWeb3 = module.exports = function (provider, net, options) {
  let oThis = this;

  options = options || {};

  //If WS Provider, create one.
  var providerOptions = options.providerOptions || {};
  providerOptions = Object.assign({}, OSTWeb3.DefaultOptions.providerOptions, providerOptions );
  oThis.providerOptions = providerOptions;
  if( providerOptions.autoReconnect && typeof provider === "string" && /^ws(s)?:\/\//i.test( provider) ) {
    provider = new OstWSProvider( provider, null, providerOptions );
  }

  oThis = Web3.call(oThis, provider, net ) || oThis;
  providerOptions.providerPollingInterval = Number( providerOptions.providerPollingInterval );
  let providerPollingInterval = providerOptions.providerPollingInterval;
  if ( provider instanceof OstWSProvider &&  !isNaN( providerPollingInterval ) && providerPollingInterval > 0) {
    provider.onConnectionOpen = function () {
      oThis.providerHeartbeat();
    };
  }


  return oThis;
};

OSTWeb3.OstWSProvider = OstWSProvider;


OSTWeb3.DefaultOptions = {
  providerOptions: {
    autoReconnect: true
    , maxReconnectTries: 100
    , reconnectInterval: 500 /* Miliseconds */
    , killOnReconnectFailure: true
    , emitterMaxListeners: 100
    , providerPollingInterval: 30000
  }
};


let OSTWeb3Proto = {

  providerHeartbeat: function () {
    const oThis = this;

    oThis.eth.getBlockNumber()
      .then(  function ( result ) {
        logger.info("heartbeat successful. latest block number::", result);
      })
      .catch( function ( reason ) {
        logger.error("WS ping failed. reason ::", reason);
      })
      .then(  function () {
        setTimeout( function () {
          oThis.providerHeartbeat();
        }, oThis.providerOptions.providerPollingInterval );
      })
    ;
  }

};



//Take care of prototype
OSTWeb3.prototype = Object.assign(OSTWeb3Proto, Web3.prototype );

//Take care of all static properties of Web3.
(function () {

  function addProp( prop ) {
    Object.defineProperty(OSTWeb3, prop, {
      get: function () {
        return Web3[ prop ];
      }
      , set: function ( newValue ) {
        Web3[ prop ] = newValue; 
      }
    });    
  }
  for( var prop in Web3 ) {
    addProp(prop);
  }
})();




