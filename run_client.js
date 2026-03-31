const express = require('express')
const dotenv = require("dotenv");
const app = express();
const cors = require('cors')

const gg_table_config = require('./gg_table_config.json')

const {

    bigquery,

} = require('./s3Helpers');

const { main } = require('./main');


const router = express.Router()

dotenv.config();
app.use(cors())
app.use(express.json())

let total_processed = 0, missing = 0; late = 0;

const process_report = async (req, res) => {

    if (req.query.client_id == 'all') {
        let sql = `SELECT DISTINCT client_id FROM \`amazon-sp-report-loader.dbt.${req.body.gg_table}\``;
        let [client_ids] = await bigquery.query(sql);
        client_ids = client_ids.map(x => Number(x.client_id)).sort((a, b) => a - b)

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
    if (!req.query.table) {
        console.log("invalid or missing table parameter")
        res.status(500).send({ error: "invalid or missing table parameter" })
        return
    }


    let gg_table = gg_table_config
        .filter(x => x.table == req.query.table)

    if (gg_table.length == 0) {
        let err = `no '${req.query.table}' in list of tables`
        res.status(500).send({ error: err })
        return
    }

    for (let i = 0; i < gg_table.length; i++) {

        // console.log("MAIN TABLE ", gg_table[i].table, req.body)
        if (!req.body) req.body = {}
        req.body.gg_table = gg_table[i].table

        for (let ii = 0; ii < gg_table[i].info.length; ii++) {
            req.body.report_type = gg_table[i].info[ii].report_type
            console.log("REPORT TYPE: ", gg_table[i].info[ii].report_type)

            await process_report(req, res)
        }
    }

    console.log("ALL DONE, PROCESSED INFO   : ", { total_processed, missing, late })
    res.send({ total_processed, missing, late })
    total_processed = 0, missing = 0; late = 0
    return

})


module.exports = router