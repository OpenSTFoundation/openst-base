//import { resolve } from 'path';

'use strict';

// Load external packages
const Chai = require('chai'),
  assert = Chai.assert,
  rootPrefix = '../../../..',
  OSTBase = require(rootPrefix + '/index'),
  PromiseContext = OSTBase.OSTPromise.Context;

// For the purpose of test, set default timeout to 3 seconds.
PromiseContext.prototype.timeoutInMilliSecs = 3000;

let netExecutionTime = PromiseContext.prototype.timeoutInMilliSecs * 2;

// This executor will always resolve with true as result.
const executorThatResolves = function(resolve, reject) {
  //I will resolve after 1 second
  setTimeout(function() {
    resolve(true);
  }, 1000);
};

// This executor will always reject with error object as reason.
const executorThatRejects = function(resolve, reject) {
  //I will reject after 1 sec.
  setTimeout(function() {
    reject(new Error('This promise is supposed to be rejected'));
  }, 1000);
};

// This executor will not do anything.
const executorThatTimesout = function(resolve, reject) {
  //I am doing nothing.
  //...still nothing.
  //...still nothing.
  //...still nothing.
};

const configTestCases = [
  { name: 'resolved', executor: executorThatResolves },
  { name: 'rejected', executor: executorThatRejects },
  { name: 'timedout', executor: executorThatTimesout }
];

const createTestCasesForOptions = function(optionsDesc, options) {
  optionsDesc = optionsDesc || '';
  options = options || {};
  let defaultExecutorParams = {
      resolved: false,
      timedout: false,
      rejected: false,
      completedAfterTimeout: false
    },
    executorParams,
    testCaseName;
  configTestCases.forEach(function(testCase) {
    executorParams = Object.create(defaultExecutorParams);
    testCaseName = testCase.name;
    executorParams[testCaseName] = true;
    if (testCaseName == 'timedout') {
      if (options.resolvePromiseOnTimeout) {
        executorParams.resolved = true;
        executorParams.completedAfterTimeout = true;
        if (options.resolvedValueOnTimeout) {
          executorParams.resolvedValue = options.resolvedValueOnTimeout;
        }
      } else if (options.rejectPromiseOnTimeout) {
        executorParams.rejected = true;
        executorParams.completedAfterTimeout = true;
        if (options.rejectedReasonOnTimeout) {
          executorParams.rejectedReason = options.rejectedReasonOnTimeout;
        }
      }
    }
    let promise = new PromiseContext(testCase.executor, options, executorParams);
    let outParamsOfPromise = bindPromiseContextCallbacks(promise);
    let Validator = function(done) {
      validatePromiseContext(promise, options, done, outParamsOfPromise);
    };
    it(optionsDesc + ' :: Promise should be ' + testCaseName, Validator);
  });
};

const bindPromiseContextCallbacks = function(promiseContext) {
  let outParams = {
    resolved: false,
    timedout: false,
    rejected: false,
    completedAfterTimeout: false,
    rejectedReason: null,
    resolvedValue: null
  };

  promiseContext.onResolved = function() {
    outParams.resolved = true;
  };

  promiseContext.onRejected = function(reason) {
    outParams.rejected = true;
  };

  promiseContext.onTimedout = function() {
    outParams.timedout = true;
  };

  promiseContext.onCompletedAfterTimeout = function() {
    outParams.completedAfterTimeout = true;
  };

  let currPromise = promiseContext.getPromise();

  currPromise
    .then(function(resolvedValue) {
      outParams.resolvedValue = resolvedValue;
    })
    .catch(function(rejectedReason) {
      //Do nothing. Validator should get the required reason.
      outParams.rejectedReason = rejectedReason;
    });

  return outParams;
};

const validatePromiseContext = function(promiseContext, options, done, outParams) {
  let expectedFlagSet = promiseContext.getExecutorParams();
  let buffer = 2000;

  let validateAfter = promiseContext.timeoutInMilliSecs + buffer;
  validateAfter = validateAfter - (Date.now() - promiseContext.executionTs);
  if (validateAfter < 0) {
    validateAfter = 0;
  }

  setTimeout(function() {
    let flag = null;
    for (flag in expectedFlagSet) {
      if (!expectedFlagSet.hasOwnProperty(flag)) {
        continue;
      }
      let outVal = outParams[flag];
      let expectedVal = expectedFlagSet[flag];
      // console.log("expectedVal",expectedVal,"outVal", outVal, "flag", flag);
      assert.equal(expectedVal, outVal, 'Expected flag set not matched with output one.');
    }
    done();
  }, validateAfter);
};

describe('lib/promise_context/promise_context', function() {
  createTestCasesForOptions('PromiseContext with default options');
  createTestCasesForOptions('PromiseContext with resolvePromiseOnTimeout = true', {
    resolvePromiseOnTimeout: true
  });
  createTestCasesForOptions('PromiseContext with rejectPromiseOnTimeout = true', {
    rejectPromiseOnTimeout: true
  });
  createTestCasesForOptions("PromiseContext with resolvedValueOnTimeout = 'auto-resolved'", {
    resolvePromiseOnTimeout: true,
    resolvedValueOnTimeout: 'auto-resolved'
  });
  createTestCasesForOptions("PromiseContext with rejectedReasonOnTimeout = Error with message 'Auto-Rejected' ", {
    rejectPromiseOnTimeout: true,
    rejectedReasonOnTimeout: new Error('Auto-Rejected')
  });
});
