'use strict';

// Load external packages
const Chai = require('chai'),
  assert = Chai.assert,
  rootPrefix = '../../../..',
  OSTBase = require(rootPrefix + '/index'),
  Logger = OSTBase.Logger,
  PromiseContext = OSTBase.OSTPromise.Context,
  PCQueueManager = OSTBase.OSTPromise.QueueManager,
  logger = new Logger('PQMTestCases');

// For the purpose of test, set default timeout to 3 seconds.
const _default_timeout_val = (PromiseContext.prototype.timeoutInMilliSecs = PCQueueManager.prototype.timeoutInMilliSecs = 3000);
const default_auto_resolve_val = (PCQueueManager.prototype.resolvedValueOnTimeout = PromiseContext.prototype.resolvedValueOnTimeout =
  'default_auto_resolved');
const default_auto_reject_reason = (PCQueueManager.prototype.rejectedReasonOnTimeout = PromiseContext.prototype.rejectedReasonOnTimeout = new Error(
  'default_auto_rejected'
));

//Do not log info.
PCQueueManager.prototype.logInfoTimeInterval = 0;

const _promises_per_queue = 3 * 10;

// This executor will always resolve with true as result.
const _resolved_in_milisecs = 1000;
const _resolved_value = true;
const _rejected_in_milisecs = 1000;
const _rejected_error = new Error('This promise is supposed to be rejected');
const _promise_indx_key = 'promise_indx_key';
const _expected_value_keys = 'expected';
const _actual_value_keys = 'actual';

const defaultExecutor = function(resolve, reject, executorParams, promiseContext) {
  // Define Expected Values.
  let expectedVals = (executorParams[_expected_value_keys] = executorParams[_expected_value_keys] || {});
  expectedVals['resolved'] = false;
  expectedVals['resolvedValue'] = null;
  expectedVals['rejected'] = false;
  expectedVals['rejectedReason'] = null;
  expectedVals['timedout'] = false;

  let promiseIndx = executorParams[_promise_indx_key];
  switch (promiseIndx % 3) {
    case 0:
      expectedVals['resolved'] = true;
      expectedVals['resolvedValue'] = _resolved_value;
      //I will resolve after 1 second
      setTimeout(function() {
        resolve(_resolved_value);
      }, _resolved_in_milisecs);
      break;
    case 1:
      expectedVals['rejected'] = true;
      expectedVals['rejectedReason'] = _rejected_error;
      //I will reject after 1 sec.
      setTimeout(function() {
        reject(_rejected_error);
      }, _rejected_in_milisecs);
      break;
    default:
      expectedVals['timedout'] = true;
      //I am doing nothing.
      //...still nothing.
      //...still nothing.
      //...still nothing.
      break;
  }

  //Define Actual Value.
  let actualVals = (executorParams[_actual_value_keys] = executorParams[_actual_value_keys] || {});
  actualVals['resolved'] = false;
  actualVals['resolvedValue'] = null;
  actualVals['rejected'] = false;
  actualVals['rejectedReason'] = null;

  setTimeout(function() {
    let promiseObj = promiseContext.getPromise();
    promiseObj
      .then(function(resolvedValue) {
        actualVals['resolved'] = true;
        actualVals['resolvedValue'] = resolvedValue;
        return resolvedValue;
      })
      .catch(function(rejectedReason) {
        //Do nothing. Validator should get the required reason.
        actualVals['rejected'] = true;
        actualVals['rejectedReason'] = rejectedReason;
      });

    if (typeof promiseContext === 'undefined') {
      reject(new Error('promiseContext not passed into excutor'));
      return;
    }

    if (typeof promiseObj === 'undefined') {
      reject(new Error('promiseContext.getPromise() returned null'));
    }

    if (!(promiseObj instanceof Promise)) {
      reject(new Error('promiseContext.getPromise() is not an instanceof Promise.'));
    }

    if (typeof executorParams === 'undefined') {
      reject(new Error('executorParams not passed into excutor'));
      return;
    }
  }, 10);
};

const bindCallbacks = function(promiseQueue) {
  let outParams = {
    maxZombieCountReachedCount: 0,
    allPromisesCompletedCount: 0,
    promiseContexts: {},
    promiseOutParams: {}
  };

  const getContextOutParams = function(promiseContext) {
    let executorParams = promiseContext.getExecutorParams(),
      promiseIndx,
      promiseKey = (promiseIndx = executorParams[_promise_indx_key]);

    if (!outParams.promiseContexts[promiseKey]) {
      outParams.promiseContexts[promiseKey] = promiseContext;
    }

    let pcOutParams = outParams.promiseOutParams[promiseKey];
    if (!pcOutParams) {
      pcOutParams = outParams.promiseOutParams[promiseKey] = {
        resolved: false,
        timedout: false,
        rejected: false,
        completed: false,
        rejectedReason: null,
        resolvedValue: null
      };
    }
    return pcOutParams;
  };

  promiseQueue.onPromiseResolved = function(resolvedValue, promiseContext) {
    let pcOutParams = getContextOutParams(promiseContext);
    pcOutParams.resolved = true;
    pcOutParams.resolvedValue = resolvedValue;
  };

  promiseQueue.onPromiseRejected = function(rejectReason, promiseContext) {
    let pcOutParams = getContextOutParams(promiseContext);
    pcOutParams.rejected = true;
    pcOutParams.rejectedReason = rejectReason;
  };

  promiseQueue.onPromiseTimedout = function(promiseContext) {
    let pcOutParams = getContextOutParams(promiseContext);
    pcOutParams.timedout = true;
  };

  promiseQueue.onPromiseCompleted = function(promiseContext) {
    let pcOutParams = getContextOutParams(promiseContext);
    pcOutParams.completed = true;
  };

  promiseQueue.onMaxZombieCountReached = function() {
    outParams.maxZombieCountReachedCount++;
  };

  promiseQueue.onAllPromisesCompleted = function() {
    outParams.allPromisesCompletedCount++;
  };

  return outParams;
};

const validatePromiseQueue = function(promiseQueue, options, expectedParamsOfQueue, outParamsOfQueue, done) {
  let executorParams, pcExpected, pcActual, queueExpected, queueActual, promiseContext, promiseContextIndx;

  //Check if promiseQueue is valid.
  assert.strictEqual(promiseQueue.isValid(), true, 'PromiseQueue is not valid.');

  //Check if allPromisesCompleted has been triggered at-least once.
  assert.isAtLeast(
    outParamsOfQueue.allPromisesCompletedCount,
    1,
    'onAllPromisesCompleted should have been called atleast once'
  );

  for (let expectedKey in expectedParamsOfQueue) {
    if (expectedParamsOfQueue.hasOwnProperty(expectedKey)) {
      assert.strictEqual(
        expectedParamsOfQueue[expectedKey],
        outParamsOfQueue[expectedKey],
        'expected value of (PromiseQueue) ' +
          expectedKey +
          '(' +
          expectedParamsOfQueue[expectedKey] +
          ' did not match actual value ' +
          outParamsOfQueue[expectedKey]
      );
    }
  }

  for (let promiseKey in outParamsOfQueue.promiseContexts) {
    promiseContext = outParamsOfQueue.promiseContexts[promiseKey];
    queueActual = outParamsOfQueue.promiseOutParams[promiseKey];
    executorParams = promiseContext.getExecutorParams();
    pcExpected = executorParams[_expected_value_keys];
    pcActual = executorParams[_actual_value_keys];

    for (let valKey in pcExpected) {
      if (pcExpected.hasOwnProperty(valKey) && pcActual.hasOwnProperty(valKey)) {
        assert.strictEqual(
          pcActual[valKey],
          pcExpected[valKey],
          'actual value of (PromiseContext) ' +
            valKey +
            '(' +
            pcActual[valKey] +
            ') did not match expected value ' +
            pcExpected[valKey]
        );
      }

      if (queueActual[valKey] !== pcExpected[valKey]) {
        logger.log('---valKey', valKey, '--- queueActual');
        logger.log(queueActual);
        logger.log('--- pcExpected');
        logger.log(pcExpected);
      }

      assert.strictEqual(
        queueActual[valKey],
        pcExpected[valKey],
        'actual value of (PromiseContext)' +
          valKey +
          '(' +
          queueActual[valKey] +
          ') did not match expected value ' +
          pcExpected[valKey]
      );
    }
  }

  done();
};

const run_test_cases_after = 2 * _default_timeout_val;
let test_start_time = 0;

const createTestCasesForOptions = function(optionsDesc, options) {
  test_start_time = test_start_time || Date.now();
  options = options || {};
  let promiseQueue = new PCQueueManager(defaultExecutor, options);
  let len = _promises_per_queue,
    outParamsOfQueue = bindCallbacks(promiseQueue),
    expectedParamsOfQueue = {
      maxZombieCountReachedCount: 0,
      allPromisesCompletedCount: 1
    },
    executorParams,
    expectedVals,
    timeoutCnt;

  timeoutCnt = 0;
  while (len--) {
    executorParams = {};
    executorParams[_promise_indx_key] = len;

    promiseQueue.createPromise(executorParams);
    expectedVals = executorParams[_expected_value_keys];
    if (expectedVals.timedout) {
      timeoutCnt++;
      if (options.resolvePromiseOnTimeout) {
        expectedVals.resolved = true;
        expectedVals.resolvedValue = options.resolvedValueOnTimeout || default_auto_resolve_val;
      } else if (options.rejectPromiseOnTimeout) {
        expectedVals.rejected = true;
        expectedVals.rejectedReason = options.rejectedReasonOnTimeout || default_auto_reject_reason;
      }
    }

    if (options.maxZombieCount && !options.resolvePromiseOnTimeout && !options.rejectPromiseOnTimeout) {
      // onMaxZombieCountReached should be triggered only once.
      expectedParamsOfQueue.maxZombieCountReachedCount = 1;
    }
  }

  let Validator = function(done) {
    let validateAfter = run_test_cases_after;
    validateAfter = validateAfter - (Date.now() - test_start_time);
    if (validateAfter < 0) {
      validateAfter = 0;
    }
    setTimeout(function() {
      validatePromiseQueue(promiseQueue, options, expectedParamsOfQueue, outParamsOfQueue, done);
    }, validateAfter);
  };

  it(optionsDesc, Validator);
};

describe('lib/promise_context/promise_queue_manager', function() {
  createTestCasesForOptions('OSTPromise.QueueManager with default options');
  createTestCasesForOptions('OSTPromise.QueueManager with resolvePromiseOnTimeout = true', {
    resolvePromiseOnTimeout: true
  });

  createTestCasesForOptions("OSTPromise.QueueManager with resolvedValueOnTimeout = 'auto_resolved_from_options'", {
    resolvePromiseOnTimeout: true,
    resolvedValueOnTimeout: 'auto_resolved_from_options'
  });

  createTestCasesForOptions('OSTPromise.QueueManager with rejectPromiseOnTimeout = true', {
    rejectPromiseOnTimeout: true
  });

  createTestCasesForOptions(
    "OSTPromise.QueueManager with rejectedReasonOnTimeout = Error with message 'auto_rejected_from_options' ",
    {
      rejectPromiseOnTimeout: true,
      rejectedReasonOnTimeout: new Error('auto_rejected_from_options')
    }
  );

  createTestCasesForOptions('OSTPromise.QueueManager with maxZombieCount = 2', {
    maxZombieCount: 2
  });
});
