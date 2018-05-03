"use strict";


const { spawn }         = require('child_process')
    , path              = require("path")
    , rootPrefix        = "../.."
    , run_chain_path    = path.resolve(__dirname, rootPrefix + "/tests/scripts/run_chain.sh" )
;

const GethManager = function () {
  const oThis = this;
  oThis.start();
};

GethManager.prototype = {
  constructor: GethManager

  , gethProcess: null
  , isAlive: function () {
    const oThis = this;
    return oThis.gethProcess ? true : false;
  }

  , _startPromise : null
  , startWaitTime : 5000
  , start: function () {
    const oThis = this;

    oThis._startPromise = oThis._startPromise || new Promise( function ( resolve, reject) {
        if ( oThis.isAlive() ) {
          resolve( true );
        }

        let gethProcess = oThis.gethProcess = spawn("bash", [run_chain_path], { shell: true });
        gethProcess.on("exit", function (code, signal) {
          console.log("gethProcess has exitted!  code:", code, "signal", signal, "run_chain_path:", run_chain_path);
          oThis.gethProcess = null;
        });

        // Give some time to geth to start.
        setTimeout( function () {
          resolve( true );
        }, 10000 );

      })
      .then( function () {
        // Finally, _startPromise should be set to null.
        oThis._startPromise = null;   
      })
      .catch( function ( reason ) {
        // Ensure gethProcess becomes null.
        oThis.gethProcess = null;
        oThis._startPromise = null;
        throw reason;
      })
    ;
    return oThis._startPromise;
  }

  , _stopPromise: null
  , stop: function () {
    const oThis = this;


    oThis._stopPromise = oThis._stopPromise || new Promise( function ( resolve, reject) {
        if ( !oThis.isAlive() ) {
          resolve( true );
        }

        oThis.gethProcess.kill();
        // This is dummy code.
        setTimeout( function () {
          resolve( true );
        }, 10000 );
      })
      .then( function () {
        // Finally, _startPromise should be set to null.
        oThis._stopPromise = null;   
      })
      .catch( function ( reason ) {
        oThis._stopPromise = null;
        throw reason;
      })
    ;

    return oThis._stopPromise;
  }

  , getTransactionAddressInfo: function () {
    // This is dummy code.
    return {
      sender        : process.env.OST_UTILITY_CHAIN_OWNER_ADDR
      , passphrase  : process.env.OST_UTILITY_CHAIN_OWNER_PASSPHRASE
      , recipient   : process.env.OST_FOUNDATION_ADDR
    };
  }

  , getWebSocketEndPoint: function () {
    // This is dummy code.
    return process.env.OST_UTILITY_GETH_WS_PROVIDER;
  }

  , getHttpEndPoint: function () {
    // This is dummy code.
    return process.env.OST_UTILITY_GETH_RPC_PROVIDER;
  }

}


module.exports = new GethManager();