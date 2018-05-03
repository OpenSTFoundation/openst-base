"use strict";

// Load external packages
const Chai            = require('chai')
    , assert          = Chai.assert
    , rootPrefix      = "../../../.."
    , OSTBase         = require( rootPrefix + "/index" )
    , Logger          = OSTBase.Logger
    , Web3            = OSTBase.Web3
    , OstWeb3         = OSTBase.OstWeb3
    
    , gethManager     = require( rootPrefix + "/tests/helpers/geth_manager")
    , logger          = new Logger( "OstWeb3TestCases", Logger.LOG_LEVELS.INFO )

    // Provider classes.
    , HttpProvider      = require("web3-providers-http")
    , WebsocketProvider = require("web3-providers-ws")
    , OstWSProvider     = OSTBase.OstWeb3.OstWSProvider
    
    // End-Points
    , httpEndPoint      = gethManager.getHttpEndPoint()
    , wsEndPoint        = gethManager.getWebSocketEndPoint()

;




// Some Constants. All times are in milliseconds.
const avg_block_time              = 3000  /* Avg time required to mine a block */
    , no_of_conformation_blocks   = 15    /* We expect receipt of transactions to be received in these many blocks. */
    , buffer_time_per_describe    = 5000
    , max_time_per_transaction    = (avg_block_time * no_of_conformation_blocks) + buffer_time_per_describe
    , max_time_for_geth_start     = 20000 /* Time Required for geth to start */
    , max_time_for_geth_stop      = 20000 /* Time Required for geth to stop  */
; 

const amt_to_transfer_in_eth = "0.01";
let basic_transaction_info = null;

const expectedOutValues = {
  didUnlock                   : true
  , callbackTriggered         : true
  , callbackError             : null
  , transactionHashEvent      : true
  , receiptEvent              : true
  , confirmationEvent         : true
  , confirmationEventNumber   : 6
  , errorEvent                : false
  , didResolveTxPromise       : true
};

// Test-Case Builder.
const sendTransactionWith = function ( web3 ) {
  basic_transaction_info = basic_transaction_info || gethManager.getTransactionAddressInfo();

  let outValues = {
      didUnlock                   : false

      , callbackTriggered         : false
      , callbackError             : null
      , callbackHash              : null

      , transactionHashEvent      : false
      , transactionHashEventValue : null

      , receiptEvent              : false
      , receiptEventHash          : null

      , confirmationEvent         : false
      , confirmationEventNumber   : -1
      , confirmationEventHash     : null

      , errorEvent                : false

      , didResolveTxPromise       : false
    }
    , sender      = basic_transaction_info.sender
    , passphrase  = basic_transaction_info.passphrase
    , txParams    = {
        from: sender
        , to: basic_transaction_info.recipient
        , value : web3.utils.toWei( amt_to_transfer_in_eth )
    }
  ;

  logger.info("txParams", txParams);

  let executionPromise = web3.eth.personal.unlockAccount( sender, passphrase )
    .then( function () {
      outValues.didUnlock = true;
      return web3.eth.sendTransaction( txParams , function (error, hash) {
          outValues.callbackTriggered = true;
          outValues.callbackError = error;
          outValues.callbackHash = hash;
        })
        .on("transactionHash", function ( hash ) {
          outValues.transactionHashEvent      = true;
          outValues.transactionHashEventValue = hash;
        })
        .on("receipt", function ( receipt ) {
          receipt = receipt || {};
          outValues.receiptEvent = true;
          outValues.receiptEventHash = receipt.transactionHash;
          logger.info("receipt", receipt);
        })
        .on("confirmation", function (confirmationNumber, receipt) {
          if ( confirmationNumber != expectedOutValues.confirmationEventNumber ) {
            // Ignore this event.
            return;
          }
          receipt = receipt || {};
          outValues.confirmationEvent       = true;
          outValues.confirmationEventNumber = confirmationNumber;
          outValues.confirmationEventHash   = receipt.transactionHash;
        })
        .on("error", function ( error ) {
          outValues.errorEvent = true;
        })
    })
    .then( function ( receipt ) {
      outValues.didResolveTxPromise = true;
      return outValues;
    })

  return executionPromise
    .catch( function ( reason ) {
      //Catch any exception and let the flow continue.
      logger.error("executionPromise failed with reason:", reason);
      return outValues;
    })
    .then( function (i_d_k) {
      return outValues;
    })
  ;
};

const verifyResult = function ( result ) {
  let eKey;
  for( eKey in expectedOutValues ) {
    if ( !expectedOutValues.hasOwnProperty( eKey ) ) {
      continue;
    }

    assert.isTrue( result.hasOwnProperty( eKey ), "result is missing " + eKey + " property" );
    assert.equal( result[eKey], expectedOutValues[ eKey ], "result does not match expected output. Property :", eKey);
  }

  assert.isOk( result.callbackHash, "callbackHash is not ok.");
  assert.equal( result.callbackHash, result.transactionHashEventValue, "callbackHash does not match transactionHashEventValue");
  assert.equal( result.receiptEventHash, result.transactionHashEventValue, "receiptEventHash does not match transactionHashEventValue");
  assert.equal( result.confirmationEventHash, result.transactionHashEventValue, "confirmationEventHash does not match transactionHashEventValue");


  return true;
};

// Web3 Instances
let testGroups = []
    , web3Instances = {}
    , ostWeb3WithHttp
    , ostWeb3WithWS
    , web3WithHttp
    , web3WithWS

;

const startGethTestGroup = function () {
  describe("lib/ost_web3/ost-web3 :: Start Geth", function () {
    it("should start geth.", async function () { 
      this.timeout( max_time_for_geth_start );
      await gethManager
        .start()
        .then( function () {
          assert.isOk(true);
          executeNextTestGroup();
        })
        .catch( function () {
          assert.isOk(false, "Failed to start geth.");
        })
      ;
    });
  });
};

const createAndValidateWeb3Instances = function () {
  describe("lib/ost_web3/ost-web3 :: create and validate web3 Instances.", function () {
    web3Instances.web3WithHttp    = web3WithHttp    = new Web3( httpEndPoint );
    web3Instances.ostWeb3WithHttp = ostWeb3WithHttp = new OstWeb3( httpEndPoint );
    web3Instances.web3WithWS      = web3WithWS      = new Web3( wsEndPoint );
    web3Instances.ostWeb3WithWS   = ostWeb3WithWS   = new OstWeb3( wsEndPoint );

    it("web3WithHttp.currentProvider should be an instance of HttpProvider", function () {
      assert.instanceOf( web3WithHttp.currentProvider, HttpProvider, "web3WithHttp has incorrect provider set");    
    });
    it("ostWeb3WithHttp.currentProvider should be an instance of HttpProvider", function () {
      assert.instanceOf( ostWeb3WithHttp.currentProvider, HttpProvider, "ostWeb3WithHttp has incorrect provider set");    
    });
    it("web3WithWS.currentProvider should be an instance of WebsocketProvider", function () {
      assert.instanceOf( web3WithWS.currentProvider, WebsocketProvider, "web3WithWS has incorrect provider set");  
    });
    it("ostWeb3WithWS.currentProvider should be an instance of OstWSProvider", function () {
      assert.instanceOf( ostWeb3WithWS.currentProvider, OstWSProvider, "ostWeb3WithWS has incorrect provider set");    
    });
  });
  setTimeout( executeNextTestGroup, 10);
};

const sendTransactionTestGroup = function () { 
  describe("lib/ost_web3/ost-web3 :: perform sendTransaction using all web3 instances.", function () {
    let web3OutValues = {}
      , web3Key
      , currWeb3
    ;

    // Initiate Transactions.
    for( web3Key in web3Instances ) {
      if ( !web3Instances.hasOwnProperty( web3Key ) ) {
        continue;
      }

      (function ( web3Key ) {
        currWeb3 = web3Instances[ web3Key ];
        sendTransactionWith( currWeb3 )
          .then( function ( outValues ) {
            web3OutValues[ web3Key ] = outValues;
          })
      })( web3Key );
    }

    let validateAfter = max_time_per_transaction
      , Validator
      , callNextTestGroup = true
    ;
    for( web3Key in web3Instances ) { 

      currWeb3 = web3Instances[ web3Key ];
      Validator = ( function ( web3Key, validateAfter ) {
        
        return function ( done ) {
          this.timeout( validateAfter + 1000 );
          setTimeout( function () {
            verifyResult( web3OutValues[ web3Key ], web3Key );
            if ( callNextTestGroup ) {
              executeNextTestGroup();
              callNextTestGroup = false;
            }
            done();
          }, validateAfter);
        };

      })( web3Key, validateAfter );

      it("should complete send transaction flow with " + web3Key + ". validateAfter = " + validateAfter, Validator);
      validateAfter = 0;
    }
  });
};


const disconnectAndReconnect = function () {
  describe("lib/ost_web3/ost-web3 :: Stop Geth", function () {
    it("should stop geth.", async function () { 
      this.timeout( max_time_for_geth_stop );
      await gethManager
        .stop()
        .then( function () {
          assert.isOk(true);
          logger.info("Removing web3WithWS from web3Instances as it will not re-connect.");
          delete web3Instances.web3WithWS;
          executeNextTestGroup();
        })
        .catch( function () {
          assert.isOk(false, "Failed to stop geth.");
        })
      ;
    });
  });
};



// Chain the testGroups.

testGroups.push( startGethTestGroup );
testGroups.push( createAndValidateWeb3Instances );
testGroups.push( sendTransactionTestGroup );
testGroups.push( disconnectAndReconnect );
testGroups.push( startGethTestGroup );
testGroups.push( sendTransactionTestGroup );

const executeNextTestGroup = function () {
  if ( testGroups.length ) {
    let testGroup = testGroups.shift();
    testGroup();
  }
};

executeNextTestGroup();







