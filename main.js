const express = require('express')
const dotenv = require("dotenv");
const app = express();
const cors = require('cors')
const moment = require('moment-timezone')

const { decideStatus } = require('./slaChecker');

const {
    validateReportMetadata,
    headObject,
    bigquery,
    bigquery_dev,
    createS3Client,
    MARKETPLACE_MAP,
    DEFAULT_BUCKET,
    date_modify,
    suffix_modify,
    live,
    bigquery_prod
} = require('./s3Helpers');
const s3Client = createS3Client(process.env.AWS_REGION);


dotenv.config();
app.use(cors())
app.use(express.json())

let total_processed = 0, missing = 0; late = 0;

let main = async (req) => {

    let report_type = req.body.report_type
    let gg_table = req.body.gg_table
    let client_id = req.body.client_id

    const query2 = `
        SELECT 
        a.*, 
        b.*,
        c.*
        FROM \`amazon-sp-report-loader.dbt.${gg_table}\` AS a
        LEFT JOIN \`amazon-sp-report-loader.sla.clientId_and_sellerId\` AS b
        ON a.client_id = b.client_id
        LEFT JOIN \`amazon-sp-report-loader.sla.sla_config_v2\` AS c
        ON a.report_type = c.report_type 
        WHERE a.client_id = "${client_id}" 
         `

    let reports = []
    try {
        let [resp_reports] = await bigquery.query(query2);

        if (resp_reports.length == 0) {
            console.log("NOTHING TO PROCCESS, CLIENT ID: " + client_id)
            return false
        }

        reports = resp_reports

    }

    catch (err) {
        console.log("ERROR IN BIG QUERY GET REPORTS: ", err)
        return false
    }



    reports = reports.map(x => { return { ...x, dates: x.dates.split(",").map(x => x.trim()) } })
    // console.log(reports)
    // res.send(reports)
    // return
    let bq_dataset = live ? process.env.BQ_DATASET_PROD : process.env.BQ_DATASET_DEV
    let bq_table = live ? gg_table : process.env.CHECKS_TABLE
    const insert_query = `
        INSERT INTO \`${process.env.BQ_PROJECT_DEV}.${bq_dataset}.${bq_table}\`
        (check_date, bucket, s3_key, \`exists\`, last_modified, content_length, etag, sla_status, due_by, checked_at, client_id, report_type, target_date, error_code, marketplace, asin)
        VALUES `;
    let value_list = []
    let checkRecords = []
    let link_iteration = 0
    let linkList = []

    for (const report of reports) {

        for (const date of report.dates) {

            link_iteration++
            // console.log(report)
            if (!validateReportMetadata({ ...report, dates: date })) {
                console.log(`REPORT ITERATION ${link_iteration} MISSING CLIENT ID ${client_id} DATE ${date} REQUIRED COLUMNS`)
                continue;
            }

            // continue;
            // console.log(`CLIENT ID ${client_id} DATE ${date} REPORT ITERATION`, link_iteration)
            // console.log(asin)

            let s3Link = [
                "amazon-selling-partners-api/",
                `${report.report_type}/`,
                `${MARKETPLACE_MAP[report.marketplace]}/`,
                `${report.client_id}/`,
                `${report.sellerId_1}/`,
                `${date_modify(date, null, null, gg_table)}-${date_modify(date, report_type, null, gg_table)}/`,
                `StartDate=${date_modify(date, null, null, gg_table)}_EndDate=${date_modify(date, report_type, null, gg_table)}`,
                `${suffix_modify(report, report_type, gg_table)}`
            ].join("")

            // console.log(report)
            // break
            linkList.push({ s3Link, date, report })


        }

    }


    // return


    const chunkSize = 50
    const chunkData = []

    for (let i = 0; i < linkList.length; i += chunkSize) {
        console.log(`CLIENT ID ${client_id} ITERATION ${i}`)
        // console.log("INTERATION DONE", i >= link_iteration - 1, i, link_iteration)
        let chunk = linkList
            .slice(i, i + chunkSize)
            .map(({ s3Link, date, report }) => () => headObject(s3Client, DEFAULT_BUCKET, s3Link, date, report))


        await new Promise(resolve => {
            setTimeout(async () => {
                try {


                    let resp = await Promise.all(chunk.map(x => x()))

                    // console.log(resp)
                    // resp.forEach(({ exists, metadata, errorCode }, i) => {
                    for (let ii = 0; ii < resp.length; ii++) {



                        let { exists, metadata, errorCode, s3Link, date, report } = resp[ii]
                        // console.log({ exists, metadata, errorCode, s3Link, date })

                        const slaStatus = decideStatus(
                            exists,
                            new Date(date_modify(date, report_type, true, gg_table)),
                            metadata?.LastModified,
                            720 // grace_minutes
                        );

                        slaStatus == 'MISSING' ? missing++ : slaStatus == "LATE" ? late++ : null;

                        console.log(`exists: ${exists}, status: ${slaStatus}, client_id: ${client_id}, file: ${s3Link.split("/").at(-1)}`)

                        let data = {
                            check_date: moment.tz("UTC").format("YYYY-MM-DD"),
                            bucket: DEFAULT_BUCKET,
                            s3_key: s3Link,
                            exists,
                            last_modified: metadata?.LastModified?.toISOString() || null,
                            content_length: !!metadata ? metadata.ContentLength : null,
                            etag: !!metadata ? metadata.ETag : null,
                            sla_status: slaStatus,
                            due_by: date_modify(date, report_type, true, gg_table),
                            checked_at: moment.tz("UTC").format("YYYY-MM-DD"),
                            client_id: client_id,
                            report_type: report_type,
                            target_date: date_modify(date, report_type, true, gg_table),
                            error_code: errorCode,
                            marketplace: report?.marketplace,
                            asin: report?.asin
                        }
                        checkRecords.push(data);
                        value_list.push(`('${data.check_date}','${data.bucket}','${data.s3_key}',${data.exists},${!!data.last_modified ? `'${data.last_modified}'` : null},${data.content_length},'${data.etag}','${data.sla_status}','${data.due_by}','${data.checked_at}','${data.client_id}','${data.report_type}','${data.target_date}',${!!data.error_code ? `'${data.error_code}'` : null}, ${data.marketplace ? `'${data.marketplace}'` : null},  ${data.asin ? `'${data.asin}'` : null})`)
                        total_processed++
                    }
                }
                catch (err) {
                    console.log(`ERROR CLIENT ID ${client_id} ITERATION ${i}: `, err)
                }

                resolve()
            }, 200)


        })

    }
    // console.log(chunkData)
    // return


    for (let i = 0; i < value_list.length; i += chunkSize) {
        // continue;
        await new Promise(resolve => {
            setTimeout(() => {
                console.log("WRITING TO DB ITERATION ", i)
                try {
                    if (live) {
                        bigquery_prod.query(insert_query + value_list.slice(i, i + chunkSize).join(","))
                    }
                    else {
                        bigquery_dev.query(insert_query + value_list.slice(i, i + chunkSize).join(","))
                    }

                }
                catch (err) {
                    console.error('ERROR WRITE TO BQ DATABASE:', err);
                }

                resolve()
            }, 200)
        })


    }

    // res.send(checkRecords)
    return checkRecords

}

module.exports = { main }
