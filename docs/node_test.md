# node_test.js

**Role:** One-off manual test script. Exercises `getTableInfo` from `s3Helpers` and exits.

## Overview

`node_test.js` is a standalone script (not an Express route) used for quick local testing. It calls `getTableInfo` with hardcoded arguments, logs the result, and terminates the process.

## What it does

```js
let resp = getTableInfo('gapguardian_historical_new_trial', "GET_VENDOR_SALES_MANUFACTURING_REPORT__RETAIL_MANUFACTURING_DAY")
console.log(resp)
process.exit(0)
```

1. Imports `getTableInfo` from `s3Helpers.js`.
2. Calls it with table `gapguardian_historical_new_trial` and report type `GET_VENDOR_SALES_MANUFACTURING_REPORT__RETAIL_MANUFACTURING_DAY`.
3. Logs the matching config entry from `gg_table_config.json` to the console.
4. Exits immediately with code `0`.

## Expected output

Based on `gg_table_config.json`, the expected output is:
```json
[
  {
    "report_type": "GET_VENDOR_SALES_MANUFACTURING_REPORT__RETAIL_MANUFACTURING_DAY",
    "days": 0,
    "suffix": "_sellingProgram=RETAIL_distributorView=MANUFACTURING_reportPeriod=DAY.json.gz"
  }
]
```

## How to run

```bash
node node_test.js
```

## Notes

- This file is not imported by any other module and has no effect on the running application.
- It is useful for verifying that `gg_table_config.json` has the correct entries without starting the full server.
