"use strict";


const { spawn }         = require('child_process')
    , path              = require("path")
    , rootPrefix        = "../.."
    , start_time_buffer = 15000
    , stop_time_buffer  = 5000
    , init_time_buffer  = 20000
;

const gethArgs = {
  networkid         : "20171010"
  , datadir         : path.resolve(__dirname, rootPrefix + "/tests/scripts/st-poa")
  , port            : "30301"
  , maxpeers        : "0"
  , verbosity       : "3"
  
  // ACCOUNT OPTIONS
  , unlock          : null
  , password        : path.resolve(__dirname, rootPrefix + "/tests/scripts/pw" )
  
  // MINER OPTIONS
  , mine            : ""
  , minerthreads    : "4"
  , etherbase       : null
  , targetgaslimit  : "100000000"
  , gasprice        : "1"


  //RPC-CONFIG
  , rpc       : ""
  , rpcapi    : "eth,net,web3,personal,txpool"
  , rpcport   : "12546"
  , rpcaddr   : "127.0.0.1"


  //WS-CONFIG
  , ws        : ""
  , wsport    : "13546"
  , wsorigins : "*"
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
  // stdio : [ 'ignore', process.stdout, process.stderr ]
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
    if ( !oThis.gethProcess ) {
      console.log("[GETH-isAlive] oThis.gethProcess is null");
      return false;
    }
    console.log("[GETH-isAlive] oThis.gethProcess.killed", oThis.gethProcess.killed);
    return !oThis.gethProcess.killed;
  }

  , _startPromise : null
  , startWaitTime : 5000
  , gethSpawnOptions: null
  , start: function ( argKeysToIgnore ) {
    const oThis = this;


    oThis._startPromise = oThis._startPromise || new Promise( function ( resolve, reject) {
        if ( oThis.isAlive() ) {
          console.log("[GETH-START] gethProcess.pid =", oThis.gethProcess.pid, "Resolving the Start Promise");
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

          if ( !argValue ) {
            if ( argKey === "unlock" || argKey === "etherbase" ) {
              //Minner Address is missing.
              let addressInfo = oThis.getTransactionAddressInfo();
              argValue = addressInfo.minner || "0";              
            }
          }

          if ( argValue && argValue.length ) {
            //Push the value.
            gethArgsArray.push( argValue );
          }
        }

        console.log("\t [GETH-START] Starting geth with command :: \ngeth", gethArgsArray.join(" "), "\n");

        let gethProcess = oThis.gethProcess = spawn("geth", gethArgsArray, oThis.gethSpawnOptions );
        gethProcess.on("close", function (code, signal) {
          console.log("\t [GETH-START] gethProcess has exitted!   code:", code, "signal:", signal, "pid:", gethProcess.pid, "killed:", gethProcess.killed, "geth command:\n geth", gethArgsArray.join(" "), "\n");

          oThis.gethProcess = null;
        });


        // Give some time to geth to start.
        setTimeout( function () {

          if ( oThis.isAlive() ) {

            console.log("[GETH-START] gethProcess.pid =", oThis.gethProcess.pid, "Resolving the Start Promise");
            resolve( true );  
          } else {
            reject(new Error("Failed to start geth.") );
          }
          
          let gethProcessIdArray = [ "aux", "|", "grep", "'geth'", "|", "awk", "'{print $2,$11,$12}'" ];
          let gethProcessIdFinder = spawn("ps", gethProcessIdArray, {shell: true, stdio: [ 'ignore', process.stdout, process.stderr ] });
          
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

        let gethProcessIdArray = [ "aux", "|", "grep", "'geth'", "|", "awk", "'{print $2,$11,$12}'" ];
        console.log("\t [GETH-STOP] oThis.gethProcess.pid = ", oThis.gethProcess.pid);
        let gethProcessIdFinder = spawn("ps", gethProcessIdArray, {shell: true, stdio: [ 'ignore', process.stdout, process.stderr ] });

        oThis.gethProcess.kill("SIGINT");

        
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
      console.log("\t [GETH-SIGHANDLER] GethManager :: sigHandler triggered!. Stoping Geth Now.");
      oThis.stop();
    };

    process.on('SIGINT', sigHandler);
    process.on('SIGTERM', sigHandler);

  }
  , __sender            : null
  , __senderPassphrase  : null
  , __recipient         : null
  , __minner            : null
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
      , minner      : oThis.__minner
    };
  }
  , populateTransactionAddressInfo: function () {
    const oThis = this
        , gethSetupConfig         = oThis.gethSetupConfig
        , poaGenesisAbsolutePath  = gethSetupConfig.poaGenesisAbsolutePath
        , addresses     = ["__minner", "__sender", "__recipient"]
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


    addrLen++;
    while( addrLen-- && gKey ) {
      // Assign the last address.
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
          , gethArgs["datadir"] + "/geth/*"
        ]
        , gethArgsArray   = [ 
          "init"
          , "--datadir"
          , gethArgs["datadir"]
          , gethSetupConfig["poaGenesisAbsolutePath"]
        ]
      ;

      let gethProcess
        , gethExitCode
      ;


      // Clean up file.
      console.log("\t [Geth-Init] removing geth folder from datadir.");
      let removeFilesProcess = spawn("rm", rmArgsArray, {shell: true, stdio: [ 'ignore', process.stdout, process.stderr ] });
      removeFilesProcess.on("close", function (code, signal) {
        console.log("\t [Geth-Init] removed geth folder from datadir. code:", code, "signal:", signal);

        // Now init geth.
        gethProcess = oThis.gethProcess = spawn("geth", gethArgsArray, oThis.gethSpawnOptions );
        gethExitCode = "STILL_RUNNING";

        gethProcess.on("close", function (code, signal) {
          console.log("\t [Geth-Init] gethProcess has exitted!  code:", code, "signal", signal, "pid", gethProcess.pid, "killed", gethProcess.killed, "geth command:\n geth", gethArgsArray.join(" "), "\n");
          if ( !code ) {
            gethExitCode = "EXIT_WITHOUT_ERROR";
          } else {
            gethExitCode = "EXIT_WITH_ERROR_CODE_" + String ( code );
          }
          oThis.gethProcess = null;
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



    });
    return oThis.__initPromise;
  }
};





module.exports = new GethManager();