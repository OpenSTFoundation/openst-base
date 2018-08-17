'use strict';

const Events = require('events'),
  WebsocketProvider = require('web3-providers-ws'),
  W3CWebSocket = require('websocket').w3cwebsocket;

const rootPrefix = '../..',
  Logger = require(rootPrefix + '/lib/logger/custom_console_logger');

const logger = new Logger('OstWSProvider'),
  verboseLog = false;

// Constructor
const OstWSProvider = (module.exports = function(url, i_d_k, options) {
  const oThis = this;

  //Note Down url
  oThis.endPointUrl = url;

  //Take Care of Options
  oThis.options = Object.assign({}, OstWSProvider.DefaultOptions, options || {});

  //Create Event Emiter.
  oThis.eventEmitter = new Events.EventEmitter();
  oThis.eventEmitter.setMaxListeners(oThis.options.emitterMaxListeners);

  //Call the baseclass constructor with arguments.
  return WebsocketProvider.apply(oThis, arguments) || oThis;
});

// BEGIN : Static Stuff
//Default Options
OstWSProvider.DefaultOptions = {
  maxReconnectTries: 100,
  reconnectInterval: 500 /* Miliseconds */,
  killOnReconnectFailure: true,
  emitterMaxListeners: 100
};

/*
  ManagedEventsMap holds meta info of connection callback to manage. 
  Description of meta:
    key: Managed Event Name. Name of event to emit. E.g. "end" when connection ends. (Note: web3js decides this).
    value: Object with following properties
      event:  Managed Event Name (Same as key). This is useful to change the emmited event name. Can also be set to null if you wish to prevent emiting event.
      callback: Function Name of callback. E.g: "onclose" for connection.onclose
      ostCallback: Function Name of OstWSProvider callback. E.g. "onConnectionClose" for OstWSProvider.prototype.onConnectionClose
*/
OstWSProvider.ManagedEventsMap = {
  connect: { managedEvent: 'connect', callback: 'onopen', ostCallback: 'onConnectionOpen' },
  end: { managedEvent: 'end', callback: 'onclose', ostCallback: 'onConnectionClose' },
  error: { managedEvent: 'error', callback: 'onerror', ostCallback: 'onConnectionError' },
  dead: { managedEvent: 'dead', callback: null, ostCallback: null }
};

//An array of Managed Event Names. (Useful to automate the code).
OstWSProvider.ManagedEvents = Object.keys(OstWSProvider.ManagedEventsMap);

// END: Static Stuff

// BEGIN : Prototype Stuff Begins
// Derive the prototype.
OstWSProvider.prototype = Object.create(WebsocketProvider.prototype);

// BEGIN : Declare new props if needed.
// These properties will be initialised by constructor.
OstWSProvider.prototype.endPointUrl = null;
OstWSProvider.prototype.eventEmitter = null;
OstWSProvider.prototype.options = null;
// END: New Props.

// BEGIN : Declare New Methods if needed.
// Helper Method to emit event.
OstWSProvider.prototype.emitEvent = function(eventName, args) {
  const oThis = this;

  // Check if we have listeners. This check is important for 'error' event.
  const eventNames = oThis.eventEmitter.eventNames();
  if (eventNames.indexOf(eventName) < 0) {
    verboseLog && logger.log('emitEvent :: no listener for', eventName, 'event');
    return;
  }

  if (args) {
    //args will most-likely be arguments. Convert it into array.
    args = Array.from(args);
  }
  args.unshift(eventName);
  oThis.eventEmitter.emit.apply(oThis.eventEmitter, args);
};

OstWSProvider.prototype.onConnectionOpen = function() {
  const oThis = this;
  logger.win('WebSocket Connection established with endpoint', oThis.endPointUrl);
};

OstWSProvider.prototype.onConnectionClose = function() {
  const oThis = this;
  logger.warn('WebSocket Connection with endpoint', oThis.endPointUrl, ' has closed. Trying to reconnect.');

  //Reconnector instances are use once only. No need to retain the instance.
  new Reconnector(oThis);
};

OstWSProvider.prototype.onConnectionError = function(err) {
  const oThis = this;
  logger.warn('WebSocket Connection with endpoint ', oThis.endPointUrl, ' threw an error');
  console.log('WebSocket Connection Error', err);
};

OstWSProvider.prototype.onReconnected = function() {
  const oThis = this;
  logger.win('Reconnected with endpoint ', oThis.endPointUrl);
};

OstWSProvider.prototype.onReconnectFailed = function() {
  const oThis = this;

  logger.error('Failed to reconnect WebSocket with endpoint ', oThis.endPointUrl);

  //Emit Dead Event
  oThis.emitEvent('dead', [oThis]);

  if (oThis.options.killOnReconnectFailure) {
    logger.warn('Shutting down proccess');
    process.kill(process.pid, 'SIGTERM');
  }
};

// END: New Methods.

// BEGIN : Override methods as needed.
//addDefaultEvents
const _base_addDefaultEvents = WebsocketProvider.prototype.addDefaultEvents;
OstWSProvider.prototype.addDefaultEvents = function() {
  const oThis = this;

  //Call the super method.
  _base_addDefaultEvents.apply(oThis, arguments);

  const connection = oThis.connection;

  //Meta Info of connection callback to manage.
  var eventMeta,
    //Name of event to emit. E.g. "end" when connection ends. (Note: web3js decides this).
    eventName,
    // Same as eventName, but, is read from managedEvent.
    // This is useful to change the emmited event name. Can also be set to null if you wish to prevent emiting event.
    managedEventName,
    //Function Name of callback. E.g: "onclose" for connection.onclose
    connectionCallbackName,
    //Refrence of callback function. E.g: Refrence of connection.onclose
    connectionCallback,
    //Function Name of OstWSProvider callback. E.g. "onConnectionClose" for OstWSProvider.prototype.onConnectionClose
    ostCallbackName;

  for (eventName in OstWSProvider.ManagedEventsMap) {
    eventMeta = OstWSProvider.ManagedEventsMap[eventName];

    connectionCallbackName = eventMeta.callback || 'NO_CALLBACK_NAME';
    connectionCallback = connection[connectionCallbackName];
    managedEventName = eventMeta.managedEvent;
    ostCallbackName = eventMeta.ostCallback || 'NO_CALLBACK_NAME';

    connection[connectionCallbackName] = oThis._wrap_connection_callback(
      managedEventName,
      connectionCallback,
      ostCallbackName
    );
  }
};

OstWSProvider.prototype._wrap_connection_callback = function(managedEventName, connectionCallback, ostCallbackName) {
  const oThis = this;

  //Note: Do NOT move connection inside the coluser function.
  //We always want events to be triggered w.r.t. to corret connection.
  const connection = oThis.connection;

  return function() {
    let ostCallback = oThis[ostCallbackName];

    //IMPORTANT: ORDERING MATTERS HERE. Specially Impacts onclose handler.
    //1. Let the derived class (OstWSProvider) know first about the event.
    ostCallback && ostCallback.apply(oThis, arguments);

    //2. Call the default handling.
    connectionCallback && connectionCallback.apply(connection, arguments);

    logger.log('Emitting ', managedEventName, ' event.');

    //3. Emit the event for rest of the world.
    if (managedEventName) {
      oThis.emitEvent(managedEventName, arguments);
    }
  };
};

const _base_on = WebsocketProvider.prototype.on;
OstWSProvider.prototype.on = function(eventType, callback) {
  const oThis = this;

  if (typeof callback !== 'function') throw new Error('The second parameter callback must be a function.');

  if (OstWSProvider.ManagedEvents.indexOf(eventType) < 0) {
    verboseLog && logger.log('OstWSProvider.prototype.on :: ', eventType, ' is not a managed event');
    //Its not a managed event.
    return _base_on.apply(oThis, arguments);
  } else {
    //Subscribe with eventEmitter.
    verboseLog && logger.log('OstWSProvider.prototype.on :: ', eventType, ' has been added');
    return oThis.eventEmitter.on(eventType, callback);
  }
};
//Alias for OstWSProvider.prototype.on. (NodeJs Standard.)
OstWSProvider.prototype.addListener = OstWSProvider.prototype.on;

const _base_removeListener = WebsocketProvider.prototype.removeListener;
OstWSProvider.prototype.removeListener = function(eventType, callback) {
  const oThis = this;

  if (typeof callback !== 'function') throw new Error('The second parameter callback must be a function.');

  if (OstWSProvider.ManagedEvents.indexOf(eventType) < 0) {
    //Its not a managed event.
    return _base_removeListener.apply(oThis, arguments);
  } else {
    //Unsubscribe with eventEmitter.
    return oThis.eventEmitter.removeListener(eventType, callback);
  }
};

const _base_removeAllListeners = WebsocketProvider.prototype.removeAllListeners;
OstWSProvider.prototype.removeAllListeners = function() {
  const oThis = this;

  //Remove All Managed Listeners.
  oThis.eventEmitter.removeAllListeners.apply(oThis.eventEmitter, arguments);

  //Call Super Method.
  _base_removeAllListeners.apply(oThis, arguments);
};

// END:  Override methods as needed.

const _base_logger_getPrefix = logger.getPrefix;
logger.getPrefix = function() {
  return _base_logger_getPrefix.apply(this, arguments) + '[OstWSProvider]';
};

// Reconnector Class.

const Reconnector = function(iOstWSProvider) {
  const oThis = this;

  oThis.iOstWSProvider = iOstWSProvider;
  oThis.endPointUrl = iOstWSProvider.endPointUrl;
  oThis.notificationCallbacks = iOstWSProvider.notificationCallbacks;

  const options = iOstWSProvider.options;
  Object.assign(oThis, options);

  oThis.reconnect();
};
Reconnector.prototype = {
  constructor: Reconnector,
  maxReconnectTries: 100,
  reconnectInterval: 500,
  retryCount: 0,
  endPointUrl: null,
  notificationCallbacks: null,
  //Instance of OstWSProvider
  iOstWSProvider: null,

  isReconnecting: false,
  reconnect: function() {
    const oThis = this;

    if (oThis.isReconnecting) {
      logger.log('Reconnector :: already trying to reconnect.');
      return false;
    }

    if (oThis.retryCount >= oThis.maxReconnectTries) {
      logger.warn('Reconnector :: maxReconnectTries reached.');
      oThis.failed();
      return false;
    }

    //Lock reconnect
    oThis.isReconnecting = true;
    oThis.retryCount++;
    setTimeout(function() {
      oThis.tryReconnecting();
    }, oThis.reconnectInterval);
    return true;
  },

  tryReconnecting: function() {
    const oThis = this;
    logger.step('Reconnector :: tryReconnecting initiated.');

    var connection;
    try {
      connection = new W3CWebSocket(oThis.endPointUrl);

      connection.onopen = function() {
        oThis.onConnectionOpen(connection);
      };

      connection.onerror = function() {
        oThis.onConnectionError(connection);
      };

      connection.onclose = function() {
        oThis.onConnectionClose(connection);
      };
    } catch (e) {
      //Expecting something errors. Lets log them.
      logger.error('Reconnector :: tryReconnecting :: error ::\n', error);
      throw e;
    }
  },

  onConnectionOpen: function(connection) {
    const oThis = this;
    logger.win('Reconnector :: onConnectionOpen triggered. We have a new connection.');

    const iOstWSProvider = oThis.iOstWSProvider,
      notificationCallbacks = oThis.notificationCallbacks || [];

    //Clean-Up. NOTE: Make sure you have everything with you before you cleanup.
    //Worst-Case: move cleanUp to the end of the method.
    //CleanUp is important to clear refs.
    oThis.cleanUp();

    //Set the new connection onmessage.
    connection.onmessage = iOstWSProvider.connection.onmessage;

    //Set the new connection
    iOstWSProvider.connection = connection;

    //Add default events.
    iOstWSProvider.addDefaultEvents();

    //Add-back notificationCallbacks
    if (iOstWSProvider.notificationCallbacks && iOstWSProvider.notificationCallbacks.length) {
      //Add any new callbacks to notificationCallbacks
      notificationCallbacks.push.apply(notificationCallbacks, iOstWSProvider.notificationCallbacks);
    }

    //Restore notificationCallbacks;
    iOstWSProvider.notificationCallbacks = notificationCallbacks;

    //Tell OstWSProvider that we succeeded :D
    iOstWSProvider.onReconnected(connection);
  },

  onConnectionClose: function() {
    const oThis = this;
    logger.log('Reconnector :: onConnectionClose triggered. Calling reconnect');
    oThis.logStats();
    //Unlock reconnect
    oThis.isReconnecting = false;

    //Reconnect.
    oThis.reconnect();
  },

  onConnectionError: function() {
    const oThis = this;
    logger.log('Reconnector :: onConnectionError triggered. Ignoring it.');
  },

  failed: function() {
    const oThis = this;
    logger.error('Reconnector :: Failed to Reconnect.');

    const iOstWSProvider = oThis.iOstWSProvider;

    //Clean-Up. NOTE: Make sure you have everything with you before you cleanup.
    //Worst-Case: move cleanUp to the end of the method.
    //CleanUp is important to clear refs.
    oThis.cleanUp();

    //Tell OstWSProvider that we failed :-/
    iOstWSProvider.onReconnectFailed();
  },

  logStats: function() {
    const oThis = this;

    logger.info(
      'Reconnector Stats :: ',
      '\n\tretryCount:',
      oThis.retryCount,
      'maxReconnectTries:',
      oThis.maxReconnectTries,
      'reconnectInterval:',
      oThis.reconnectInterval,
      '\n\tendPointUrl: ',
      oThis.endPointUrl,
      'notificationCallbacks.length: ',
      oThis.notificationCallbacks.length
    );
  },

  cleanUp: function() {
    const oThis = this;

    oThis.logStats();

    oThis.iOstWSProvider = null;
    oThis.notificationCallbacks = null;

    // Make sure this instance can-not be used any more.
    // This is done to avoid memory leaks.
    oThis.endPointUrl = null;
    oThis.isReconnecting = true;
    oThis.retryCount = Number.MAX_SAFE_INTEGER;
    oThis.maxReconnectTries = Number.MIN_SAFE_INTEGER;
    oThis.reconnect = null;
    oThis.tryReconnecting = null;
  }
};
