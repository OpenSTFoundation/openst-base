"use strict";

// Load external packages
const Chai            = require('chai')
    , assert          = Chai.assert
    , rootPrefix      = "../../../.."
    , OSTBase         = require( rootPrefix + "/index" )
    , OstWeb3         = OSTBase.OstWeb3
    , Logger          = OSTBase.Logger
    , OstWeb3Pool     = OSTBase.OstWeb3Pool
    , PoolFactory     = OstWeb3Pool.Factory
    
    , gethManager     = require( rootPrefix + "/tests/helpers/geth_manager")
    , logger          = new Logger( "Web3PoolTestCases", Logger.LOG_LEVELS.INFO )

    // Provider classes.
    , OstWSProvider     = OSTBase.OstWeb3.OstWSProvider
    
    // End-Points
    , wsEndPoint        = gethManager.getWebSocketEndPoint()

    , describePrefix    = "lib/web3_pool/ost_web3_pool_factory"
;




// Some Constants. All times are in milliseconds.
const avg_block_time              = 5000    /* Avg time required to mine a block */
    , no_of_conformation_blocks   = 4 + 6   /* We expect receipt of transactions to be received in these many blocks. */
    , buffer_time_per_describe    = 5000
    , max_time_per_transaction    = (avg_block_time * no_of_conformation_blocks) + buffer_time_per_describe
    , max_time_for_geth_start     = 20000 /* Time Required for geth to start */
    , max_time_for_geth_stop      = 10000 /* Time Required for geth to stop  */
    , max_time_other              = 1000
    , amt_to_transfer_in_eth      = "0.01"
; 

// This is the main function. Let it execute once all methods are defined.
const mainFn = function () { 
  // add all test cases.
  let testGroups = [];
  testGroups.push( startGethTestGroup );
  testGroups.push( createAndValidateWeb3Instances );
  testGroups.push( sendTransactionTestGroup );
  testGroups.push( stopGethTestGroup );
  testGroups.push( removeDisconnectedInstances );
  testGroups.push( startGethTestGroup );
  testGroups.push( activeWeb3InstancesCheck );
  testGroups.push( sendTransactionTestGroup );
  testGroups.push( stopGethTestGroup );

  describe(describePrefix, function () {
    let testCases
      , len       
      , cnt
      , testCase
    ;

    while( testGroups.length ) {
      testCases = testGroups.shift()();
    }

    // Finally - Have a nice day.
    it("will say have a nice day", function () {
      logger.win("Have a nice day! The process will exit in 1 second.");
      assert.isOk( true );
      setTimeout( function () {
        process.exit(0);
      }, 1000);
    })
  });
};

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
  result = result || {};
  let eKey;
  for( eKey in expectedOutValues ) {
    if ( !expectedOutValues.hasOwnProperty( eKey ) ) {
      continue;
    }

    assert.isTrue( result.hasOwnProperty( eKey ), "result is missing " + eKey + " property" );
    assert.equal( result[eKey], expectedOutValues[ eKey ], "result does not match expected output. Property : " + eKey);
  }

  assert.isOk( result.callbackHash, "callbackHash is not ok.");
  assert.equal( result.callbackHash, result.transactionHashEventValue, "callbackHash does not match transactionHashEventValue");
  assert.equal( result.receiptEventHash, result.transactionHashEventValue, "receiptEventHash does not match transactionHashEventValue");
  assert.equal( result.confirmationEventHash, result.transactionHashEventValue, "confirmationEventHash does not match transactionHashEventValue");


  return true;
};

// Web3 Instances. Make sure to define keys before hand in web3Instances.
// poolSize should be in multiples of 2.
let testGroups = []
    , web3Instances = {}
    , poolSize      = 2 * 2
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


const createAndValidateWeb3Instances = function () {
  
  let len = poolSize
    , instanceName
  ;

  // Populate web3Instances, willReconnectWeb3Instances & willDisconnectWeb3Instances.
  while( len-- ) { 
    instanceName = "web3_" + len;
    if ( len % 2 ) { 
      instanceName = "will_reconnect_" + instanceName;
      willReconnectWeb3Instances[ instanceName ] = null;
    } else {
      instanceName = "will_disconnect_" + instanceName;
      willDisconnectWeb3Instances[ instanceName ] = null;
    }
    web3Instances[ instanceName ] = null;
  }



  it("should create " + poolSize + " unique instances of web3", function () { 
    this.timeout( max_time_other * poolSize );
    let allInstances = []
      , len = poolSize
      , web3
      , instanceName
      , uniqueCnt
    ;

    uniqueCnt = 0;
    while( len-- ) { 
      // Get an instance from pool.
      web3 = PoolFactory.getWeb3(wsEndPoint, null, poolFactoryOptions);

      // Make sure it is not duplicate.
      if ( allInstances.indexOf( web3 ) < 0 ) {
        uniqueCnt++;  
      }
      allInstances.push( web3 );

      // Determine the name.
      instanceName = "web3_" + len;
      if ( len % 2 ) { 
        instanceName = "will_reconnect_" + instanceName;
        // Make sure we are expecting this instance.
        if ( willReconnectWeb3Instances.hasOwnProperty( instanceName ) ) {
          willReconnectWeb3Instances[ instanceName ] = web3;
        }
      } else {
        instanceName = "will_disconnect_" + instanceName;
        // Make sure we are expecting this instance.
        if ( willDisconnectWeb3Instances.hasOwnProperty( instanceName ) ) {
          willDisconnectWeb3Instances[ instanceName ] = web3;
          web3.currentProvider.options.maxReconnectTries = 1;
        }
      }

      web3Instances[ instanceName ] = web3;
    }
    assert.strictEqual(uniqueCnt, poolSize, "PoolFactory returned " + uniqueCnt + " unique instances. poolSize = " + poolSize );
  });

  let instanceHolders = [
      { name: "web3Instances", holder: web3Instances }
      , { name: "willReconnectWeb3Instances", holder: willReconnectWeb3Instances }
      , { name: "willDisconnectWeb3Instances", holder: willDisconnectWeb3Instances }
    ]
    , holderData
    , holder
    , holderName
    , validator
  ;

  while( instanceHolders.length ) {
    holderData  = instanceHolders.shift();
    holder      = holderData.holder;
    holderName  = holderData.name;

    // Create a clouser for holder.
    validator = ( function ( holder, holderName ) {

      return function () {
        this.timeout( max_time_other );

        let web3
          , instanceName
        ;

        for( instanceName in holder ) {
          if ( !( holder.hasOwnProperty( instanceName ) ) ) {
            continue;
          }
          web3 = holder[ instanceName ];
          assert.instanceOf( web3, OstWeb3, "web3 with name " + instanceName + " is not an instance of OstWeb3. holder: " + holderName );
        }
      };

    })( holder, holderName );

    it(holderName + " should contain only instances of OstWeb3", validator);
  }
};

const removeDisconnectedInstances = function () {
  let validator = function () {
    this.timeout( max_time_other );

      let web3
        , holder = willDisconnectWeb3Instances
        , instanceName
      ;

      for( instanceName in holder ) {
        if ( !( holder.hasOwnProperty( instanceName ) ) ) {
          continue;
        }
        web3 = web3Instances[ instanceName ];
        assert.isTrue( web3Instances.hasOwnProperty( instanceName ), "web3Instances does not have instance with name " + instanceName );
        delete web3Instances[ instanceName ];
        assert.isFalse( web3Instances.hasOwnProperty( instanceName ), "web3Instances should not have instance with name " + instanceName );
      }
  };
  it("should remove disconnected instances from web3Instances", validator);
};

const activeWeb3InstancesCheck = function () {

  let activePoolSize = poolSize / 2;

  it("should re-use " + activePoolSize + " unique instance(s) of web3", function () { 
    this.timeout( max_time_other * activePoolSize );
    let allInstances = []
      , len = poolSize
      , web3
      , instanceName
      , uniqueCnt
    ;

    uniqueCnt = 0;
    while( len-- ) { 
      // Get an instance from pool.
      web3 = PoolFactory.getWeb3(wsEndPoint, null, poolFactoryOptions);

      // Make sure it is not duplicate.
      if ( allInstances.indexOf( web3 ) < 0 ) {
        uniqueCnt++;  
      }
      allInstances.push( web3 );
    }

    assert.strictEqual(uniqueCnt, activePoolSize, "PoolFactory returned " + uniqueCnt + " unique instances. Expected activePoolSize = " + activePoolSize );
  });
};

const startGethTestGroup = function () {
  let validator = function () { 
    this.timeout( max_time_for_geth_start );
    logger.step("Start Geth TestGroup");
    return gethManager
      .start()
      .then( function () {
        logger.info("Geth started successfully.");
        assert.isOk(true);
      })
      .catch( function ( reason ) {
        logger.error("Failed to start geth. reason", reason);
        assert.isOk(false, "Failed to start geth.");
      })
    ;
  };

  it("should start geth.", validator);
};

const sendTransactionTestGroup = function () { 
  
  let web3OutValues = {}
    , web3Key
    , validator
  ;

  // Initiate Transactions.
  validator = function () {
    this.timeout( max_time_per_transaction );
    let web3Key;
    for( web3Key in web3Instances ) {
      if ( !web3Instances.hasOwnProperty( web3Key ) ) {
        continue;
      }

      // Create a closure for web3Key and call sendTransactionWith.
      ( function ( web3Key ) {
        let currWeb3 = web3Instances[ web3Key ];
        logger.info("Testing sendTransaction with", web3Key);
        sendTransactionWith( currWeb3 )
          .then( function ( outValues ) {
            web3OutValues[ web3Key ] = outValues;
          })
        ;
      })( web3Key );

    } // End of for loop.
    assert.isOk( true );
  };
  it("should initiate send transaction flows for all instances of web3.", validator);
  
  // Verify Transaction results.
  let validateAfter = max_time_per_transaction + 2000;
  for( web3Key in web3Instances ) {
    if ( !web3Instances.hasOwnProperty( web3Key ) ) {
      continue;
    }

    validator = (function ( web3Key, validateAfter ) { 

      return function () {
        this.timeout( validateAfter + 1000 );

        if ( !web3Instances[ web3Key ] ) {
          logger.info("Validation of web3 Instance", web3Key, "has been skipped.");
          assert.isOk( true );
          return;
        }

        return new Promise( function ( resolve, reject ) {
          setTimeout( function () {
            resolve( web3OutValues[ web3Key ] )
          }, validateAfter);
        })
        .then( function ( outValues ) {
          verifyResult( outValues, web3Key );
        })        
      };

    })( web3Key, validateAfter );
    it("should validate send transaction outputs with " + web3Key + ". timeout for this test case set to " + validateAfter, validator);
    validateAfter = 1000;
  }
};

const stopGethTestGroup = function () {
  let validator = function () { 
    this.timeout( max_time_for_geth_stop );
    return gethManager
      .stop()
      .then( function () {
        assert.isOk(true);
      })
      .catch( function () {
        assert.isOk(false, "Failed to stop geth.");
      })
    ;
  };

  it("should stop geth.", validator);
};

// Start the test.
mainFn();
