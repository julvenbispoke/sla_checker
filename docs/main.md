# main.js

**Role:** Core SLA check engine. For a given client, it queries BigQuery for expected report dates, constructs S3 file paths, checks whether each file exists, determines SLA status, and writes results back to BigQuery.

## Overview

`main.js` exports a single async function `main(req)` that drives the entire check pipeline for one `(client_id, report_type, gg_table)` combination. It is called repeatedly by `run_per_client.js` and `run_client.js`.

## Exported function

### `main(req)`

**Parameters:** An Express-style request object whose `body` contains:

| Field | Type | Description |
|---|---|---|
| `report_type` | string | Amazon SP-API report type identifier |
| `gg_table` | string | BigQuery dbt table name to read from |
| `client_id` | string/number | Amazon seller client ID |

**Returns:** `checkRecords` array on success, `false` on error or if nothing to process.

## Pipeline steps

### 1. Fetch reports from BigQuery

Runs a three-way JOIN:
- `dbt.<gg_table>` — report metadata (report_type, dates, marketplace, ASIN, etc.)
- `sla.clientId_and_sellerId` — maps client_id to sellerId
- `sla.sla_config_v2` — SLA configuration per report type

Filters by `client_id`. Returns early with `false` if no rows are found.

### 2. Build S3 link list

For each report row and each date in its comma-separated `dates` field:
- Validates the row with `validateReportMetadata`.
- Constructs the S3 object key using helpers:
  - `getS3ReportType` — resolves the S3 folder name (may differ from the dbt report type).
  - `MARKETPLACE_MAP` — converts marketplace ID to country code.
  - `date_modify` — applies per-report-type day offsets and formats dates.
  - `suffix_modify` — builds the file suffix, substituting `%ASIN%` where needed.

S3 key format:
```
amazon-selling-partners-api/<s3_report_type>/<country>/<client_id>/<sellerId>/<startDate>-<endDate>/StartDate=<start>_EndDate=<end><suffix>
```

### 3. Check S3 objects in chunks of 50

Links are batched into chunks of 50. Each chunk is processed concurrently with `Promise.all` on `headObject` calls (an S3 `HeadObject` request). A 200 ms delay between chunks throttles the S3 request rate.

For each response:
- `decideStatus` is called with `exists`, due-by date, last-modified timestamp, and a 720-minute grace window.
- Counters `missing` and `late` are incremented.
- A `data` record is assembled with all check fields.

### 4. Write results to BigQuery

Check records are inserted in chunks of 50 using a raw SQL `INSERT` statement. The target dataset and table depend on the `live` flag:

| `live` | Dataset | Table |
|---|---|---|
| `true` | `BQ_DATASET_PROD` | `gg_table` value |
| `false` | `BQ_DATASET_DEV` | `CHECKS_TABLE` env var |

A 200 ms delay is applied between insert batches.

## Check record fields

| Field | Description |
|---|---|
| `check_date` | UTC date the check was run (`YYYY-MM-DD`) |
| `bucket` | S3 bucket name |
| `s3_key` | Full S3 object key that was checked |
| `exists` | Boolean — whether the file was found |
| `last_modified` | ISO timestamp from S3 metadata |
| `content_length` | File size in bytes from S3 metadata |
| `etag` | S3 ETag from metadata |
| `sla_status` | `OK`, `LATE`, or `MISSING` |
| `due_by` | Computed deadline date for the report |
| `checked_at` | UTC date of this check |
| `client_id` | Client identifier |
| `report_type` | Amazon report type |
| `target_date` | Same as `due_by` |
| `error_code` | S3 error code if file not found (e.g. `404`) |
| `marketplace` | Amazon marketplace ID |
| `asin` | ASIN if applicable |

## Environment variables used

| Variable | Purpose |
|---|---|
| `AWS_REGION` | Region for S3 client |
| `BQ_PROJECT_DEV` | BigQuery project for INSERT target |
| `BQ_DATASET_PROD` | BigQuery dataset when `live = true` |
| `BQ_DATASET_DEV` | BigQuery dataset when `live = false` |
| `CHECKS_TABLE` | BigQuery table name when `live = false` |

## Dependencies

- `s3Helpers.js` — S3 client, BigQuery clients, path helpers, validators
- `slaChecker.js` — `decideStatus` function
- `express`, `cors`, `dotenv`, `moment-timezone`
