# OpenST Base - Collection of Utilities & Helpers used by [OpenST network](https://simpletoken.org)

While OpenST 0.9 is available as-is for anyone to use, we caution that this is early stage software and under heavy ongoing development and improvement. Please report bugs and suggested improvements.

# Install OpenST Payments

```bash
npm install @openstfoundation/openst-base --save
```



# OSTWeb3 Usage
```bash
const OSTBase    = require('@openstfoundation/openst-base')
    , wsEndPoint = "ws://127.0.0.1:8546"
    , httpEndPoint = "http://127.0.0.1:8545"
;

// The below instance of web3 uses OstWSProvider.
// OstWSProvider automatically tries to reconnect when connection is broken.
let wsWeb3 = new OSTBase.OSTWeb3( wsEndPoint );

// The below instance is same as new Web3( httpEndPoint );
let httpWeb3 = new OSTBase.OSTWeb3( httpEndPoint );


```

# PromiseQueueManager Usage
```bash
const OSTBase = require('@openstfoundation/openst-base')
    , logger  = new OSTBase.Logger("my_module_name")
;

const queueManagerOptions = {
  // Specify the name for easy identification in logs.
  name: "my_module_name_promise_queue"

  // resolvePromiseOnTimeout :: set this flag to false if you need custom handling.
  // By Default, the manager will neither resolve nor reject the Promise on time out.
  , resolvePromiseOnTimeout: false
  // The value to be passed to resolve when the Promise has timedout.
  , resolvedValueOnTimeout: null

  // rejectPromiseOnTimeout :: set this flag to true if you need custom handling.
  , rejectPromiseOnTimeout : false

  //  Pass timeoutInMilliSecs in options to set the timeout.
  //  If less than or equal to zero, timeout will not be observed.
  , timeoutInMilliSecs: 5000

  //  Pass maxZombieCount in options to set the max acceptable zombie count.
  //  When this zombie promise count reaches this limit, onMaxZombieCountReached will be triggered.
  //  If less than or equal to zero, onMaxZombieCountReached callback will not triggered.
  , maxZombieCount: 0

  //  Pass logInfoTimeInterval in options to log queue healthcheck information.
  //  If less than or equal to zero, healthcheck will not be logged.
  , logInfoTimeInterval : 0


  , onPromiseResolved: function ( resolvedValue, promiseContext ) {
    //onPromiseResolved will be executed when the any promise is resolved.
    //This callback method should be set by instance creator.
    //It can be set using options parameter in constructor.
    const oThis = this;

    logger.log(oThis.name, " :: a promise has been resolved. resolvedValue:", resolvedValue);
  }

  , onPromiseRejected: function ( rejectReason, promiseContext ) {
    //onPromiseRejected will be executed when the any promise is timedout.
    //This callback method should be set by instance creator.
    //It can be set using options parameter in constructor.
    const oThis = this;

    logger.log(oThis.name, " :: a promise has been rejected. rejectReason: ", rejectReason);
  }

  , onPromiseTimedout: function ( promiseContext ) {
    //onPromiseTimedout will be executed when the any promise is timedout.
    //This callback method should be set by instance creator.
    //It can be set using options parameter in constructor.
    const oThis = this;

    logger.log(oThis.name, ":: a promise has timed out.", promiseContext.executorParams);
  }

  , onMaxZombieCountReached: function () {
    //onMaxZombieCountReached will be executed when maxZombieCount >= 0 && current zombie count (oThis.zombieCount) >= maxZombieCount.
    //This callback method should be set by instance creator.
    //It can be set using options parameter in constructor.
    const oThis = this;

    logger.log(oThis.name, ":: maxZombieCount reached.");

  }

  , onPromiseCompleted: function ( promiseContext ) {
    //onPromiseCompleted will be executed when the any promise is removed from pendingPromise queue.
    //This callback method should be set by instance creator.
    //It can be set using options parameter in constructor.
    const oThis = this;

    logger.log(oThis.name, ":: a promise has been completed.");
  }  
  , onAllPromisesCompleted: function () {
    //onAllPromisesCompleted will be executed when the last promise in pendingPromise is resolved/rejected.
    //This callback method should be set by instance creator.
    //It can be set using options parameter in constructor.
    //Ideally, you should set this inside SIGINT/SIGTERM handlers.

    logger.log("Examples.allResolve :: onAllPromisesCompleted triggered");
    manager.logInfo();
  }
};


const promiseExecutor = function ( resolve, reject, params, promiseContext ) {
  //promiseExecutor
  setTimeout(function () {
    resolve( params.cnt ); // Try different things here.
  }, 1000);
}

const manager = new OSTBase.OSTPromise.QueueManager( promiseExecutor, queueManagerOptions);

for( var cnt = 0; cnt < 50; cnt++ ) {
  manager.createPromise( {"cnt": (cnt + 1) } );
}

```


# OpenST Logger Usage
```bash
const OSTBase = require('@openstfoundation/openst-base')
    , Logger  = OSTBase.Logger
    , logger  = new Logger("my_module_name", Logger.LOG_LEVELS.TRACE)
;

//Log Level FATAL 
logger.notify("notify called");

//Log Level ERROR
logger.error("error called");

//Log Level WARN
logger.warn("warn called");

//Log Level INFO
logger.info("info Invoked");
logger.step("step Invoked");
logger.win("win called");

//Log Level DEBUG
logger.log("log called");
logger.debug("debug called");
logger.dir({ l1: { l2 : { l3Val: "val3", l3: { l4Val: { val: "val"  }}} }});

//Log Level TRACE
logger.trace("trace called");


```
All methods will be available for use irrespcetive of configured log level.
Log Level only controls what needs to be logged.

### Method to Log Level Map
| Method | Enabling Log Level |
| :----- | :----------------- |
| notify | FATAL |
| error | ERROR |
| warn | WARN |
| info | INFO |
| step | INFO |
| win | INFO |
| debug | DEBUG |
| log | DEBUG |
| dir | DEBUG |
| trace | TRACE |
