"use strict";

const Web3            = require("web3")
    , path            = require("path")
    , fs              = require("fs")
    , { spawn }       = require('child_process')
    , rootPrefix      = "../.."
    , gethManager     = require( rootPrefix + "/tests/helpers/geth_manager")
    
;


let gethSetupConfig     = gethManager.getGethSetupConfig()
  , httpEndPoint        = gethManager.getHttpEndPoint()  
  , datadir             = gethSetupConfig["datadir"] || path.resolve(__dirname, (rootPrefix + "/tests/scripts/st-poa") )
  , poaGenesisOutPath   = gethSetupConfig["poaGenesisAbsolutePath"] || path.resolve(__dirname, (rootPrefix + "/tests/scripts/poa-genesis.json") )
  , gethIgnoreArgs      = gethSetupConfig["preInitArgsToIgnore"]    || ["etherbase", "unlock", "password", "mine", "minerthreads"]
  , newKeyPassphrase    = gethSetupConfig["passphrase"] || "testtest"
  , passphraseFilePath  = gethSetupConfig["passphraseFilePath"] ||  path.resolve(__dirname, (rootPrefix + "/tests/scripts/pw") )
  , noOfNewAddresses    = gethSetupConfig["noOfAddresses"]
;

let poaGenesisTemplatePath  = rootPrefix + "/tests/scripts/poa-genesis-template.json"
  , poaGenesis              = require( poaGenesisTemplatePath )
  , web3                    = new Web3( httpEndPoint )
;


let hasErrors = false;

// This is the main function. 
( function ( noOfAddresses ) {
  

  // Make Sure we get geth logs.
  gethManager.gethSpawnOptions.stdio = [ 'ignore', process.stdout, process.stderr ];

  const flowPromise = new Promise( function ( resolve, reject ) {
    console.log("[GETH-SETUP] 0. Creating datadir if needed. datadir:", datadir);
    // Create datadir.
    if ( !fs.existsSync( datadir ) ) { 
      fs.mkdir( datadir, function ( err ) {
        if ( err ) {
          reject( err )
        } else {
          resolve( datadir );  
        }
      });
    } else {
      // Make sure to clean the directory.
      let rmArgs = ["-rf", datadir];
      let rmProcess = spawn("rm", rmArgs, {shell: true});
      rmProcess.on("exit", function (code, signal) {
        if ( !code ) {
          setTimeout(function () {
            resolve( datadir );
          }, 0);
        } else {
          let err = new Error("Could not clean datadir directory. rm exit code: " + code + ". command: rm " + rmArgs.join(" ") );
          setTimeout(function () {
            reject( err )
          }, 0);
        }
      });
    }
  })
  .then( function ( datadir ) { 
    // Now Start Geth.
    console.log("[GETH-SETUP] 1. Datadir created. Path:", datadir, " Starting GETH NOW.");
    return gethManager.start( gethIgnoreArgs )
  })
  .then( function () {

    // Now Create Addresses.
    console.log("[GETH-SETUP] 2. GETH Started. Creating", noOfAddresses, "Addresses.");
    return createAddresses( noOfAddresses );

  })
  .then( function () {

    // Now Create poa-genesis.json
    console.log("[GETH-SETUP] 3.", noOfAddresses, "new addresses created. Creating poa-genesis.json");

    return new Promise( function (resolve, reject) {
      let poaJson = JSON.stringify(poaGenesis, null, 2);

      fs.writeFile(poaGenesisOutPath, poaJson, function ( err ) {
        if ( err ) {
          reject( err );
        } else {
          resolve( poaGenesisOutPath );
        }
      });// End of fs callback.

    }); // End of Promise.

  })
  .then( function ( poaGenesisOutPath ) {

    // Now Create Password file
    console.log("[GETH-SETUP] 4. poa-genesis created. Path:", poaGenesisOutPath, "Creating password file.");

    return new Promise( function (resolve, reject) {
      fs.writeFile(passphraseFilePath, newKeyPassphrase, function ( err ) {
        if ( err ) {
          reject( err );
        } else {
          resolve( passphraseFilePath );
        }
      });// End of fs callback.

    }); // End of Promise.

  })
  .then( function ( passwordFilePath ) { 
    console.log("[GETH-SETUP] 5. Password file for new accounts created. Path:", passwordFilePath );
  })
  .catch( function ( reason ) {
    // Make Sure to catch all Exceptions.
    console.log("[SOMETHING_WENT_WRONG] reason", reason);
    hasErrors = true;
  })
  .then( function () {
    // Stop Geth.
    console.log("[GETH-SETUP] 5. Stopping GETH");
    return gethManager.stop();      
  })
  .then( function () {
    console.log("[GETH-SETUP] 6. GETH Stopped.");
    if ( hasErrors ) {
      console.log("[GETH-SETUP] Can not proceed further. As error has been encountered during setup.");
      process.exit( 1 );
    }

    // Init Geth.
    console.log("[GETH-SETUP] 7. Bootstrap and initialize a new genesis block.");
    return gethManager.initGeth();
  })
  .then( function ( datadir ) { 
    // Now Start Geth.
    console.log("[GETH-SETUP] 8. New genesis block Bootstraped and initialized. Starting GETH to verify config.");
    return gethManager.start();
  })
  .catch( function ( reason ) {
    // Make Sure to catch all Exceptions.
    console.log("[SOMETHING_WENT_WRONG] reason", reason);
    hasErrors = true;
  })
  .then( function () {
    // Stop Geth.
    console.log("[GETH-SETUP] 9. Stopping GETH");
    return gethManager.stop();
  })
  .then( function () {
    console.log("[GETH-SETUP] 10. GETH Stopped.");
    if ( hasErrors ) {
      console.log("An error has been encountered during setup.");
      process.exit( 1 );
    }
    console.log("[GETH-SETUP] ------------ GETH SETUP COMPLETED SUCCESSFULLY! ------------ ");
    process.exit( 0 );
  })




})( noOfNewAddresses );

const createAddresses = function ( noOfAddresses ) {
  let addresses           = []
    , len                 = noOfAddresses
    , currentPromise
    , promiseChain
    , promiseChainResolver
  ;

  promiseChain = new Promise( function ( resolve, reject ) {
    setTimeout(resolve, 100);
  });

  while( len-- ) {
    promiseChain = promiseChain
      .then( function () {
        console.log("\t Generating new Address.");
        return web3.eth.personal.newAccount( newKeyPassphrase )
      })
      .then( function ( newAddress ) {
        console.log("\t -- New Address", newAddress, "generated. Updating poa-genesis alloc block.");
        let genesisAlloc = poaGenesis.alloc = poaGenesis.alloc || {};
        genesisAlloc[ newAddress ] = {
          "balance": web3.utils.toHex( web3.utils.toWei( "99999" ) )
        };
        return newAddress;
      })
    ;
  }

  return promiseChain;
};