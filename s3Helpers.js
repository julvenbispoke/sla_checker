const { S3Client, HeadObjectCommand } = require('@aws-sdk/client-s3');
const marketplaceList = require("./marketplace.json")
const moment = require('moment-timezone')
const dotenv = require("dotenv");
const { BigQuery } = require('@google-cloud/bigquery');
const gg_table_config = require("./gg_table_config.json")
dotenv.config();
// Constants

// const live = true
const live = false

const bigquery = new BigQuery({
    keyFilename: `./key.json`,
    projectId: process.env.BQ_PROJECT
});

const bigquery_dev = new BigQuery({
    keyFilename: `./key.json`,
    projectId: process.env.BQ_PROJECT_DEV
});

const bigquery_prod = new BigQuery({
    keyFilename: `./key.json`,
    projectId: process.env.BQ_PROJECT_PROD
})

const s3Client = createS3Client(process.env.AWS_REGION);

const DEFAULT_BUCKET = 'amazon-reporting-data';

const MARKETPLACE_MAP = {}
marketplaceList.forEach(x => {
    MARKETPLACE_MAP[x.marketplaceid] = x.countrycode

})
// console.log({MARKETPLACE_MAP})
// S3 Client Creation
function createS3Client(region = 'us-east-1') {
    let client = new S3Client({
        region,
        credentials: {
            accessKeyId: process.env.AMAZON_ACCESS_KEY,
            secretAccessKey: process.env.AMAZON_SECRET_ACCESS_KEY
        }
    });
    // console.log({client})
    return client
}


// S3 Path Building
function buildS3Path(reportMetadata, bucket = DEFAULT_BUCKET) {
    const { client_id, seller_id, marketplace, report_type, period_date, file_suffix } = reportMetadata;
    // console.log({reportMetadata})
    // Validate required fields
    if (!seller_id) {
        throw new Error('seller_id is required');
    }

    // Convert marketplace to country
    const country = MARKETPLACE_MAP[marketplace] || 'US';

    // Format date as YYYYMMDD
    const dateStr = period_date.value.replace(/-/g, '');

    // Build S3 key
    const s3Key = `amazon-selling-partners-api/${report_type}/${country}/${client_id}/${seller_id}/${dateStr}-${dateStr}/StartDate=${dateStr}_EndDate=${dateStr}${file_suffix}`;

    return { bucket, s3_key: s3Key };
}

// Metadata Validation
function validateReportMetadata(metadata) {
    // const required = ['client_id', 'sellerId_1', 'marketplace', 'report_type', 'dates', 'file_suffix'];
    const required = ['client_id', 'sellerId_1', 'marketplace', 'report_type', 'dates'];
    let result = required.every(field => {
        if (field == 'dates') return moment(metadata['dates']).isValid()
        return metadata[field] != null
    });
    // console.log("VALIDATE REPORT ", result)
    return result
}

// S3 Head Object
async function headObject(s3Client, bucket, key, date, report) {
    try {
        const response = await s3Client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        // console.log(response)
        return { exists: true, metadata: response, errorCode: null, s3Link: key, date, report };
    } catch (error) {
        const errorCode = error.name === 'NotFound' ? '404' : error.name;
        return { exists: false, metadata: null, errorCode, s3Link: key, date, report };
    }
}



const getTableInfo = (table, report_type) => {
    // console.log("GET TABLE INFO: ", {table, report_type})
    if (!table || !report_type) {
        // console.log("ERROR NO TABLE OR REPORT TYPE")
        return []
    }
    let found_report_type = gg_table_config
        .filter(x => x.table == table)
        .map(x => x.info)
        .flat(Infinity)
        .filter(x => x.report_type == report_type)

    return found_report_type
}

const getS3ReportType = (table, report_type) => {
    // Get the S3 report type from config, falling back to the dbt report_type if not specified
    const tableInfo = getTableInfo(table, report_type)

    if (tableInfo.length > 0 && tableInfo[0].s3_report_type) {
        return tableInfo[0].s3_report_type
    }

    return report_type
}

const date_modify = (date, report_type, normal_format, table) => {

    // if (report_type == 'GET_BRAND_ANALYTICS_SEARCH_QUERY_PERFORMANCE_REPORT') {

    //     return normal_format ? moment(date).add(6, "days").format("YYYY-MM-DD") : moment(date).add(6, "days").format("YYYYMMDD")
    // }

    // let found_report_type = REPORT_TYPE_DATE_RANGE.filter(x => x.report_type == report_type)

    // let found_report_type = gg_table_config.map(x => x.info).flat(Infinity).filter(x => x.report_type == report_type)


    let found_report_type = getTableInfo(table, report_type)

    if (found_report_type.length > 0) {
        found_report_type = found_report_type[0]
        // console.log("FOUND REPORT TYPE", found_report_type)
        return normal_format ? moment(date).add(found_report_type.days, "days").format("YYYY-MM-DD") : moment(date).add(found_report_type.days, "days").format("YYYYMMDD")

    }

    return normal_format ? moment(date).format("YYYY-MM-DD") : moment(date).format("YYYYMMDD")

}

const suffix_modify = (report, report_type, table) => {

    // console.log("SUFFIX MODIFY: ", {report, report_type})

    // let found_report_type = REPORT_TYPE_DATE_RANGE.filter(x => x.report_type == report_type)
    // let found_report_type = gg_table_config.map(x => x.info).flat(Infinity).filter(x => x.report_type == report_type)

    // console.log("SUFFIX: ", found_report_type)
    // if (report_type == 'GET_BRAND_ANALYTICS_SEARCH_QUERY_PERFORMANCE_REPORT') {
    //     return report.file_suffix.replace("%ASIN%", report.asin)
    // }
    // console.log("HELPERS", found_report_type)

    let found_report_type = getTableInfo(table, report_type)

    if (found_report_type.length > 0) {
        found_report_type = found_report_type[0]

        // return report.file_suffix.replace("%ASIN%", report.asin)

        let newSuffix = !!report.asin ? found_report_type.suffix.replace("%ASIN%", report.asin) : found_report_type.suffix;

        // console.log("NEW SUFFIX ",found_report_type.report_type, newSuffix)
        report.suffix = newSuffix;
        return newSuffix

    }

    return found_report_type.suffix
}

module.exports = {
    live,
    createS3Client,
    buildS3Path,
    validateReportMetadata,
    headObject,
    DEFAULT_BUCKET,
    MARKETPLACE_MAP,
    bigquery,
    s3Client,
    bigquery_dev,
    bigquery_prod,
    date_modify,
    suffix_modify,
    getTableInfo,
    getS3ReportType
};