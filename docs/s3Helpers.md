# s3Helpers.js

**Role:** Central utilities module. Initialises all external service clients (S3, BigQuery), provides S3 path construction helpers, and reads report-type configuration to drive date/suffix logic.

## Overview

`s3Helpers.js` is imported by almost every other module in the project. It owns the S3 and BigQuery client instances, marketplace mapping, and the per-report-type configuration look-ups that determine how S3 paths are built.

## Exported values and functions

### Constants

| Export | Type | Value / Purpose |
|---|---|---|
| `DEFAULT_BUCKET` | string | `'amazon-reporting-data'` — the S3 bucket checked for all reports |
| `MARKETPLACE_MAP` | object | Lookup from Amazon marketplace ID → country code (built from `marketplace.json`) |
| `live` | boolean | `false` in current code — controls whether dev or prod BigQuery is targeted |

### BigQuery clients

Three clients are created at module load, all using `./key.json` as credentials:

| Export | Project env var | Purpose |
|---|---|---|
| `bigquery` | `BQ_PROJECT` | General queries (used in `run_client.js`) |
| `bigquery_dev` | `BQ_PROJECT_DEV` | Dev/staging writes and job management |
| `bigquery_prod` | `BQ_PROJECT_PROD` | Production writes (only used when `live = true`) |

### `createS3Client(region)`

Creates and returns an `S3Client` instance configured with `AMAZON_ACCESS_KEY` and `AMAZON_SECRET_ACCESS_KEY` from environment variables. Defaults to `us-east-1`.

Also exports the module-level `s3Client` instance (created with `AWS_REGION` env var).

### `validateReportMetadata(metadata)`

Validates that a report row has all required fields before an S3 check is attempted.

Required fields: `client_id`, `sellerId_1`, `marketplace`, `report_type`, plus a valid `dates` value (checked with `moment().isValid()`).

Returns `true` if all required fields are present and the date is valid, `false` otherwise.

### `headObject(s3Client, bucket, key, date, report)`

Performs an S3 `HeadObject` request to check whether a file exists without downloading it.

**Returns:**
```js
{ exists: true,  metadata: <S3Response>, errorCode: null,    s3Link, date, report }  // found
{ exists: false, metadata: null,         errorCode: <string>, s3Link, date, report }  // not found
```
Error code is `'404'` for `NotFound`, otherwise the error name from the AWS SDK.

### `buildS3Path(reportMetadata, bucket)`

Constructs a full S3 `{ bucket, s3_key }` from report metadata. Mainly used as a utility — the primary path building in `main.js` is done inline using the more granular helpers below.

### `getTableInfo(table, report_type)`

Looks up `gg_table_config.json` and returns the matching `info` entry (or entries) for a given `(table, report_type)` pair. Returns an empty array if not found.

### `getS3ReportType(table, report_type)`

Returns the `s3_report_type` field from `gg_table_config` if one is specified, otherwise falls back to the dbt `report_type`. Used because some tables use a different report type name in S3 than in BigQuery (e.g. `gapguardian_sales_and_traffic_restatement`).

### `date_modify(date, report_type, normal_format, table)`

Computes a modified date by adding a per-report-type day offset (from `gg_table_config`) to `date`.

| `normal_format` | Output format |
|---|---|
| `false` / falsy | `YYYYMMDD` (used in S3 path segments) |
| `true` | `YYYY-MM-DD` (used as a human-readable due-by date) |

If no config entry is found for the table/report_type pair, no offset is applied.

### `suffix_modify(report, report_type, table)`

Returns the file suffix for the S3 key. If the report has an `asin` field and the config suffix contains `%ASIN%`, that placeholder is substituted with the actual ASIN value. If no config entry is found, returns `found_report_type.suffix` (which would be `undefined` — a known edge case in the current code).

## Environment variables used

| Variable | Purpose |
|---|---|
| `BQ_PROJECT` | BigQuery project for `bigquery` client |
| `BQ_PROJECT_DEV` | BigQuery project for `bigquery_dev` client |
| `BQ_PROJECT_PROD` | BigQuery project for `bigquery_prod` client |
| `AWS_REGION` | AWS region for the module-level S3 client |
| `AMAZON_ACCESS_KEY` | AWS access key ID |
| `AMAZON_SECRET_ACCESS_KEY` | AWS secret access key |

## Dependencies

- `@aws-sdk/client-s3` — S3 client and HeadObjectCommand
- `@google-cloud/bigquery` — BigQuery client
- `marketplace.json` — marketplace ID → country code mapping
- `gg_table_config.json` — per-table report type configuration
- `moment-timezone` — date formatting
- `dotenv` — environment variable loading
