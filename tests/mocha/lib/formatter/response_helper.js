'use strict';

// Load external packages
const Chai = require('chai'),
  assert = Chai.assert,
  rootPrefix = '../../../..',
  OSTBase = require(rootPrefix + '/index'),
  paramErrorConfig = require('./param_error_config'),
  apiErrorConfig = require('./api_error_config');

const api_error_key = Object.keys(apiErrorConfig)[0],
  param_error_key = Object.keys(paramErrorConfig)[0];

const responseHelper = new OSTBase.responseHelper({
  moduleName: 'openst-base'
});

const errorConfig = {
  param_error_config: paramErrorConfig,
  api_error_config: apiErrorConfig
};

const commonErrorParams = {
  internal_error_identifier: 'test_1',
  api_error_identifier: api_error_key,
  params_error_identifiers: [],
  error_config: errorConfig
};

const commonParamErrorParams = {
  internal_error_identifier: 'test_1',
  api_error_identifier: api_error_key,
  params_error_identifiers: [param_error_key],
  error_config: errorConfig
};

const testHash = { test_key: 'test_value' };

describe('lib/formatter/response_helper', function() {
  it('Should create responseHelper object', function() {
    assert.instanceOf(responseHelper, OSTBase.responseHelper);
  });

  it('Should return failure status for error call', function() {
    assert.equal(true, responseHelper.error(commonErrorParams).isFailure());
  });

  it('Should return false for isSuccess call for error', function() {
    assert.equal(false, responseHelper.error(commonErrorParams).isSuccess());
  });

  it('Should return failure status for paramValidationError call', function() {
    assert.equal(true, responseHelper.paramValidationError(commonParamErrorParams).isFailure());
  });

  it('Should return false for isSuccess call for paramValidationError', function() {
    assert.equal(false, responseHelper.paramValidationError(commonParamErrorParams).isSuccess());
  });

  it('Should return true for isSuccess when called successWithData', function() {
    assert.equal(true, responseHelper.successWithData(testHash).isSuccess());
  });

  it('Should return false for isFailure when called successWithData', function() {
    assert.equal(false, responseHelper.successWithData(testHash).isFailure());
  });

  it('Should have all the expected keys in response hash', function() {
    let responseData = responseHelper.error(commonErrorParams).toHash(errorConfig);

    assert.equal(true, responseData.hasOwnProperty('success'));
    assert.equal(true, responseData.hasOwnProperty('err'));
    assert.equal(true, responseData.err.hasOwnProperty('code'));
    assert.equal(true, responseData.err.hasOwnProperty('msg'));
    assert.equal(true, responseData.err.hasOwnProperty('error_data'));
    assert.equal(true, responseData.err.hasOwnProperty('internal_id'));
  });

  it('Should have all the expected keys and values when called successWithData', function() {
    let responseData = responseHelper.successWithData(testHash).toHash(errorConfig);

    assert.equal(true, responseData.hasOwnProperty('success'));
    assert.equal(true, responseData.hasOwnProperty('data'));
    assert.equal(true, responseData.data.hasOwnProperty('test_key'));
    assert.equal('test_value', responseData.data.test_key);
  });

  it('Should return an array for error_data in err object', function() {
    let responseData = responseHelper.paramValidationError(commonParamErrorParams).toHash(errorConfig);

    assert.equal(true, responseData.err.error_data instanceof Array);
  });

  it('Should return code in err as per input error code', function() {
    assert.equal(
      apiErrorConfig[api_error_key].code,
      responseHelper.error(commonErrorParams).toHash(errorConfig).err.code
    );
  });

  it('Should return msg in err as per input error code', function() {
    assert.equal(
      apiErrorConfig[api_error_key].message,
      responseHelper.error(commonErrorParams).toHash(errorConfig).err.msg
    );
  });

  it('Should return internal_id in err as per input error code', function() {
    assert.equal('test_1', responseHelper.error(commonErrorParams).toHash(errorConfig).err.internal_id);
  });

  it('Should have key count of 3 in response hash', function() {
    assert.equal(2, Object.keys(responseHelper.error(commonErrorParams).toHash(errorConfig)).length);
  });

  it('Should have key count of 4 in err object of response hash', function() {
    assert.equal(4, Object.keys(responseHelper.error(commonErrorParams).toHash(errorConfig).err).length);
  });

  it('Should return name in error_data object as per code in input', function() {
    assert.equal(
      paramErrorConfig.test_1.parameter,
      responseHelper.paramValidationError(commonParamErrorParams).toHash(errorConfig).err.error_data[0].parameter
    );
  });

  it('Should return message in error_data object as per code in input', function() {
    assert.equal(
      paramErrorConfig.test_1.message,
      responseHelper.paramValidationError(commonParamErrorParams).toHash(errorConfig).err.error_data[0].msg
    );
  });

  it('Should return a Result object', function() {
    var obj = responseHelper.paramValidationError(commonParamErrorParams);

    assert.equal(true, responseHelper.isCustomResult(obj));
  });
});
