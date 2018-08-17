'use strict';

/**
 * Custom console logger
 *
 * @module helpers/custom_console_logger
 */

const myProcess = require('process'),
  pid = String(myProcess.pid),
  pIdPrexfix = '[' + pid + ']',
  DEBUG = false;

/**
  Notes for developer trying to change the behaviour of CustomConsoleLogger.prototype.notify or trying to set requestNamespace.
  1. Please derive the CustomConsoleLogger.
  2. Please override the getRequestNameSpace & notify methods.
**/

const LOG_LEVELS = {
  /* STANDARD LOG LEVELS */
  OFF: 0 /* 00000000 */,
  FATAL: 100,
  ERROR: 200,
  WARN: 300,
  INFO: 400,
  DEBUG: 500,
  TRACE: 600,
  ALL: Number.MAX_SAFE_INTEGER
};

const ENV_VAR_NAME = 'OST_LOG_LEVEL';

/* Indexes below are from right to left. */
const LoggerMethodToLevelMap = {
  notify: LOG_LEVELS.FATAL,
  error: LOG_LEVELS.ERROR,
  warn: LOG_LEVELS.WARN,
  info: LOG_LEVELS.INFO,
  step: LOG_LEVELS.INFO,
  win: LOG_LEVELS.INFO,
  debug: LOG_LEVELS.DEBUG,
  log: LOG_LEVELS.DEBUG,
  dir: LOG_LEVELS.DEBUG,
  trace: LOG_LEVELS.TRACE
};

const CONSOLE_RESET = '\x1b[0m',
  ERR_PRE = '\x1b[31m', //Error. (RED)
  NOTE_PRE = '\x1b[91m', //Notify Error. (Purple)
  INFO_PRE = '\x1b[35m', //Info (Magenta)
  WIN_PRE = '\x1b[32m', //Success (GREEN)
  LOG_PRE = CONSOLE_RESET, //Log (Default Console Color)
  DEBUG_PRE = '\x1b[36m', //Debug log (Cyan)
  WARN_PRE = '\x1b[43m\x1b[30m',
  STEP_PRE = '\x1b[34m',
  DIR_PRE = '\x1b[36m';

//Other Known Colors
//"\x1b[33m" // (YELLOW)

let DEFAULT_LOG_LEVEL = LOG_LEVELS.ALL;
// Process the Environment Varibale config.
(function() {
  let envVal = process.env[ENV_VAR_NAME];

  // Case 1: Variable not defined.
  if (typeof envVal === 'undefined') {
    return;
  }

  // Case 2: Its might be key defined in LOG_LEVELS.
  let strEnvVal = String(envVal).toUpperCase();
  if (LOG_LEVELS.hasOwnProperty(strEnvVal)) {
    DEFAULT_LOG_LEVEL = LOG_LEVELS[strEnvVal];
    return;
  }

  // Case 3: It might be a number.
  let numEnvVal = Number(envVal);
  if (!isNaN(numEnvVal)) {
    DEFAULT_LOG_LEVEL = numEnvVal;
  }
})();

/**
 * Custom Console Logger
 *
 * @constructor
 */
const CustomConsoleLogger = function(moduleName, logLevel) {
  var oThis = this;

  if (moduleName) {
    oThis.moduleNamePrefix = '[' + moduleName + ']';
  }

  oThis.setLogLevel(logLevel);
};

CustomConsoleLogger.LOG_LEVELS = LOG_LEVELS;
CustomConsoleLogger.LoggerMethodToLevelMap = LoggerMethodToLevelMap;

CustomConsoleLogger.prototype = {
  constructor: CustomConsoleLogger,

  logLevel: DEFAULT_LOG_LEVEL,
  setLogLevel: function(logLevel) {
    const oThis = this;

    const debugLog = CustomConsoleLogger.prototype.log;

    if (isNaN(logLevel)) {
      logLevel = String(logLevel).toUpperCase();
      DEBUG && debugLog.call(oThis, 'logLevel set to ', logLevel);
      if (LOG_LEVELS.hasOwnProperty(logLevel)) {
        logLevel = LOG_LEVELS[logLevel];
      } else {
        DEBUG && debugLog.call(oThis, 'logLevel', logLevel, ' NOT FOUND! ', LOG_LEVELS);
        logLevel = DEFAULT_LOG_LEVEL;
      }
    }

    logLevel = oThis.logLevel = Number(logLevel);

    //set the logging methods on self.
    oThis.setLoggingMethods();

    return logLevel;
  },

  setLoggingMethods: function() {
    const debugLog = CustomConsoleLogger.prototype.log;

    const oThis = this;

    const logLevel = oThis.logLevel,
      doNothing = oThis.doNothing;

    var fnName, fnLogLevel;

    for (fnName in LoggerMethodToLevelMap) {
      if (!LoggerMethodToLevelMap.hasOwnProperty(fnName)) {
        DEBUG && debugLog.call(oThis, 'fnName', fnName, 'ignored');
        continue;
      }

      fnLogLevel = LoggerMethodToLevelMap[fnName];

      if (fnLogLevel > logLevel) {
        //Set it to doNothing
        oThis[fnName] = doNothing;
        DEBUG && debugLog.call(oThis, 'fnName', fnName, 'set to doNothing');
      } else {
        //Set it to original method.
        oThis[fnName] = CustomConsoleLogger.prototype[fnName];
        DEBUG && debugLog.call(oThis, 'fnName', fnName, 'set to prototype');
      }
    }
  },

  /**
   * @ignore
   *
   * @constant {string}
   */
  STEP_PRE: STEP_PRE,

  /**
   * @ignore
   *
   * @constant {string}
   */
  WARN_PRE: WARN_PRE,

  /**
   * @ignore
   *
   * @constant {string}
   */
  LOG_PRE: LOG_PRE,

  /**
   * @ignore
   *
   * @constant {string}
   */
  DEBUG_PRE: DEBUG_PRE,

  /**
   * @ignore
   *
   * @constant {string}
   */
  DIR_PRE: DIR_PRE,

  /**
   * @ignore
   *
   * @constant {string}
   */
  WIN_PRE: WIN_PRE,

  /**
   * @ignore
   *
   * @constant {string}
   */
  INFO_PRE: INFO_PRE,

  /**
   * @ignore
   *
   * @constant {string}
   */
  ERR_PRE: ERR_PRE,

  /**
   * @ignore
   *
   * @constant {string}
   */
  NOTE_PRE: NOTE_PRE,

  /**
   * @ignore
   *
   * @constant {string}
   */
  CONSOLE_RESET: CONSOLE_RESET,

  getRequestNameSpace: function() {
    //To-be overridden by derived class.
    return null;
  },

  //Method to Log Request Started.
  requestStartLog: function(requestUrl, requestType) {
    const oThis = this,
      d = new Date(),
      dateTime =
        d.getFullYear() +
        '-' +
        (d.getMonth() + 1) +
        '-' +
        d.getDate() +
        ' ' +
        d.getHours() +
        ':' +
        d.getMinutes() +
        ':' +
        d.getSeconds() +
        '.' +
        d.getMilliseconds(),
      message = "Started '" + requestType + "'  '" + requestUrl + "' at " + dateTime;

    oThis.info(message);
  },

  /**
   * Method to convert Process hrTime to Milliseconds
   *
   * @param {number} hrTime - this is the time in hours
   *
   * @return {number} - returns time in milli seconds
   */
  timeInMilli: function(hrTime) {
    return hrTime[0] * 1000 + hrTime[1] / 1000000;
  },

  /**
   * Find out the difference between request start time and complete time
   */
  calculateRequestTime: function() {
    const oThis = this;

    const requestNamespace = oThis.getRequestNameSpace();
    var reqTime = 0;

    if (requestNamespace && requestNamespace.get('startTime')) {
      const hrTime = process.hrtime();
      reqTime = oThis.timeInMilli(hrTime) - oThis.timeInMilli(requestNamespace.get('startTime'));
    }
    return reqTime;
  },

  //Method to Log Request Completed.
  requestCompleteLog: function(status) {
    const oThis = this,
      message = "Completed '" + status + "' in " + oThis.calculateRequestTime() + 'ms';

    oThis.info(message);
  },

  /**
   * Method to append Request in each log line.
   *
   * @param {string} message
   */
  moduleNamePrefix: '',
  getPrefix: function(prefix) {
    const oThis = this;
    var newMessage = pIdPrexfix;

    const requestNamespace = oThis.getRequestNameSpace();
    if (requestNamespace) {
      if (requestNamespace.get('reqId')) {
        newMessage += '[' + requestNamespace.get('reqId') + ']';
      }
    }

    var hrTime = process.hrtime();
    newMessage += '[' + oThis.timeInMilli(hrTime) + ']' + oThis.moduleNamePrefix + prefix;
    return newMessage;
  },

  /**
   * Log level fatal/off methods
   */
  doNothing: function() {
    //Do Nothing.
  },

  /**
   * Log level error methods
   */
  error: function() {
    var oThis = this;

    var argsPassed = oThis._filterArgs(arguments);

    var args = [oThis.getPrefix(this.ERR_PRE)];
    args = args.concat(Array.prototype.slice.call(argsPassed));
    args.push(this.CONSOLE_RESET);
    console.log.apply(console, args);
  },

  /**
   * Notify error through email
   */
  notify: function(code, msg, data, backtrace) {
    var oThis = this;

    var argsPassed = oThis._filterArgs(arguments);

    var args = [oThis.getPrefix(this.NOTE_PRE)];
    args = args.concat(Array.prototype.slice.call(argsPassed));
    args.push(this.CONSOLE_RESET);
    console.log.apply(console, args);
  },
  /**
   * Log level warn methods
   */
  warn: function() {
    var oThis = this;

    var argsPassed = oThis._filterArgs(arguments);

    var args = [oThis.getPrefix(this.WARN_PRE)];
    args = args.concat(Array.prototype.slice.call(argsPassed));
    args.push(this.CONSOLE_RESET);
    console.log.apply(console, args);
  },
  /**
   * Log level info methods
   */
  info: function() {
    var oThis = this;

    var argsPassed = oThis._filterArgs(arguments);

    var args = [oThis.getPrefix(this.INFO_PRE)];
    args = args.concat(Array.prototype.slice.call(argsPassed));
    args.push(this.CONSOLE_RESET);
    console.log.apply(console, args);
  },

  /**
   * Log step
   */
  step: function() {
    var oThis = this;

    var argsPassed = oThis._filterArgs(arguments);

    var args = [oThis.getPrefix(this.STEP_PRE)];
    args = args.concat(Array.prototype.slice.call(argsPassed));
    args.push(this.CONSOLE_RESET);
    console.log.apply(console, args);
  },

  /**
   * Log win - on done
   */
  win: function() {
    var oThis = this;

    var argsPassed = oThis._filterArgs(arguments);

    var args = [oThis.getPrefix(this.WIN_PRE)];
    args = args.concat(Array.prototype.slice.call(argsPassed));
    args.push(this.CONSOLE_RESET);
    console.log.apply(console, args);
  },

  /**
   * Log level debug methods
   */
  log: function() {
    var oThis = this;

    var argsPassed = oThis._filterArgs(arguments);

    var args = [oThis.getPrefix(this.LOG_PRE)];
    args = args.concat(Array.prototype.slice.call(argsPassed));
    args.push(this.CONSOLE_RESET);
    console.log.apply(console, args);
  },

  debug: function() {
    var oThis = this;

    var argsPassed = oThis._filterArgs(arguments);

    var args = [oThis.getPrefix(this.DEBUG_PRE)];
    args = args.concat(argsPassed);
    args.push(this.CONSOLE_RESET);
    console.log.apply(console, args);
  },

  /**
   * Log level trace methods
   */
  trace: function() {
    var oThis = this;

    var argsPassed = oThis._filterArgs(arguments);

    var args = [oThis.getPrefix(this.ERR_PRE)];
    args = args.concat(Array.prototype.slice.call(argsPassed));
    console.trace.apply(console, args);
    console.log(this.CONSOLE_RESET);
  },

  dir: function(obj) {
    var oThis = this;
    var args = [oThis.getPrefix(this.DIR_PRE)];
    console.log.apply(console, args);
    console.dir(obj);
    console.log(this.CONSOLE_RESET);
  },

  testLogger: function() {
    const oThis = this,
      logMeObj = { l1: { l2: { l3Val: 'val3', l3: { l4Val: { val: 'val' } } } } };

    console.log('Testing Basic Methods');
    try {
      oThis.step('step Invoked', logMeObj);
      oThis.info('info Invoked', logMeObj);
      oThis.error('error called', logMeObj);
      oThis.warn('warn called', logMeObj);
      oThis.win('win called', logMeObj);
      oThis.log('log called', logMeObj);
      oThis.debug('debug called::', logMeObj);
      oThis.trace('trace called', logMeObj);
      oThis.dir({ l1: { l2: { l3Val: 'val3', l3: { l4Val: { val: 'val' } } } } });
    } catch (e) {
      console.error('Basic Test Failed. Error:\n', e);
      return;
    }
    console.log('All Basic Test Passed!');
  },

  _filterArgs: function(args) {
    var argsPassed = [],
      currArg,
      i;
    for (i = 0; i < args.length; i++) {
      currArg = args[i];
      if (!(currArg instanceof Error) && (currArg instanceof Object)) {
        currArg = JSON.stringify(currArg);
      }
      argsPassed.push(currArg);
    }

    return argsPassed;
  }
};

module.exports = CustomConsoleLogger;
