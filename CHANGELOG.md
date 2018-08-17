## OpenST-Base v0.9.3
- Common style guide followed across all openst repos using prettier ([openst-base#30](https://github.com/OpenSTFoundation/openst-base/issues/30)).
- Error object was earlier getting logged as {} in the custom logger. Fixed this issue.

## OpenST-Base v0.9.1
- If an object is passed for logging, it is logged after doing JSON stringify. This support was added to all the logging methods.

## OpenST-Base v0.9.0 (17 May 2018)
- OpenST Base repository was created and all the common functionality which different openst modules need were moved to it. Example - Logger, response helper, promise context, promise queue manager and web3.
- Log level support was introduced and non-important logs were moved to debug log level.
- Standardized error codes are now being used in OpenST Base.
