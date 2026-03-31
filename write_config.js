const express = require('express')
const dotenv = require("dotenv");
const app = express();
const cors = require('cors');
const { bigquery } = require('./s3Helpers');
const gg_tables = require("./gg_tables.json")
const report_type_list = require("./report_types.json")

const router = express.Router()

dotenv.config();
app.use(cors())
app.use(express.json())


router.get("/", async (req, res) => {

    res.send({status: false})
    return 

    let report_data = []

    let list = (report_type_list.map(x => x.split(" ")).map(x => {
        let [report_type, days, suffix] = x
        return { report_type, days, suffix }
    }))
    
    // console.log(list)

    for (let i = 0; i < gg_tables.length; i++) {
        console.log("PROCESSING TABLE " + gg_tables[i])
        let table = gg_tables[i]



        try {
            let [resp] = await bigquery.query(`SELECT DISTINCT report_type FROM \`amazon-sp-report-loader.dbt.${gg_tables[i]}\``)

            // console.log({resp})

            report_data.push({
                table,
                info: list.filter(x => resp.map(xx => xx.report_type).includes(x.report_type))
            })

            // report_data.push(resp.map(x => x.report_type))
        }
        catch (err) {
            console.log("ERROR IN GET REPORT TYPES: ", err)
            continue
        }

    }

    // report_data = [...new Set(report_data.flat(Infinity))]

    res.send(report_data.filter( x => x.info.length > 0))
})

module.exports = router