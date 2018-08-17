const rootPrefix = '.',
  wsEndPoint = 'ws://127.0.0.1:19546',
  deadEndPoint = 'ws://somethingThatWillNotExist:1234';

const OstCore = require(rootPrefix + '/index'),
  OstWeb3 = OstCore.OstWeb3,
  OstWSProvider = OstWeb3.OstWSProvider,
  logger = OstCore.logger;

const Web3 = require('web3');

//Test 1 :: Test for dead connection.
const testDeadConnection = function(testName, wsProviderOptions) {
  testName = testName ? testName + ' :: ' : '';
  wsProviderOptions = wsProviderOptions || {};

  const defaultOptions = {
    maxReconnectTries: 2,
    killOnReconnectFailure: false
  };

  const finalProviderOptions = Object.assign({}, defaultOptions, wsProviderOptions);

  return new Promise(function(resolve, reject) {
    const web3 = new OstWeb3(deadEndPoint, null, {
        providerOptions: finalProviderOptions
      }),
      currentProvider = web3.currentProvider;

    logger.step('Validating currentProvider');
    if (currentProvider instanceof OstWSProvider) {
      logger.win('currentProvider is an instanceof OstWSProvider');
    } else {
      reject(testName + 'testDeadConnection :: currentProvider is NOT instanceof OstWSProvider');
    }

    var receivedConnect = 0,
      receivedDead = 0,
      receivedEnd = 0,
      receivedError = 0,
      expectedValidationTime =
        web3.currentProvider.options.maxReconnectTries * web3.currentProvider.options.reconnectInterval;
    expectedValidationTime = expectedValidationTime * 2;

    web3.currentProvider.on('connect', function() {
      receivedConnect++;
    });
    web3.currentProvider.on('end', function() {
      receivedEnd++;
    });
    web3.currentProvider.on('dead', function() {
      receivedDead++;
    });
    web3.currentProvider.on('error', function() {
      receivedError++;
    });

    setTimeout(function() {
      logger.info(
        testName,
        'testDeadConnection :: Validating Events ::',
        '\n\t receivedConnect:',
        receivedConnect,
        '\n\t receivedEnd:',
        receivedEnd,
        '\n\t receivedDead:',
        receivedDead,
        '\n\t receivedError:',
        receivedError
      );

      //Make sure we got dead event.
      if (!receivedDead) {
        reject(testName + 'testDeadConnection :: did not receive dead event.');
        return;
      }

      //Make sure we got end event.
      else if (!receivedEnd) {
        reject(testName + 'testDeadConnection :: did not receive end event.');
        return;
      }

      //Make sure we got error event.
      else if (!receivedError) {
        reject(testName + 'testDeadConnection :: did not receive error event.');
        return;
      }

      //Make sure we DID NOT get connect event.
      else if (receivedConnect) {
        reject(
          testName + 'testDeadConnection :: Receive connect event on a dead endpoint. Something seriously broken.'
        );
        return;
      }

      logger.win(testName + 'testDeadConnection :: All sub-tests passed.');
      resolve();
    }, expectedValidationTime);
  });
};

const testEthTransfer = function(ensureReceipt) {
  ensureReceipt = ensureReceipt || false;
  return new Promise(function(resolve, reject) {
    const web3 = new OstWeb3(wsEndPoint, null, {
        providerOptions: {
          maxReconnectTries: 20,
          killOnReconnectFailure: false
        }
      }),
      currentProvider = web3.currentProvider;

    logger.step('testEthTransfer :: Validating currentProvider');
    if (currentProvider instanceof OstWSProvider) {
      logger.win('testEthTransfer :: currentProvider is an instanceof OstWSProvider');
    } else {
      reject('testEthTransfer :: currentProvider is NOT instanceof OstWSProvider');
    }

    var receivedConnect = 0,
      receivedDead = 0,
      receivedEnd = 0,
      receivedError = 0;

    web3.currentProvider.on('connect', function() {
      receivedConnect++;
    });
    web3.currentProvider.on('end', function() {
      receivedEnd++;
    });
    web3.currentProvider.on('dead', function() {
      receivedDead++;
    });
    web3.currentProvider.on('error', function() {
      receivedError++;
    });

    var sender = process.env.OST_UTILITY_CHAIN_OWNER_ADDR,
      passphrase = process.env.OST_UTILITY_CHAIN_OWNER_PASSPHRASE,
      txParams = {
        from: sender,
        to: process.env.OST_FOUNDATION_ADDR,
        value: '200000000'
      },
      receivedTxHash = 0,
      receivedReceipt = 0,
      receivedConformation = 0,
      receivedError = 0,
      timeToWaitInSecs = 30;

    console.log('sender', sender, 'passphrase', passphrase);

    const validateCounts = function() {
      logger.info(
        'testEthTransfer :: validateCounts:',
        '\n\treceivedTxHash',
        receivedTxHash,
        '\n\treceivedReceipt',
        receivedReceipt,
        '\n\treceivedConformation',
        receivedConformation,
        '\n\treceivedError',
        receivedError
      );
      if (!receivedConnect) {
        reject('testEthTransfer :: did NOT receive connect event.');
      } else if (!receivedTxHash) {
        reject('testEthTransfer :: did NOT receive transactionHash event.');
      } else if (ensureReceipt && !receivedReceipt) {
        reject('testEthTransfer :: did NOT receive receipt event.');
      } else if (ensureReceipt && !receivedConformation) {
        reject('testEthTransfer :: did NOT receive confirmation event.');
      } else if (receivedError) {
        reject('testEthTransfer :: received error event.');
      } else {
        logger.win('testEthTransfer :: All sub-tests passed with ensureReceipt =', ensureReceipt);
        resolve();
      }
    };

    web3.eth.personal
      .unlockAccount(sender, passphrase)
      .catch(function(reason) {
        logger.error('reason', reason);
        reject('testEthTransfer :: Failed to unlock account');
        throw 'Failed to unlock account';
      })
      .then(function(i_d_k) {
        return web3.eth
          .sendTransaction(txParams)
          .on('transactionHash', function(hash) {
            logger.info('testEthTransfer :: transactionHash received.');
            receivedTxHash++;
            setTimeout(validateCounts, timeToWaitInSecs * 1000);
          })
          .on('receipt', function(receipt) {
            logger.win('testEthTransfer :: receipt received.');
            receivedReceipt++;
          })
          .on('confirmation', function(confirmationNumber, receipt) {
            receivedConformation++;
          })
          .on('error', function(error) {
            receivedError++;
          })
          .then(function(receipt) {
            logger.win(
              'testEthTransfer :: sendTransaction successfull! Validating Counts in',
              timeToWaitInSecs,
              ' secs.'
            );
            logger.log('receipt', receipt);
            setTimeout(validateCounts, timeToWaitInSecs * 1000);
          })
          .catch(function(reason) {
            logger.error('reason', reason);
            reject('testEthTransfer :: sendTransaction failed.');
          });
      });
  });
};

const testOrgEthTransfer = function() {
  return new Promise(function(resolve, reject) {
    const web3 = new Web3(wsEndPoint, null, {
        providerOptions: {
          maxReconnectTries: 20,
          killOnReconnectFailure: false
        }
      }),
      currentProvider = web3.currentProvider;

    var sender = process.env.OST_UTILITY_CHAIN_OWNER_ADDR,
      passphrase = process.env.OST_UTILITY_CHAIN_OWNER_PASSPHRASE,
      txParams = {
        from: sender,
        to: process.env.OST_FOUNDATION_ADDR,
        value: '200000000'
      },
      receivedTxHash = 0,
      receivedReceipt = 0,
      receivedConformation = 0,
      receivedError = 0,
      timeToWaitInSecs = 10;

    console.log('sender', sender, 'passphrase', passphrase);

    const validateCounts = function() {
      if (!receivedTxHash) {
        reject('testOrgEthTransfer :: did NOT receive transactionHash event.');
      } else if (!receivedReceipt) {
        reject('testOrgEthTransfer :: did NOT receive receipt event.');
      } else if (!receivedConformation) {
        reject('testOrgEthTransfer :: did NOT receive confirmation event.');
      } else if (receivedError) {
        reject('testOrgEthTransfer :: received error event.');
      } else {
        logger.info(
          'receivedTxHash',
          receivedTxHash,
          'receivedReceipt',
          receivedReceipt,
          'receivedConformation',
          receivedConformation,
          'receivedError',
          receivedError
        );
        resolve();
      }
    };

    web3.eth.personal
      .unlockAccount(sender, passphrase)
      .catch(function(reason) {
        logger.error('reason', reason);
        reject('testOrgEthTransfer :: Failed to unlock account');
        throw 'Failed to unlock account';
      })
      .then(function(i_d_k) {
        return web3.eth
          .sendTransaction(txParams)
          .on('transactionHash', function(hash) {
            logger.info('testOrgEthTransfer :: transactionHash received.');
            receivedTxHash++;
          })
          .on('receipt', function(receipt) {
            logger.info('testOrgEthTransfer :: receipt received.');
            receivedReceipt++;
          })
          .on('confirmation', function(confirmationNumber, receipt) {
            receivedConformation++;
          })
          .on('error', function(error) {
            receivedError++;
          })
          .then(function(receipt) {
            logger.win(
              'testOrgEthTransfer :: sendTransaction successfull! Validating Counts in',
              timeToWaitInSecs,
              ' secs.'
            );
            logger.log('receipt', receipt);
            setTimeout(validateCounts, timeToWaitInSecs * 1000);
          })
          .catch(function(reason) {
            logger.error('reason', reason);
            reject('testOrgEthTransfer :: sendTransaction failed.');
          });
      });
  });
};

const testSigTerm = function() {
  var receivedSigTerm = false,
    exitAfter = 2 * 1000;
  const sigTermHandler = function() {
    receivedSigTerm = true;
    logger.win('testSigTerm :: sigTermHandler :: SIGTERM received.... exiting in', exitAfter, ' miliseconds');
    setTimeout(function() {
      logger.info('testSigTerm :: sigTermHandler :: exiting...');
      process.exit(0);
    }, exitAfter);
  };
  process.on('SIGTERM', sigTermHandler);

  return testDeadConnection('testSigTerm', {
    killOnReconnectFailure: true
  }).then(function(i_d_k) {
    if (receivedSigTerm) {
      return Promise.resolve('testSigTerm :: All test passed');
    } else {
      return Promise.reject('receivedSigTerm was not set.');
    }
  });
};

const testEthBalance = function() {
  const addr = process.env.OST_UTILITY_CHAIN_OWNER_ADDR,
    interval = 1 * 1000,
    maxCnt = 30;
  const web3 = new OstWeb3(wsEndPoint, null, {
      providerOptions: {
        maxReconnectTries: 20,
        killOnReconnectFailure: false
      }
    }),
    currentProvider = web3.currentProvider;

  var count = maxCnt,
    resolvedCnt = 0,
    rejectedCnt = 0,
    lastRejectedTimeStamp,
    lastResolvedTimeStamp,
    allPromises = [],
    promiseObj;

  while (count--) {
    promiseObj = (function(myInterval) {
      return new Promise(function(resolve, reject) {
        setTimeout(resolve, myInterval);
      }).then(function() {
        return web3.eth
          .getBalance(addr)
          .then(function(balance) {
            logger.log('testEthBalance :: balance received :: ', balance);
            resolvedCnt++;
            lastResolvedTimeStamp = Date.now();
            return balance;
          })
          .catch(function(reason) {
            logger.error('testEthBalance :: Failed to fetch balance. reason ::\n', reason);
            rejectedCnt++;
            lastRejectedTimeStamp = Date.now();
          });
      });
    })(interval * (count + 1));
    allPromises.push(promiseObj);
  }

  return Promise.all(allPromises).then(function() {
    lastRejectedTimeStamp = lastRejectedTimeStamp || 0;
    lastResolvedTimeStamp = lastResolvedTimeStamp || 0;
    logger.info(
      'testEthBalance :: final stats ::',
      '\n\t maxCnt',
      maxCnt,
      '\n\t resolvedCnt',
      resolvedCnt,
      '\n\t rejectedCnt',
      rejectedCnt,
      '\n\t lastRejectedTimeStamp',
      lastRejectedTimeStamp,
      '\n\t lastResolvedTimeStamp',
      lastResolvedTimeStamp
    );

    if (lastRejectedTimeStamp > lastResolvedTimeStamp) {
      return Promise.reject('testEthBalance :: lastRejectedTimeStamp is greater than lastResolvedTimeStamp');
    } else {
      logger.win('testEthBalance :: Test Successful');
      return Promise.resolve('testEthBalance :: Test Successful');
    }
  });
};

const run = async function() {
  await testEthBalance()
    .then(function(i_d_k) {
      return testDeadConnection();
    })
    .then(function(i_d_k) {
      return testOrgEthTransfer(true);
    })
    .then(function(i_d_k) {
      return testEthTransfer();
    })
    .then(function() {
      return testSigTerm();
    })
    .then(function(i_d_k) {
      logger.win('All tests passed. Waiting for testSigTerm to exit the process.');
    })
    .catch(function(reason) {
      logger.error('Tests have failed. Reason:\n', reason);
      process.exit(1);
    });
};

run();
