'use strict';

// Load external packages
const Chai = require('chai'),
  assert = Chai.assert,
  rootPrefix = '../../../..',
  OSTBase = require(rootPrefix + '/index'),
  Logger = OSTBase.Logger,
  Web3 = OSTBase.Web3,
  OstWeb3 = OSTBase.OstWeb3,
  gethManager = require(rootPrefix + '/tests/helpers/geth_manager'),
  logger = new Logger('OstWeb3TestCases', Logger.LOG_LEVELS.INFO),
  // Provider classes.
  HttpProvider = require('web3-providers-http'),
  WebsocketProvider = require('web3-providers-ws'),
  OstWSProvider = OSTBase.OstWeb3.OstWSProvider,
  // End-Points
  httpEndPoint = gethManager.getHttpEndPoint(),
  wsEndPoint = gethManager.getWebSocketEndPoint(),
  describePrefix = 'lib/ost_web3/ost-web3';

// Some Constants. All times are in milliseconds.
const avg_block_time = 8000 /* Avg time required to mine a block */,
  confirmation_event_number = 6,
  no_of_conformation_blocks =
    4 + confirmation_event_number /* We expect receipt of transactions to be received in these many blocks. */,
  buffer_time_per_describe = 5000,
  max_time_per_transaction = avg_block_time * no_of_conformation_blocks + buffer_time_per_describe,
  max_time_for_geth_start = 20000 /* Time Required for geth to start */,
  max_time_for_geth_stop = 10000 /* Time Required for geth to stop  */,
  amt_to_transfer_in_eth = '0.01';

// This is the main function. Let it execute once all methods are defined.
const mainFn = function() {
  // add all test cases.
  let testGroups = [];
  testGroups.push(startGethTestGroup);
  testGroups.push(createAndValidateWeb3Instances);
  testGroups.push(sendTransactionTestGroup);
  testGroups.push(stopGethTestGroup);
  testGroups.push(startGethTestGroup);
  testGroups.push(sendTransactionTestGroup);
  testGroups.push(stopGethTestGroup);

  describe(describePrefix, function() {
    let testCases, len, cnt, testCase;

    while (testGroups.length) {
      testCases = testGroups.shift()();
    }

    // Finally - Have a nice day.
    it('will say have a nice day', function() {
      logger.win('Have a nice day! The process will exit in 1 second.');
      assert.isOk(true);
      setTimeout(function() {
        process.exit(0);
      }, 1000);
    });
  });
};

let basic_transaction_info = null;

const expectedOutValues = {
  didUnlock: true,
  callbackTriggered: true,
  callbackError: null,
  transactionHashEvent: true,
  receiptEvent: true,
  confirmationEvent: true,
  confirmationEventNumber: confirmation_event_number,
  errorEvent: false,
  didResolveTxPromise: true,
  receiptStatus: true
};

// Test-Case Builder.
const sendTransactionWith = function(web3) {
  basic_transaction_info = basic_transaction_info || gethManager.getTransactionAddressInfo();

  let outValues = {
      didUnlock: false,

      callbackTriggered: false,
      callbackError: null,
      callbackHash: null,

      transactionHashEvent: false,
      transactionHashEventValue: null,

      receiptEvent: false,
      receiptEventHash: null,

      confirmationEvent: false,
      confirmationEventNumber: -1,
      confirmationEventHash: null,

      errorEvent: false,

      didResolveTxPromise: false
    },
    sender = basic_transaction_info.sender,
    passphrase = basic_transaction_info.passphrase,
    txParams = {
      from: sender,
      to: basic_transaction_info.recipient,
      value: web3.utils.toWei(amt_to_transfer_in_eth),
      gas: '50000'
    };

  let executionPromise = web3.eth.personal
    .unlockAccount(sender, passphrase)
    .then(function() {
      outValues.didUnlock = true;
      return web3.eth
        .sendTransaction(txParams, function(error, hash) {
          outValues.callbackTriggered = true;
          outValues.callbackError = error;
          outValues.callbackHash = hash;
        })
        .on('transactionHash', function(hash) {
          outValues.transactionHashEvent = true;
          outValues.transactionHashEventValue = hash;
        })
        .on('receipt', function(receipt) {
          receipt = receipt || {};
          outValues.receiptEvent = true;
          outValues.receiptEventHash = receipt.transactionHash;
          logger.info('receipt', receipt);
        })
        .on('confirmation', function(confirmationNumber, receipt) {
          if (confirmationNumber != expectedOutValues.confirmationEventNumber) {
            // Ignore this event.
            return;
          }
          receipt = receipt || {};
          outValues.confirmationEvent = true;
          outValues.confirmationEventNumber = confirmationNumber;
          outValues.confirmationEventHash = receipt.transactionHash;
        })
        .on('error', function(error) {
          outValues.errorEvent = true;
        });
    })
    .then(function(receipt) {
      receipt = receipt || {};
      outValues.didResolveTxPromise = true;
      outValues.receiptStatus = receipt.status;
      return outValues;
    });

  return executionPromise
    .catch(function(reason) {
      //Catch any exception and let the flow continue.
      logger.error('executionPromise failed with reason:', reason);
      return outValues;
    })
    .then(function(i_d_k) {
      return outValues;
    });
};

const verifyResult = function(result) {
  result = result || {};
  let eKey;
  for (eKey in expectedOutValues) {
    if (!expectedOutValues.hasOwnProperty(eKey)) {
      continue;
    }

    assert.isTrue(result.hasOwnProperty(eKey), 'result is missing ' + eKey + ' property');
    assert.equal(result[eKey], expectedOutValues[eKey], 'result does not match expected output. Property : ' + eKey);
  }

  assert.isOk(result.callbackHash, 'callbackHash is not ok.');
  assert.equal(
    result.callbackHash,
    result.transactionHashEventValue,
    'callbackHash does not match transactionHashEventValue'
  );
  assert.equal(
    result.receiptEventHash,
    result.transactionHashEventValue,
    'receiptEventHash does not match transactionHashEventValue'
  );
  assert.equal(
    result.confirmationEventHash,
    result.transactionHashEventValue,
    'confirmationEventHash does not match transactionHashEventValue'
  );

  return true;
};

const startGethTestGroup = function() {
  let validator = function() {
    this.timeout(max_time_for_geth_start);
    logger.step('Start Geth TestGroup');
    return gethManager
      .start()
      .then(function() {
        logger.info('Geth started successfully.');
        assert.isOk(true);
      })
      .catch(function(reason) {
        logger.error('Failed to start geth. reason', reason);
        assert.isOk(false, 'Failed to start geth.');
      });
  };

  it('should start geth.', validator);
};

// Web3 Instances. Make sure to define keys before hand in web3Instances.
let web3Instances = {
    web3WithHttp: null,
    ostWeb3WithHttp: null,
    web3WithWS: null,
    ostWeb3WithWS: null
  },
  ostWeb3WithHttp,
  ostWeb3WithWS,
  web3WithHttp,
  web3WithWS;

const createAndValidateWeb3Instances = function() {
  it('should create new web3 instances.', function() {
    web3Instances.web3WithHttp = web3WithHttp = new Web3(httpEndPoint);
    web3Instances.ostWeb3WithHttp = ostWeb3WithHttp = new OstWeb3(httpEndPoint);
    web3Instances.web3WithWS = web3WithWS = new Web3(wsEndPoint);
    web3Instances.ostWeb3WithWS = ostWeb3WithWS = new OstWeb3(wsEndPoint, null, {
      providerOptions: {
        killOnReconnectFailure: false
      }
    });
    assert.isOk(true);
  });

  it('web3WithHttp.currentProvider should be an instance of HttpProvider', function() {
    assert.instanceOf(web3WithHttp.currentProvider, HttpProvider, 'web3WithHttp has incorrect provider set');
  });
  it('ostWeb3WithHttp.currentProvider should be an instance of HttpProvider', function() {
    assert.instanceOf(ostWeb3WithHttp.currentProvider, HttpProvider, 'ostWeb3WithHttp has incorrect provider set');
  });
  it('web3WithWS.currentProvider should be an instance of WebsocketProvider', function() {
    assert.instanceOf(web3WithWS.currentProvider, WebsocketProvider, 'web3WithWS has incorrect provider set');
  });
  it('ostWeb3WithWS.currentProvider should be an instance of OstWSProvider', function() {
    assert.instanceOf(ostWeb3WithWS.currentProvider, OstWSProvider, 'ostWeb3WithWS has incorrect provider set');
  });
};

const sendTransactionTestGroup = function() {
  let web3OutValues = {},
    web3Key,
    validator;

  // Initiate Transactions.
  validator = function() {
    this.timeout(max_time_per_transaction);
    let web3Key;
    for (web3Key in web3Instances) {
      if (!web3Instances.hasOwnProperty(web3Key)) {
        continue;
      }

      // Create a closure for web3Key and call sendTransactionWith.
      (function(web3Key) {
        let currWeb3 = web3Instances[web3Key];
        logger.info('Testing sendTransaction with', web3Key);
        sendTransactionWith(currWeb3).then(function(outValues) {
          web3OutValues[web3Key] = outValues;
        });
      })(web3Key);
    } // End of for loop.
    assert.isOk(true);
  };
  it('should initiate send transaction flows for all instances of web3.', validator);

  // Verify Transaction results.
  let validateAfter = max_time_per_transaction + 2000;
  for (web3Key in web3Instances) {
    if (!web3Instances.hasOwnProperty(web3Key)) {
      continue;
    }

    validator = (function(web3Key, validateAfter) {
      return function() {
        this.timeout(validateAfter + 1000);

        if (!web3Instances[web3Key]) {
          logger.info('Validation of web3 Instance', web3Key, 'has been skipped.');
          assert.isOk(true);
          return;
        }

        return new Promise(function(resolve, reject) {
          setTimeout(function() {
            resolve(web3OutValues[web3Key]);
          }, validateAfter);
        }).then(function(outValues) {
          verifyResult(outValues, web3Key);
        });
      };
    })(web3Key, validateAfter);
    it(
      'should validate send transaction outputs with ' +
        web3Key +
        '. timeout for this test case set to ' +
        validateAfter,
      validator
    );
    validateAfter = 1000;
  }
};

const stopGethTestGroup = function() {
  let validator = function() {
    this.timeout(max_time_for_geth_stop);
    return gethManager
      .stop()
      .then(function() {
        if (web3Instances.hasOwnProperty('web3WithWS')) {
          logger.info('Removing web3WithWS from web3Instances as it will not re-connect.');
          delete web3Instances.web3WithWS;
        }
        assert.isOk(true);
      })
      .catch(function() {
        assert.isOk(false, 'Failed to stop geth.');
      });
  };

  it('should stop geth.', validator);
};

// Start the test.
mainFn();
