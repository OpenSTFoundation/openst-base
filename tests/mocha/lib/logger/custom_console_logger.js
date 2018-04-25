"use strict";

// Load external packages
const Chai        = require('chai')
    , assert      = Chai.assert
    , rootPrefix  = "../../../.."
    , OSTBase     = require( rootPrefix + "/index" )
    , Logger      = OSTBase.Logger
;

const SUPPORTED_LOG_LEVEL_KEYS = ["OFF", "FATAL", "ERROR", "WARN", "INFO", "DEBUG", "TRACE", "ALL"];
const SUPPORTED_METHODS = ["notify", "error", "warn", "info", "step", "win", "debug", "log", "dir", "trace"];

const createLoggerInstanceValidator = function ( moduleName, logLevel ) {
  return function () {
    
    let len = SUPPORTED_METHODS.length
      , logger = new Logger( moduleName, logLevel )
      , loggerMethodName
      , loggerMethod
    ;

    assert.instanceOf( logger, Logger );

    while( len-- ) {
      loggerMethodName = SUPPORTED_METHODS[ len ];
      loggerMethod = logger[ loggerMethodName ];
      assert.isFunction( loggerMethod );
      if ( loggerMethodName === "dir" ) {
        loggerMethod.call( logger, { 
          message: "logger.dir called"
        });
      } else {
        loggerMethod.call( logger, "Calling", loggerMethodName);  
      }
    }
  };
};


describe('lib/logger/custom_console_logger', function() { 

  
  

  it("Logger should be a function", function () {
    assert.isFunction(Logger);
  });

  it("should be support all log levels", function () {  
    let supportedLogLevels = Logger.LOG_LEVELS;
    assert.typeOf( supportedLogLevels, "object" );

    let len       = SUPPORTED_LOG_LEVEL_KEYS.length
      , logLevelKey
    ;
    while( len-- ) {
      logLevelKey = SUPPORTED_LOG_LEVEL_KEYS[ len ];
      assert.typeOf( supportedLogLevels[ logLevelKey ] , "number")
    }
  });

  let len                = SUPPORTED_LOG_LEVEL_KEYS.length
    , supportedLogLevels = Logger.LOG_LEVELS
    , logLevelKey
    , logLevelNum
    , strValidator
    , numValidator
    , moduleName
  ;
  while( len-- ) {
    logLevelKey = SUPPORTED_LOG_LEVEL_KEYS[ len ];
    logLevelNum = supportedLogLevels[ logLevelKey ];

    moduleName = "STR_" + logLevelKey;
    strValidator = createLoggerInstanceValidator( moduleName, logLevelKey );
    it("should support all methods for log-level: " + logLevelKey + " and module-name: " + moduleName, strValidator);

    moduleName = "NUM_" + logLevelKey + "_" + logLevelNum;
    numValidator = createLoggerInstanceValidator( moduleName, logLevelNum );
    it("should support all methods for log-level: " + logLevelKey + " and module-name: " + moduleName, numValidator);
  }


});







