"use strict";


const { spawn }         = require('child_process')
    , path              = require("path")
    , rootPrefix        = "../.."
    , start_time_buffer = 10000
    , stop_time_buffer  = 10000
    , init_time_buffer  = 10000
;

const gethArgs = {
  networkid         : "20171010"
  , datadir         : path.resolve(__dirname, rootPrefix + "/tests/scripts/st-poa")
  , port            : "30301"
  , maxpeers        : "0"
  , verbosity       : "3"
  
  // ACCOUNT OPTIONS
  , unlock          : "0"
  , password        : path.resolve(__dirname, rootPrefix + "/tests/scripts/pw" )
  
  // MINER OPTIONS
  , mine            : ""
  , minerthreads    : "1"
  , etherbase       : "0"
  , targetgaslimit  : "100000000"
  , gasprice        : '"1"'


  //RPC-CONFIG
  , rpc       : ""
  , rpcapi    : "eth,net,web3,personal,txpool"
  , rpcport   : "12546"
  , rpcaddr   : "127.0.0.1"


  //WS-CONFIG
  , ws        : ""
  , wsport    : "13546"
  , wsorigins : "'*'"
  , wsaddr    : "127.0.0.1"
  , wsapi     : "eth,net,web3,personal,txpool"
};

const gethSetupConfig = {
  poaGenesisAbsolutePath  : path.resolve(__dirname, rootPrefix + "/tests/scripts/poa-genesis.json")
  , preInitArgsToIgnore   : ["etherbase", "unlock", "password", "mine", "minerthreads"]
  , passphrase            : "testtest"
  , noOfAddresses         : 3
  , datadir               : gethArgs.datadir
  , passphraseFilePath    : gethArgs.password
};

const gethSpawnOptions = {
  shell   : true
  , stdio : [ 'ignore', process.stdout, process.stderr ]
};

const GethManager = function () {
  const oThis = this;

  oThis.gethArgs          = Object.assign( {}, gethArgs );
  oThis.gethSetupConfig   = Object.assign( {}, gethSetupConfig );
  oThis.gethSpawnOptions  = Object.assign( {}, gethSpawnOptions );
  oThis.bindSignalHandlers();

};

GethManager.prototype = {
  constructor: GethManager
  , gethArgs  : null
  , gethProcess: null
  , isAlive: function () {
    const oThis = this;
    return oThis.gethProcess ? true : false;
  }

  , _startPromise : null
  , startWaitTime : 5000
  , gethSpawnOptions: null
  , start: function ( argKeysToIgnore ) {
    const oThis = this;

    oThis._startPromise = oThis._startPromise || new Promise( function ( resolve, reject) {
        if ( oThis.isAlive() ) {
          resolve( true );
        }

        let gethArgsArray = []
          , argKey
          , argValue
        ;


        argKeysToIgnore = argKeysToIgnore || [];
        

        for( argKey in oThis.gethArgs ) {
          if ( !( oThis.gethArgs.hasOwnProperty( argKey ) ) )  {
            continue;
          }
          if ( argKeysToIgnore.indexOf( argKey ) >= 0 ) {
            //Ignore this arg.
            continue;
          }

          //Push the key
          gethArgsArray.push( "--" + argKey );

          argValue = oThis.gethArgs[ argKey ];

          if ( argValue && argValue.length ) {
            //Push the value.
            gethArgsArray.push( argValue );
          }
        }

        console.log("Starting geth with command :: \ngeth", gethArgsArray.join(" "), "\n");

        let gethProcess = oThis.gethProcess = spawn("geth", gethArgsArray, oThis.gethSpawnOptions );
        gethProcess.on("exit", function (code, signal) {
          console.log("[GETH-START] gethProcess has exitted!  code:", code, "signal", signal, "geth command:\n geth", gethArgsArray.join(" "), "\n");
          oThis.gethProcess = null;
        });

        // Give some time to geth to start.
        setTimeout( function () {
          if ( oThis.isAlive() ) {
            console.log("[GETH-START] gethProcess.pid =", gethProcess.pid);
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

        oThis.gethProcess.kill("SIGTERM");

        let killArgsArray = [
          "-9"
          ,oThis.gethProcess.pid
        ];

        let killProcess = spawn("kill", killArgsArray, { shell: true} );
        killProcess.on("exit", function (code, signal) {
          console.log("[GETH-STOP] Geth process should be dead now. command: kill", killArgsArray.join(" "), "kill command exit-code", code );
          // let psProcess = spawn("ps", ["aux", "|", "grep", "'geth'", "|", "awk", "'{print $2}'"], {
          //   shell: true
          //   , stdio: [ 'ignore', process.stdout, process.stderr ]
          // })
        })

        
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

  , getWebSocketEndPoint: function () {
    const oThis     = this
        , gethArgs  = oThis.gethArgs
    ;

    return "ws://" + gethArgs["wsaddr"] + ":" + gethArgs["wsport"];
  }

  , getHttpEndPoint: function () {
    const oThis     = this
        , gethArgs  = oThis.gethArgs
    ;

    return "http://" + gethArgs["rpcaddr"] + ":" + gethArgs["rpcport"];
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
  , __sender: null
  , __senderPassphrase: null
  , __recipient: null
  , getTransactionAddressInfo: function () {
    const oThis = this;
    if ( !oThis.__sender || !oThis.__senderPassphrase || !oThis.__recipient ) {
      oThis.populateTransactionAddressInfo();
    }
    // This is dummy code.
    return {
      sender        : oThis.__sender
      , passphrase  : oThis.__senderPassphrase
      , recipient   : oThis.__recipient
    };
  }
  , populateTransactionAddressInfo: function () {
    const oThis = this
        , gethSetupConfig         = oThis.gethSetupConfig
        , poaGenesisAbsolutePath  = gethSetupConfig.poaGenesisAbsolutePath
        , addresses     = ["__sender", "__recipient"]
    ;

    let poaGenesis    = require( poaGenesisAbsolutePath )
      , genesisAlloc  = poaGenesis.alloc
      , addrLen       = addresses.length
      , gKey
    ;

    for( gKey in genesisAlloc ) {
      if ( !( genesisAlloc.hasOwnProperty( gKey ) ) ) {
        continue;
      }
      if ( !addrLen-- ) {
        break;
      }
      oThis[ addresses[addrLen] ] = gKey;
    }

    oThis.__senderPassphrase = gethSetupConfig.passphrase;
  }
  , gethSetupConfig : null
  , getGethSetupConfig: function () {
    const oThis = this;
    return oThis.gethSetupConfig;
  }

  , __initPromise: null
  , hasInitialized: false
  , initGeth: function () {
    const oThis = this;

    oThis.__initPromise = oThis.__initPromise || new Promise( function( resolve, reject ) {
      if ( oThis.isAlive() ) {
        reject( new Error( "Geth already running. Can not initialize it" ) );
      }

      let gethArgs        = oThis.gethArgs
        , gethSetupConfig = oThis.gethSetupConfig
        , rmArgsArray     = [ "-rf"
          , gethArgs["datadir"] + "/geth"
        ]
        , gethArgsArray   = [ 
          , "--datadir"
          , gethArgs["datadir"]
          , "init"
          , gethSetupConfig["poaGenesisAbsolutePath"]
        ]
      ;

      let gethProcess
        , gethExitCode
      ;


      // Clean up file.
      let removeFilesProcess = spawn("rm", rmArgsArray, {shell: true});
      removeFilesProcess.on("exit", function (code, signal) {

        // Now init geth.
        gethProcess = oThis.gethProcess = spawn("geth", gethArgsArray, oThis.gethSpawnOptions );
        gethExitCode = "STILL_RUNNING";
        gethProcess.on("exit", function (code, signal) {
          console.log("gethProcess has exitted!  code:", code, "signal", signal, "geth command:\n rm", gethArgsArray.join(" "), "\n");
          if ( !code ) {
            gethExitCode = "EXIT_WITHOUT_ERROR";
          } else {
            gethExitCode = "EXIT_WITH_ERROR_CODE_" + String ( code );
          }
        });

      });

      // Give some time to geth to start.
      setTimeout(function () {
        oThis.__initPromise = null;
        switch( gethExitCode ) {
          case "EXIT_WITHOUT_ERROR":
            resolve( true );
            break;
          case "STILL_RUNNING":
            reject( new Error("Failed to initialize geth. Timeout Error.") );
            break;
          default:
            reject( new Error("Failed to initialize geth. gethExitCode " + gethExitCode) );
            break;
        }
      }, init_time_buffer);

    });
    return oThis.__initPromise;
  }
};





module.exports = new GethManager();