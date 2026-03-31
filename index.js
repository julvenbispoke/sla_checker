
const { DateTime } = require('luxon');
const serverless = require("serverless-http");
const moment = require("moment-timezone")

const express = require('express')
const dotenv = require("dotenv");
const app = express();
const cors = require('cors')

dotenv.config();
app.use(cors())
app.use(express.json())



// exports.handler = async (event, context) => {


 
const { bigquery_dev } = require('./s3Helpers');

// const main = require("./main")
const write_config = require("./write_config")
const run_per_client = require("./run_per_client");
const run_client = require("./run_client");

// app.use("/", main)
app.use("/write_config", write_config)
app.use("/run_per_client", run_per_client)
app.use("/run_client", run_client)





app.get("/test", async (req, res) => {

    res.send(moment.tz("UTC").format("YYYY-MM-DD"))

    return

})

app.listen(process.env.PORT || 3002, function () {
    console.log('Listening on PORT ' + process.env.PORT || 3002);
});

module.exports.handler = serverless(app);
