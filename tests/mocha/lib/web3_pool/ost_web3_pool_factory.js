"use strict";

// Load external packages
const Chai            = require('chai')
    , assert          = Chai.assert
    , rootPrefix      = "../../../.."
    , OSTBase         = require( rootPrefix + "/index" )
    , Logger          = OSTBase.Logger
    , OstWeb3Pool     = OSTBase.OstWeb3Pool
    , PoolFactory     = OstWeb3Pool.Factory
    
    , gethManager     = require( rootPrefix + "/tests/helpers/geth_manager")
    , logger          = new Logger( "OstWeb3TestCases", Logger.LOG_LEVELS.INFO )

    // Provider classes.
    , OstWSProvider     = OSTBase.OstWeb3.OstWSProvider
    
    // End-Points
    , wsEndPoint        = gethManager.getWebSocketEndPoint()

    , describePrefix    = "lib/web3_pool/ost_web3_pool_factory"
;




// Some Constants. All times are in milliseconds.
const avg_block_time              = 3000    /* Avg time required to mine a block */
    , no_of_conformation_blocks   = 4 + 6   /* We expect receipt of transactions to be received in these many blocks. */
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
  , receiptStatus             : "0x1"
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
      receipt = receipt || {};
      outValues.didResolveTxPromise = true;
      outValues.receiptStatus = receipt.status;
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
    , poolSize      = 2 * 1
    , willReconnectWeb3Instances  = {}
    , willDisconnectWeb3Instances = {}
;

const poolFactoryOptions = {
  poolSize: poolSize
  , ostWeb3Options: {
    providerOptions: {
      killOnReconnectFailure: false  
    }
    
  }
};

const startGethTestGroup = function () {
  describe(describePrefix + " :: Start Geth", function () {
    it("should start geth.", async function () { 
      this.timeout( max_time_for_geth_start );
      await gethManager
        .start()
        .then( function () {
          assert.isOk(true);
          executeNextTestGroup();
        })
        .catch( function ( reason ) {
          console.log("Failed to start geth. reason",  reason);
          assert.isOk(false, "Failed to start geth.");
        })
      ;
    });
  });
};


const createAndValidateWeb3Instances = function () {

  
  describe(describePrefix + " :: create and validate web3 Instances.", function () {
    let allInstances = []
      , len = poolSize
      , web3
      , instanceName
    ;

    while( len-- ) {
      web3 = PoolFactory.getWeb3(wsEndPoint, null, poolFactoryOptions);
      instanceName = "web3_" + len;
      allInstances.push( web3 );
      if ( len % 2 ) {
        instanceName = "will_reconnect_" + instanceName;
        willReconnectWeb3Instances[ instanceName ] = web3;
      } else {
        instanceName = "will_disconnect_" + instanceName;
        willDisconnectWeb3Instances[ instanceName ] = web3;
        web3.currentProvider.options.maxReconnectTries = 1;
        console.log("web3.currentProvider", web3.currentProvider);

      }

      web3Instances[ instanceName ] = web3;
    }

    it("should create " + poolSize + " unique instances of web3", function () {
      let validInstanceCnt   = 0
        , filteredInstances
        , web3
      ;

      for( instanceName in web3Instances ) {
        if ( !( web3Instances.hasOwnProperty(instanceName) ) ) {
          continue;
        }

        web3 = web3Instances[ instanceName ];
        filteredInstances = allInstances.filter( function ( cWeb3 ) {
          return cWeb3 === web3;
        })

        assert.equal( filteredInstances.length, 1, "web3 instance with name " + instanceName + " is duplicate/missing.");

        validInstanceCnt ++;

      }
      
      assert.equal( validInstanceCnt, poolSize, "valid Instance Count is not same as poolSize");
      
    });


  });
  setTimeout( executeNextTestGroup, 10);
};

const sendTransactionTestGroup = function () { 
  describe(describePrefix + " :: perform sendTransaction using all web3 instances.", function () {
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


const stopGethTestGroup = function () {
  describe(describePrefix + " :: Stop Geth", function () {
    it("should stop geth.", async function () { 
      this.timeout( max_time_for_geth_stop );
      await gethManager
        .stop()
        .then( function () {
          assert.isOk(true);
          executeNextTestGroup();
        })
        .catch( function () {
          assert.isOk(false, "Failed to stop geth.");
        })
      ;
    });
  });
};

const activeWeb3InstancesCheck = function () { 
  describe(describePrefix + " :: Pool should not return web3 with broken connections", function () { 
    let allInstances = []
      , len = poolSize
      , web3
      , instanceName
    ;

    while( len-- ) {
      web3 = PoolFactory.getWeb3(wsEndPoint, null, poolFactoryOptions);
      allInstances.push( web3 );
    }

    it("should return " + poolSize + " active web3 instances.", function ( done ) {
      let validInstanceCnt   = 0
        , filteredInstances
        , web3
      ;

      for( instanceName in willDisconnectWeb3Instances ) {
        if ( !( willDisconnectWeb3Instances.hasOwnProperty(instanceName) ) ) {
          continue;
        }

        web3 = willDisconnectWeb3Instances[ instanceName ];
        filteredInstances = allInstances.filter( function ( cWeb3 ) {
          return cWeb3 === web3;
        })

        assert.equal( filteredInstances.length, 0, "web3 instance with name " + instanceName + " shouldn't have been returned from pool.");

        logger.log("Declaring " + instanceName + " as dead.");
        delete web3Instances[ instanceName ];
      }
      setTimeout( executeNextTestGroup, 10);
      setTimeout(done, 200);
    });
  });
  
}

// Chain the testGroups.

testGroups.push( startGethTestGroup );
testGroups.push( createAndValidateWeb3Instances );
testGroups.push( sendTransactionTestGroup );
testGroups.push( stopGethTestGroup );
testGroups.push( startGethTestGroup );
testGroups.push( activeWeb3InstancesCheck );
testGroups.push( sendTransactionTestGroup );
testGroups.push( stopGethTestGroup );
testGroups.push( function () {
  setTimeout( function () {
    process.exit(0);  
  }, 2000);
});


const executeNextTestGroup = function () {
  if ( testGroups.length ) {
    let testGroup = testGroups.shift();
    testGroup();
  }
};

executeNextTestGroup();
