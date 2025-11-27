const { DateTime } = require('luxon');
const dotenv = require("dotenv");
dotenv.config();

function decideStatus(exists, dueBy, lastModified, graceMinutes) {
  const deadline = DateTime.fromJSDate(dueBy).plus({ minutes: graceMinutes });
  const now = DateTime.utc();

  if (exists) {
    if (lastModified && DateTime.fromJSDate(lastModified) <= deadline) {
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