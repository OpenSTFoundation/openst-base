"use strict";


const { spawn }         = require('child_process')
    , path              = require("path")
    , rootPrefix        = "../.."
    , run_chain_path    = path.resolve(__dirname, rootPrefix + "/tests/scripts/run_chain.sh" )
    , start_time_buffer = 10000
    , stop_time_buffer  = 3000
;

const GethManager = function () {
  const oThis = this;

  oThis.start();
  oThis.bindSignalHandlers();
  
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
          if ( oThis.isAlive() ) {
            resolve( true );  
          } else {
            reject(new Error("Failed to start geth.") );
          }
          
        }, start_time_buffer );

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
          if ( !oThis.isAlive() ) {
            resolve( true );  
          } else {
            reject(new Error("Failed to stop geth.") );
          }
        }, stop_time_buffer );
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
  , bindSignalHandlers: function () {
    const oThis = this;

    const sigHandler = function () {
      console.log("GethManager :: sigHandler triggered!. Stoping Geth Now.");
      oThis.stop();
    };

    process.on('SIGINT', sigHandler);
    process.on('SIGTERM', sigHandler);

  }
}




module.exports = new GethManager();