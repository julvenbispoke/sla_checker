
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

const main = require("./main")
const write_config = require("./write_config")


app.use("/", main)
app.use("/write_config", write_config)




app.get("/time", (req, res) => {


    res.send({
        moment: moment.tz("UTC").format("YYYY-MM-DD HH:mm:ss"),
        luxon: DateTime.utc().toFormat("yyyy-MM-dd HH:mm:ss")
    })

    return

})

app.listen(process.env.PORT || 3002, function () {
    console.log('Listening on PORT ' + process.env.PORT || 3002);
});

module.exports.handler = serverless(app);
