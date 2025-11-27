const express = require('express')
const dotenv = require("dotenv");
const app = express();
const cors = require('cors')
const moment = require('moment-timezone')

const { decideStatus } = require('./slaChecker');
const { BigQuery } = require('@google-cloud/bigquery');
const gg_table_config = require('./gg_table_config.json')

const {
    buildS3Path,
    validateReportMetadata,
    headObject,
    bigquery,
    bigquery_dev,
    createS3Client,
    MARKETPLACE_MAP,
    DEFAULT_BUCKET,
    date_modify,
    suffix_modify
} = require('./s3Helpers');
const { DateTime } = require('luxon');
const s3Client = createS3Client(process.env.AWS_REGION);

const router = express.Router()

dotenv.config();
app.use(cors())
app.use(express.json())

let total_processed = 0, missing = 0; late = 0;

let main = async (req, res) => {


    // let report_type = 'GET_BRAND_ANALYTICS_SEARCH_QUERY_PERFORMANCE_REPORT'
    // let gg_table = 'gapguardian_search_query_performance_top_1200'
    // let client_id = 380
    let report_type = req.body.report_type
    let gg_table = req.body.gg_table
    let client_id = req.body.client_id


    try {
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


        let [reports] = await bigquery.query(query2);

        if (reports.length == 0) {
            console.log("NOTHING TO PROCCESS, CLIENT ID: " + client_id)
            return
        }

        reports = reports.map(x => { return { ...x, dates: x.dates.split(",").map(x => x.trim()) } })
        // console.log(reports)
        // res.send(reports)
        // return

        const insert_query = `
        INSERT INTO \`${process.env.BQ_PROJECT_DEV}.${process.env.BQ_DATASET_DEV}.${process.env.CHECKS_TABLE}\`
        (check_date, bucket, s3_key, \`exists\`, last_modified, content_length, etag, sla_status, due_by, checked_at, client_id, report_type, target_date, error_code)
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
                    `${suffix_modify(report, report.report_type, gg_table)}`
                ].join("")

                // console.log(s3Link)

                linkList.push({ s3Link, date, report })

                //   const { exists, metadata, errorCode } = await headObject(
                //     s3Client,
                //     DEFAULT_BUCKET,
                //     s3Link
                // );
                // // console.log({ exists, s3Link, metadata })

                // const slaStatus = decideStatus(
                //     exists,
                //     new Date(date_modify(date, report_type, true)),
                //     metadata?.LastModified,
                //     10  // grace_minutes
                // );

                // let data = {
                //     check_date: moment.tz("UTC").format("YYYY-MM-DD"),
                //     bucket: DEFAULT_BUCKET,
                //     s3_key: s3Link,
                //     exists,
                //     last_modified: metadata?.LastModified?.toISOString() || null,
                //     content_length: !!metadata ? metadata.ContentLength : null,
                //     etag: !!metadata ? metadata.ETag : null,
                //     sla_status: slaStatus,
                //     due_by: date_modify(date, report_type, true),
                //     checked_at: moment.tz("UTC").format("YYYY-MM-DD"),
                //     client_id: report.client_id,
                //     report_type: report.report_type,
                //     target_date: date_modify(date, report_type, true),
                //     error_code: errorCode
                // }

                // checkRecords.push(data);
                // value_list.push(`('${data.check_date}','${data.bucket}','${data.s3_key}',${data.exists},${!!data.last_modified ? `'${data.last_modified}'` : null},${data.content_length},'${data.etag}','${data.sla_status}','${data.due_by}','${data.checked_at}','${data.client_id}','${data.report_type}','${data.target_date}',${!!data.error_code ? `'${data.error_code}'` : null})`)
                // total_processed++

            }

        }

       
        // return


        const chunkSize = 50
        const chunkData = []

        for (let i = 0; i < linkList.length; i += chunkSize) {
            console.log(`CLIENT ID ${client_id} ITERATION ${i}`)
            // console.log("INTERATION DONE", i >= link_iteration - 1, i, link_iteration)
            let chunk = linkList.slice(i, i + chunkSize).map(({ s3Link, date, report }) => () => headObject(s3Client, DEFAULT_BUCKET, s3Link, date, report))


            await new Promise(resolve => {
                setTimeout(async () => {

                    let resp = await Promise.all(chunk.map(x => x()))

                    // console.log(resp)
                    // resp.forEach(({ exists, metadata, errorCode }, i) => {
                    for (let ii = 0; ii < resp.length; ii++) {
                        let { exists, metadata, errorCode, s3Link, date, report } = resp[ii]

                        const slaStatus = decideStatus(
                            exists,
                            new Date(date_modify(date, report_type, true, gg_table)),
                            metadata?.LastModified,
                            10  // grace_minutes
                        );  
                        slaStatus == 'MISSING' ? missing++ : slaStatus == "LATE" ? late++ : null;

                        console.log(`status: ${slaStatus}, client_id: ${client_id}, file: ${s3Link.split("/").at(-1)}`)

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
                            client_id: report.client_id,
                            report_type: report.report_type,
                            target_date: date_modify(date, report_type, true, gg_table),
                            error_code: errorCode
                        }
                        checkRecords.push(data);
                        value_list.push(`('${data.check_date}','${data.bucket}','${data.s3_key}',${data.exists},${!!data.last_modified ? `'${data.last_modified}'` : null},${data.content_length},'${data.etag}','${data.sla_status}','${data.due_by}','${data.checked_at}','${data.client_id}','${data.report_type}','${data.target_date}',${!!data.error_code ? `'${data.error_code}'` : null})`)
                        total_processed++
                    }

                    resolve()
                }, 200)


            })

            // console.log({ value_list })

            // await new Promise.all(resolve => {
            //     resolve()
            //     setTimeout(async () => {
            //         const { exists, metadata, errorCode } = await headObject(
            //             s3Client,
            //             DEFAULT_BUCKET,
            //             linkList[i]
            //         );
            //         // console.log({ exists, s3Link, metadata })

            //         const slaStatus = decideStatus(
            //             exists,
            //             new Date(date_modify(date, report_type, true)),
            //             metadata?.LastModified,
            //             10  // grace_minutes
            //         );

            // let data = {
            //     check_date: moment.tz("UTC").format("YYYY-MM-DD"),
            //     bucket: DEFAULT_BUCKET,
            //     s3_key: s3Link,
            //     exists,
            //     last_modified: metadata?.LastModified?.toISOString() || null,
            //     content_length: !!metadata ? metadata.ContentLength : null,
            //     etag: !!metadata ? metadata.ETag : null,
            //     sla_status: slaStatus,
            //     due_by: date_modify(date, report_type, true),
            //     checked_at: moment.tz("UTC").format("YYYY-MM-DD"),
            //     client_id: report.client_id,
            //     report_type: report.report_type,
            //     target_date: date_modify(date, report_type, true),
            //     error_code: errorCode
            // }

            //         checkRecords.push(data);
            // value_list.push(`('${data.check_date}','${data.bucket}','${data.s3_key}',${data.exists},${!!data.last_modified ? `'${data.last_modified}'` : null},${data.content_length},'${data.etag}','${data.sla_status}','${data.due_by}','${data.checked_at}','${data.client_id}','${data.report_type}','${data.target_date}',${!!data.error_code ? `'${data.error_code}'` : null})`)
            //         total_processed++
            //     }, 100)
            // })

        }
        // console.log(chunkData)
        // return


        for (let i = 0; i < value_list.length; i += chunkSize) {

            await new Promise(resolve => {
                setTimeout(() => {
                    console.log("WRITING TO DB ITERATION ", i)
                    try {
                        bigquery_dev.query(insert_query + value_list.slice(i, i + chunkSize).join(","))
                    }
                    catch (err) {
                        console.error('WRITE ERROR:', error);
                    }

                    resolve()
                }, 200)
            })


        }

        // res.send(checkRecords)
        return checkRecords

    } catch (error) {
        console.error('Fatal error:', error);

        let send = {
            statusCode: 500,
            error: error.message
        };

        // res.send(send)
        return send
    }
}

const process_report = async (req, res) => {

    if (req.query.client_id == 'all') {
        let sql = `SELECT DISTINCT client_id FROM \`amazon-sp-report-loader.dbt.${req.body.gg_table}\``;
        let [client_ids] = await bigquery.query(sql);
        client_ids = client_ids.map(x => Number(x.client_id)).sort((a, b) => a - b)
        // console.log("ALL CLIENT ID", client_ids)
        // return
        for (let i = 0; i < client_ids.length; i++) {
            console.log("PROCESSING CLIENT ID: ", client_ids[i])
            req.body.client_id = client_ids[i]
            await main(req, res)
        }

    }

    else if (!!req.query.client_id && isFinite(req.query.client_id)) {
        req.body.client_id = Number(req.query.client_id)
        response = await main(req, res)


    }
    else {
        res.status(500).send({ error: "valid client_id parameter required" })
    }

}

router.get("/", async (req, res) => {


    // res.send(req.query)
    // return
    if(!req.query.table) {
        console.log("invalid or missing table parameter")
        res.status(500).send({error: "invalid or missing table parameter"})
        return
    }




    let gg_table = gg_table_config
        .filter(x => x.table == req.query.table)
        // .filter(x => x.table == "gapguardian_historical_new_trial")
    
    if(gg_table.length == 0) {
        let err = `no '${req.query.table}' in list of tables`
        res.status(500).send({error: err})
        return
    }

    for (let i = 0; i < gg_table.length; i++) {

        console.log("TABLE ", gg_table[i].table)
        req.body.gg_table = gg_table[i].table

        for (let ii = 0; ii < gg_table[i].info.length; ii++) {
            req.body.report_type = gg_table[i].info[ii].report_type
            console.log("REPORT TYPE: ", gg_table[i].info[ii].report_type)
            await process_report(req, res)
        }
    }

    console.log("ALL DONE, TOTAL PROCESSED: ", total_processed, missing, late)
    res.send({ total_processed, missing, late })
    total_processed = 0, missing = 0; late = 0
    return

    // let response = null
    // req.body.report_type = 'GET_BRAND_ANALYTICS_SEARCH_QUERY_PERFORMANCE_REPORT'
    // req.body.gg_table = 'gapguardian_search_query_performance_top_1200'

    // console.log(req.query)


    // console.log("ALL DONE, TOTAL PROCESSED: ", total_processed)
    // res.send({ total_processed })
    // total_processed = 0
    // return
})


module.exports = router