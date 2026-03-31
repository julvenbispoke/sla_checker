const { DateTime } = require('luxon');
const moment = require('moment-timezone')
const dotenv = require("dotenv");
dotenv.config();

function decideStatus(exists, dueBy, lastModified, graceMinutes) {

  const deadline = DateTime.fromJSDate(dueBy).plus({ minutes: graceMinutes });
  const now = DateTime.utc();

  //  const deadline = moment(dueBy).utc().add(graceMinutes, 'minutes')
  // const now = moment().utc()

  // console.log({ deadline_after_now: deadline.isAfter(now) })

  if (exists) {
    if (lastModified && DateTime.fromJSDate(lastModified) <= deadline) {
      // if(deadline.isAfter(now)) {
      return 'OK';
    }
    return 'LATE';
  } else {
    if (now > deadline) {
      return 'MISSING';
    }
    return 'OK';  // Not due yet
  }
}

module.exports = { decideStatus };