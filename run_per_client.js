const express = require('express')
const dotenv = require("dotenv");
const app = express();
const cors = require('cors');
const { bigquery, live, bigquery_dev } = require('./s3Helpers');
const gg_table_config = require('./gg_table_config.json')
const gg_tables = require("./gg_tables.json")
const report_type_list = require("./report_types.json");
const { main } = require('./main');
const moment = require('moment-timezone')


const router = express.Router()

dotenv.config();
app.use(cors())
app.use(express.json())



let init = async (req, res) => {

    let gg_table = gg_table_config
        .filter(x => x.table == req.query.table)

    if (!req.query.table || gg_table.length == 0) {
        console.log("invalid or missing table parameter")
        // res.status(500).send({ error: "invalid or missing table parameter" })

        return false
    }

    let dataset_table = live ? `project-kesselrun.sla_checks.jobs` : 'project-kesselrun.devs.jobs'


    let sql = `SELECT * FROM \`${dataset_table}\` WHERE gg_table = '${req.query.table}' AND ARRAY_LENGTH(client_list) > 0 ORDER BY created DESC`;
    let resp = []
    let [resp1] = await bigquery_dev.query(sql)
    resp = resp1

    //  client_list = client_list.filter( x => x.client_id == '265')
        // console.log(resp)
        // res.send(resp)
        // return

    const createJob = async () => {
        console.log("CREATING JOB")
        try {
            await bigquery_dev.query(`
            INSERT INTO \`${dataset_table}\` (client_list, gg_table) 
            SELECT ARRAY_AGG(DISTINCT CAST(client_id AS INT64)) AS client_list, '${req.query.table}' AS gg_table     
            FROM \`amazon-sp-report-loader.dbt.${req.query.table}\` 
            --WHERE client_id = '182'
            `)
        }
        catch (err) {
            console.log("ERROR CREATING JOB: ", err)
        }


        return
    }

    if (resp.length > 0) { 


        console.log("RESUMING JOB PROCESS")

        let client_list = resp[0].client_list
        let removed_clients = []
        gg_table = gg_table[0]

        bigquery_dev.query(`UPDATE \`${dataset_table}\` SET retries = retries + 1 WHERE id =  '${resp[0].id}'`)

        // client_list = client_list.filter( x => x == 265)
       

        console.log(gg_table)
        for (let i = 0; i < client_list.length; i++) {
            let client_id = client_list[i]


            // console.log("TYPE OF", client_id, typeof client_id)



            for (let ii = 0; ii < gg_table.info.length; ii++) {
                console.log("PROCESSING REPORT TYPE: ", gg_table.info[ii].report_type)
                let req = { body: { report_type: gg_table.info[ii].report_type, client_id: client_id, gg_table: gg_table.table } }
                // console.log(req)
                await main(req)

                try {
                    // removed_clients.push(client_id)

                    let [remain_client] = await bigquery_dev.query(`SELECT client_list FROM \`${dataset_table}\` WHERE id = '${resp[0].id}'`)
                    console.log("REMAINING CLIENTS: ", remain_client[0].client_list.length)

                    // let new_list = remain_client[0].client_list.filter(element => !removed_clients.includes(element));

                    // let sql2 = `UPDATE \`${dataset_table}\` SET client_list = [${new_list}] WHERE id = '${resp[0].id}'`

                    // let resp3 = await bigquery_dev.query(sql2)
                    // console.log("REMAINING CLIENTS: ", new_list.length)

                    // console.log(resp3)

                    let resp3 = await bigquery_dev.query(`
                    UPDATE \`${dataset_table}\`
                    SET client_list = ARRAY(
                    SELECT client_id 
                    FROM UNNEST(client_list) AS client_id 
                    WHERE client_id != ${client_id}
                    )
                    WHERE ${client_id} IN UNNEST(client_list) 
                    `)
                    // console.log(resp3)
                }
                catch (err) {
                    console.log("ERROR: ", err)
                    // continue
                }

            }

            // 
        }
    }

    else {

        let sql = `SELECT * FROM \`${dataset_table}\` WHERE gg_table = '${req.query.table}'  ORDER BY created DESC `;

        let [resp1] = await bigquery_dev.query(sql)
        resp = resp1

        if (resp.length > 0) {
            let created = resp[0].created.value
            let diff = moment(created).utc().add(12, "hours")

            let not_run = moment().utc().isBefore(diff)
            // console.log(moment(created).utc().toISOString(), moment.utc().toISOString(), not_run, moment(created).utc().diff(diff))

            if (!not_run) {
                await createJob()

                return true
            }
            else {
                console.log("NOTHING TO PROCESS")
                // res.send({ status: "nothing to process" })

                return false
            }

        }
        else {
            await createJob()
            return true
        }



    }

    return false

}


router.get("/", async (req, res) => {

    if (!req.query.table) {
        console.log(" missing table parameter or value")
        // res.status(500).send({ error: "invalid or missing table parameter" })
        res.status(500).send({ status: 'missing table parameter or value'})
        return
    }

    // let resp = await init(req, res)
    let resp = null
    for (let i = 0; i < 10; i++) {
        resp = await init(req, res)
        console.log("CONTINUE? ", resp)
        if (!resp) {

            let dataset_table = live ? `project-kesselrun.sla_checks.${req.query.table}` : `project-kesselrun.devs.sla_checks`
            let sql = `
                CREATE OR REPLACE TABLE \`${dataset_table}\` AS
                SELECT * FROM \`${dataset_table}\`
                QUALIFY ROW_NUMBER() OVER (PARTITION BY s3_key, check_date) = 1
                `;
            try {
                console.log("DELETING TABLE ROW DUPLICATES")
                await bigquery_dev.query(sql);
            }
            catch (err) {
                console.log(`ERROR DELETING ROW DUPLICATEDS IN TABLE ${req.query.table}`, err)
            } finally {
                break;
            }

        }
    }

    // console.log(resp)
    res.send({ status: resp, })
    return

})

module.exports = router