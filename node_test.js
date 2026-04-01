
const { getTableInfo } = require('./s3Helpers')

let resp = getTableInfo('gapguardian_historical_new_trial', "GET_VENDOR_SALES_MANUFACTURING_REPORT__RETAIL_MANUFACTURING_DAY")

console.log(resp)

process.exit(0)
