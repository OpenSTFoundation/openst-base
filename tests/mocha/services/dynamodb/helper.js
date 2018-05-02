"use strict";

const chai = require('chai')
  , assert = chai.assert;

const rootPrefix = "../../../.."
  , LoggerKlass = require(rootPrefix + "/lib/logger/custom_console_logger")
  , logger = new LoggerKlass()
  , testConstants = require(rootPrefix + '/tests/mocha/services/dynamodb/constants')
  , api = require(rootPrefix + '/services/dynamodb/api')
;

/**
 * Constructor for helper class
 *
 * @constructor
 */
const helper = function() {};

helper.prototype = {

  validateDynamodbApiObject: function(dynamodbApiObject) {
    assert.exists(dynamodbApiObject, 'dynamodbApiObject is not created');
    assert.equal(typeof dynamodbApiObject, "object");
    assert.equal(dynamodbApiObject.constructor.name, "DynamoDBService");
  },

  createTable: async function(dynamodbApiObject, params, isResultSuccess) {
    const createTableResponse = await dynamodbApiObject.createTable(params);

    if(isResultSuccess === undefined){
      //ignore the result, its optional
    }
    else if (isResultSuccess) {

      assert.equal(createTableResponse.isSuccess(), true);
      assert.exists(createTableResponse.data.data.TableDescription, params.TableName);
    } else{
      assert.equal(createTableResponse.isFailure(), true, "createTable: successfull, should fail for this case");
    }
    return createTableResponse;
  },

  deleteTable: async function(dynamodbApiObject, params, isResultSuccess) {
    const deleteTableResponse = await dynamodbApiObject.deleteTable(params);

    if(isResultSuccess === undefined){
      //ignore the result, its optional
    } else if(isResultSuccess == true){
      assert.equal(deleteTableResponse.isSuccess(), true);
      logger.debug("deleteTableResponse.data.data.TableDescription",deleteTableResponse.data.data.TableDescription);
      assert.exists(deleteTableResponse.data.data.TableDescription, params.TableName);

    } else{
      assert.equal(deleteTableResponse.isSuccess(), false);
    }

    return deleteTableResponse;

  },

  updateContinuousBackup: async function(dynamodbApiObject, params) {
    const enableContinousBackupResponse = await dynamodbApiObject.updateContinuousBackup(params);
    assert.equal(enableContinousBackupResponse.isSuccess(), true);
    assert.equal(enableContinousBackupResponse.data.data.ContinuousBackupsStatus, 'ENABLED');
    return enableContinousBackupResponse;
  },

  updateTable: async function(dynamodbApiObject, params) {
    const updateTableResponse = await dynamodbApiObject.deleteTable(params);
    assert.equal(updateTableResponse.isSuccess(), true);
    assert.equal(updateTableResponse.data.data.TableName, params.TableName);
    return updateTableResponse;
  },

  describeTable: async function(dynamodbApiObject, params) {
    const describeTableResponse = await dynamodbApiObject.describeTable(params);
    assert.equal(describeTableResponse.isSuccess(), true);
    assert.exists(describeTableResponse.data.data.Table.TableName, params.TableName);
    return describeTableResponse;
  },

  listTables: async function(dynamodbApiObject, params) {
    const listTablesResponse = await dynamodbApiObject.listTables(params);
    assert.equal(listTablesResponse.isSuccess(), true);
    assert.include(listTablesResponse.data.data.TableNames, testConstants.transactionLogsTableName);
    return listTablesResponse;
  },


  /**
   * Get dynamoDBApi object
   *
   * @params {object} dynamoDBConfig - DynamoDB connection params
   *
   * @return {object} dynamoDBApi - DynamoDBApi Object
   *
   */
  getDynamoDBApiObject: function(dynamoDBConfig){

    // validate if the dynamodb configuration is available
    assert.exists(dynamoDBConfig, 'dynamoDBConfig is neither `null` nor `undefined`');

    // create dynamoDBApi object
    const dynamoDBApi = new api(dynamoDBConfig);

    // validate if the dynamoDBApi object is created
    assert.exists(dynamoDBApi, 'dynamoDBApi is not created');
    assert.equal(typeof dynamoDBApi, "object");

    // return dynamoDBApi object
    return dynamoDBApi;
  },

  /**
   * Perform batch get
   *
   * @params {object} dynamodbApiObject - DynamoDB Api object
   * @params {object} params - batch get params
   * @params {object} isResultSuccess - expected result
   *
   * @return {result}
   *
   */
  performBatchGetTest: async function (dynamodbApiObject, params, isResultSuccess) {
    assert.exists(dynamodbApiObject, 'dynamoDBApiRef is neither `null` nor `undefined`');
    assert.exists(params, 'params is neither `null` nor `undefined`');

    // call batch get
    const batchGetResponse = await dynamodbApiObject.batchGet(params);

    // validate if the table is created
    assert.equal(batchGetResponse.isSuccess(), isResultSuccess, 'batch get failed');

    // return the response
    return batchGetResponse;
  },

  /**
   * Perform batch write
   *
   * @params {object} dynamodbApiObject - DynamoDB Api object
   * @params {object} params - batch write params
   * @params {object} isResultSuccess - expected result
   *
   * @return {result}
   *
   */
  performBatchWriteTest: async function (dynamodbApiObject, params, isResultSuccess) {
    assert.exists(dynamodbApiObject, 'dynamoDBApiRef is neither `null` nor `undefined`');
    assert.exists(params, 'params is neither `null` nor `undefined`');

    // call batch get
    const batchWriteResponse = await dynamodbApiObject.batchWrite(params);

    // validate if the table is created
    assert.equal(batchWriteResponse.isSuccess(), isResultSuccess, 'batch write failed');

    // return the response
    return batchWriteResponse;
  }
};

module.exports = new helper();