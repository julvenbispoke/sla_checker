# slaChecker.js

**Role:** Pure SLA status decision logic. Given whether a file exists and relevant timestamps, returns one of three status strings.

## Overview

This module contains a single exported function `decideStatus`. It has no side effects, no I/O, and no dependencies on configuration — it is a pure computation that classifies a single report file as `OK`, `LATE`, or `MISSING`.

## Exported function

### `decideStatus(exists, dueBy, lastModified, graceMinutes)`

| Parameter | Type | Description |
|---|---|---|
| `exists` | boolean | Whether the S3 file was found |
| `dueBy` | `Date` | The report's deadline (JS Date object) |
| `lastModified` | `Date` or null | When the file was last modified (from S3 metadata) |
| `graceMinutes` | number | Extra minutes added to `dueBy` to form the true deadline |

**Returns:** `'OK'` | `'LATE'` | `'MISSING'`

## Decision logic

The effective deadline is `dueBy + graceMinutes`. In `main.js`, `graceMinutes` is always `720` (12 hours).

```
if file EXISTS:
    if lastModified <= deadline  →  OK
    else                         →  LATE

if file DOES NOT EXIST:
    if now > deadline            →  MISSING
    else                         →  OK  (not due yet)
```

### Status meanings

| Status | Meaning |
|---|---|
| `OK` | File arrived on time, or deadline has not passed yet |
| `LATE` | File exists but was uploaded after the grace deadline |
| `MISSING` | File does not exist and the grace deadline has passed |

## Date handling

Uses `luxon`'s `DateTime` for all date arithmetic:
- `DateTime.fromJSDate(dueBy).plus({ minutes: graceMinutes })` — computes the deadline.
- `DateTime.fromJSDate(lastModified)` — converts S3 `LastModified` to a comparable Luxon datetime.
- `DateTime.utc()` — current UTC time.

## Dependencies

- `luxon` — date arithmetic and UTC comparison
- `moment-timezone` / `dotenv` — imported but not used in the current implementation (legacy imports)
