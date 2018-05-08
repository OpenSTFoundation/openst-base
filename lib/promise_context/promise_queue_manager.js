"use strict";

const rootPrefix  = "../.."
    , PromiseContext = require(rootPrefix + "/lib/promise_context/promise_context")
    , Logger = require(rootPrefix + "/lib/logger/custom_console_logger")
;

const logMe           = false
    , verboseLog      = logMe && true
    , defaultTimeout  = 30000
    , logger          = new Logger("PromiseQueueManager")
;


const Manager = module.exports = function ( promiseExecutor, options ) {
  const oThis = this;

  //Take Care of Options
  options = options || {};
  Object.assign(oThis, options);

  oThis.promiseExecutor = promiseExecutor || oThis.promiseExecutor;
  oThis.pendingPromises = oThis.pendingPromises || [];
  oThis.completedPromises = oThis.completedPromises || [];

  if ( !oThis.name ) {
    oThis.name = "PQM_" + Date.now();
  }
  oThis.logHealthCheckIfNeeded();
};


Manager.prototype = {
  constructor: Manager

  // Specify the name for easy identification in logs.
  , name: ""
  
  //Executor method to be passed on to Promise Constructor
  , promiseExecutor: null

  // resolvePromiseOnTimeout :: set this flag to false if you need custom handling.
  // By Default, the manager will neither resolve nor reject the Promise on time out.
  , resolvePromiseOnTimeout: false
  // The value to be passed to resolve when the Promise has timedout.
  , resolvedValueOnTimeout: null

  // rejectPromiseOnTimeout :: set this flag to true if you need custom handling.
  , rejectPromiseOnTimeout : false
  // The reason with which Promise has to be rejected when the Promise has timedout.
  , rejectedReasonOnTimeout : "Promise has timed out"

  //  Pass timeoutInMilliSecs in options to set the timeout.
  //  If less than or equal to zero, timeout will not be observed.
  , timeoutInMilliSecs: defaultTimeout

  //  Pass maxZombieCount in options to set the max acceptable zombie count.
  //  When this zombie promise count reaches this limit, onMaxZombieCountReached will be triggered.
  //  If less than or equal to zero, onMaxZombieCountReached callback will not triggered.
  , maxZombieCount: 0

  //  Pass logInfoTimeInterval in options to log queue healthcheck information.
  //  If less than or equal to zero, healthcheck will not be logged.
  , logInfoTimeInterval : 3 * 1000


  , onPromiseResolved: function ( resolvedValue, promiseContext ) {
    //onPromiseResolved will be executed when the any promise is resolved.
    //This callback method should be set by instance creator.
    //It can be set using options parameter in constructor.
    const oThis = this;

    verboseLog && logger.log(oThis.name, " :: a promise has been resolved. resolvedValue:", resolvedValue);
  }

  , onPromiseRejected: function ( rejectReason, promiseContext ) {
    //onPromiseRejected will be executed when the any promise is timedout.
    //This callback method should be set by instance creator.
    //It can be set using options parameter in constructor.
    const oThis = this;

    verboseLog && logger.log(oThis.name, " :: a promise has been rejected. rejectReason: ", rejectReason);
  }

  , onPromiseTimedout: function ( promiseContext ) {
    //onPromiseTimedout will be executed when the any promise is timedout.
    //This callback method should be set by instance creator.
    //It can be set using options parameter in constructor.
    const oThis = this;

    verboseLog && logger.log(oThis.name, ":: a promise has timed out.", promiseContext.executorParams);
  }

  , onMaxZombieCountReached: function () {
    //onMaxZombieCountReached will be executed when maxZombieCount >= 0 && current zombie count (oThis.zombieCount) >= maxZombieCount.
    //This callback method should be set by instance creator.
    //It can be set using options parameter in constructor.
    const oThis = this;

    verboseLog && logger.log(oThis.name, ":: maxZombieCount reached.");

  }

  , onPromiseCompleted: function ( promiseContext ) {
    //onPromiseCompleted will be executed when the any promise is removed from pendingPromise queue.
    //This callback method should be set by instance creator.
    //It can be set using options parameter in constructor.
    const oThis = this;

    verboseLog && logger.log(oThis.name, ":: a promise has been completed.");
  }  

  //onAllPromisesCompleted will be executed when the last promise in pendingPromise is resolved/rejected.
  //This callback method should be set by instance creator.
  //It can be set using options parameter in constructor.
  //Ideally, you should set this inside SIGINT/SIGTERM handlers.
  
  , onAllPromisesCompleted: null

  , createPromise: function ( executorParams ) {
    //Call this method to create a new promise.

    const oThis = this;


    const executor        = oThis.promiseExecutor
        , pcOptions       = oThis.getPromiseContextOptions()
        , newPC           = new PromiseContext( executor, pcOptions, executorParams )
    ;


    oThis.createdCount ++;
    oThis.pendingPromises.push( newPC );

    return newPC.promise;
  }

  , getPendingCount: function () {
    const oThis = this;

    return oThis.pendingPromises.length;
  }

  , getCompletedCount: function () {
    const oThis = this;

    return oThis.completedCount;
  }


  // Arrays/Queues to hold Promise Context.
  , pendingPromises: null
  , completedPromises: null

  // Some Stats.
  , createdCount    : 0
  , resolvedCount   : 0
  , rejectedCount   : 0
  , zombieCount     : 0
  , timedOutCount   : 0
  , completedCount  : 0

  // Some flags
  , hasTriggeredMaxZombieCallback: false

  , pcOptions       : null
  , getPromiseContextOptions: function () {
    const oThis = this;

    oThis.pcOptions = oThis.pcOptions || {
      resolvePromiseOnTimeout   : oThis.resolvePromiseOnTimeout
      , rejectPromiseOnTimeout  : oThis.rejectPromiseOnTimeout
      , resolvedValueOnTimeout  : oThis.resolvedValueOnTimeout
      , rejectedReasonOnTimeout : oThis.rejectedReasonOnTimeout
      , timeoutInMilliSecs      : oThis.timeoutInMilliSecs
      , onResolved  : function () {
        oThis._onResolved.apply( oThis, arguments );
      }
      , onRejected  : function () {
        oThis._onRejected.apply( oThis, arguments );
      }
      , onTimedout  : function () {
        oThis._onTimedout.apply( oThis, arguments );
      }
      , onCompletedAfterTimeout : function () {
        oThis._onCompletedAfterTimeout.apply( oThis, arguments );
      }
    };

    return oThis.pcOptions;
  }

  , _onResolved: function ( resolvedValue, promiseContext ) {
    const oThis = this;

    //Give a callback.
    //Dev-Note: Can this be inside settimeout ?
    if ( oThis.onPromiseResolved ) {
      oThis.onPromiseResolved.apply(oThis, arguments);
    }

    //Update the stats.
    oThis.resolvedCount ++;

    //Mark is Completed.
    oThis.markAsCompleted( promiseContext );
  }
  , _onRejected: function ( rejectReason, promiseContext ) {
    const oThis = this;

    //Give a callback.
    //Dev-Note: Can this be inside settimeout ?
    if ( oThis.onPromiseRejected ) {
      oThis.onPromiseRejected.apply(oThis, arguments);
    }

    //Update the stats.
    oThis.rejectedCount ++;

    //Mark is Completed.
    oThis.markAsCompleted( promiseContext );
  }
  , _onTimedout: function ( promiseContext ) {
    const oThis = this;

    const maxZombieCount  = oThis.maxZombieCount;

    //Update the stats.
    oThis.timedOutCount ++;

    logMe && logger.log(oThis.name, ":: _onTimedout :: promise has timedout");

    //Give a callback.
    //Dev-Note: This callback should not be triggered inside setTimeout.
    //Give the instance creator a chance to do something with promiseContext.
    if ( oThis.onPromiseTimedout ) {
      oThis.onPromiseTimedout.apply(oThis, arguments);
    }

    //Update the zombie count only if resolve and reject on timeout are false.
    if( !oThis.resolvePromiseOnTimeout && !oThis.rejectPromiseOnTimeout ){
      oThis.zombieCount++;
    }

    //Mark is Completed.
    oThis.markAsCompleted( promiseContext );


    // Check if we have reached max zombie count.
    if (  oThis.onMaxZombieCountReached 
      && !oThis.hasTriggeredMaxZombieCallback 
      && !isNaN( maxZombieCount )
      &&  maxZombieCount > 0
      &&  oThis.zombieCount >= maxZombieCount
    ) {
      oThis.hasTriggeredMaxZombieCallback = true;
      oThis.onMaxZombieCountReached();
    }
  }

  , _onCompletedAfterTimeout: function ( promiseContext ) {
    const oThis = this;
    logMe && logger.log(oThis.name, ":: _onCompletedAfterTimeout :: promise has completed after the assumed timeout. Updating timedOutCount & zombieCount (if applicable) ");

    // Update the stats.
    oThis.timedOutCount --;

    // Update the zombie count only if resolve and reject on timeout are false.
    if( !oThis.resolvePromiseOnTimeout && !oThis.rejectPromiseOnTimeout ){
      oThis.zombieCount--;
    }
    oThis.logInfo();
  }

  , markAsCompleted: function ( promiseContext ) {
    const oThis = this;

    const pendingPromises   = oThis.pendingPromises
        , completedPromises = oThis.completedPromises
        , pcIndx = pendingPromises.indexOf( promiseContext )
    ;
    if ( pcIndx < 0 ) {
      logger.trace(oThis.name + " :: markAsCompleted :: Could not find a promiseContext. _onCompletedAfterTimeout should trigger soon. ");
      verboseLog && logger.log( promiseContext );
      return;
    }

    //Remove it from queue.
    pendingPromises.splice(pcIndx, 1);
    oThis.completedCount ++;

    if ( oThis.onPromiseCompleted ) {
      oThis.onPromiseCompleted.apply(oThis, arguments);
    }

    if ( !pendingPromises.length && oThis.onAllPromisesCompleted ) {
      oThis.onAllPromisesCompleted();
    }
  }
  , isValid: function () {
    const oThis = this;

    const pendingCount    = oThis.getPendingCount()
        , createdCount    = oThis.createdCount
        , completedCount  = oThis.completedCount
        , resolvedCount   = oThis.resolvedCount
        , rejectedCount   = oThis.rejectedCount
        , zombieCount     = oThis.zombieCount
    ;

    var isValid = ( completedCount === ( resolvedCount + rejectedCount + zombieCount) );
    isValid = isValid && ( createdCount === ( pendingCount + completedCount ) );
    
    if ( isValid ) {
      logMe && logger.log(oThis.name, ":: isValid :: Queue is valid.");
    } else {
      logger.error("IMPORTANT ::", oThis.name , ":: validation failed!");
    }

    return isValid;
  }
  , logInfo: function () {
    const oThis = this;

    const pendingCount    = oThis.getPendingCount()
        , createdCount    = oThis.createdCount
        , completedCount  = oThis.completedCount
        , resolvedCount   = oThis.resolvedCount
        , rejectedCount   = oThis.rejectedCount
        , timedOutCount   = oThis.timedOutCount
        , zombieCount     = oThis.zombieCount
        , isValid         = oThis.isValid()
    ;

    logger.log(oThis.name, ":: logInfo ::"
      , "createdCount:", createdCount
      , "pendingCount:", pendingCount
      , "completedCount:", completedCount
      , "resolvedCount:", resolvedCount
      , "rejectedCount:", rejectedCount
      , "zombieCount:", zombieCount
      , "timedOutCount:", timedOutCount
      , "isValid:", isValid
    );
  }

  , logHealthCheckIfNeeded : function () {
    var oThis =  this
      , timeOut = oThis.logInfoTimeInterval
    ;
    if( timeOut < 1) {
      return
    }
    setTimeout( function () {
      oThis.logInfo();
      oThis.logHealthCheckIfNeeded();
    } , timeOut ) ;
  }

  , someMethod : function () {

  }

}

Manager.Examples = {
  allResolve : function ( len ) {
    len = len || 50;

    const manager = new Manager(function ( resolve, reject ) {
      //promiseExecutor
      setTimeout(function () {
        resolve( len-- );
      }, 1000);
    }
    , {
      onAllPromisesCompleted: function () {
        logger.log("Examples.allResolve :: onAllPromisesCompleted triggered");
        manager.logInfo();
      }
      , timeoutInMilliSecs : 5000
      , logInfoTimeInterval: 0
    });

    for( var cnt = 0; cnt < len; cnt++ ) {
      manager.createPromise( {"cnt": (cnt + 1) } );
    }
  },

  allReject: function ( len ) {
    len = len || 50;

    const manager = new Manager(function ( resolve, reject ) {
      //promiseExecutor
      setTimeout(function () {
        reject( len-- );
      }, 1000);
    }
    , {
      onAllPromisesCompleted: function () {
        logger.log("Examples.allReject :: onAllPromisesCompleted triggered");
        manager.logInfo();
      }
      , timeoutInMilliSecs : 5000
      , logInfoTimeInterval: 0
    });

    for( var cnt = 0; cnt < len; cnt++ ) {
      manager.createPromise( {"cnt": (cnt + 1) } ).catch( function ( reason ) {
        logger.log("Examples.allReject :: promise catch triggered.");
      });
    }
  },

  allTimeout: function ( len ) {
    len = len || 50;

    const manager = new Manager(function ( resolve, reject ) {
      //promiseExecutor
      setTimeout(function () {
        resolve( len-- );
      }, 10000);
    }
    , {
      onAllPromisesCompleted: function () {
        logger.log("Examples.allResolve :: onAllPromisesCompleted triggered");
        manager.logInfo();
      }
      , timeoutInMilliSecs : 5000
      , logInfoTimeInterval: 0
    });

    for( var cnt = 0; cnt < len; cnt++ ) {
      manager.createPromise( {"cnt": (cnt + 1) } ).catch();
    }
  },

  executorWithParams: function ( len ) {
    len = len || 50;

    const manager = new Manager(function ( resolve, reject, params ) {
      //promiseExecutor
      setTimeout(function () {
        resolve( params );
      }, 1000);
    }
    , {
      onAllPromisesCompleted: function () {
        logger.log("Examples.executorWithParams :: onAllPromisesCompleted triggered");
        manager.logInfo();
      }
      , timeoutInMilliSecs : 5000
      , logInfoTimeInterval: 0
    });

    for( var cnt = 0; cnt < len; cnt++ ) {
      manager.createPromise( {"cnt": (cnt + 1) } );
    }
  },

  maxZombieCount: function ( len ) {
    len = len || 50;

    const maxZombieCount = Math.round(len * 0.1 )
        , _timeout  = 3000
    ;

    const manager = new Manager(function ( resolve, reject, params ) {
      //Do Nothing.

    }
    , {
      onAllPromisesCompleted: function () {
        logger.log("Examples.executorWithParams :: onAllPromisesCompleted triggered");
        manager.logInfo();
      }
      , timeoutInMilliSecs : 5000
      , logInfoTimeInterval: 0
      , maxZombieCount: maxZombieCount
      , onMaxZombieCountReached: function () {
        logger.win("Examples.maxZombieCount :: onMaxZombieCountReached triggered. current zombieCount", manager.zombieCount, "maxZombieCount", manager.maxZombieCount );
      }
    });

    for( var cnt = 0; cnt < len; cnt++ ) {
      manager.createPromise( {"cnt": (cnt + 1) } );
    }
  }  
}