# run_per_client.js

**Role:** Orchestrates the full SLA check run for a single BigQuery table, processing all clients sequentially using a persistent job queue stored in BigQuery.

## Overview

`run_per_client.js` exposes a `GET /run_per_client` endpoint. Unlike `run_client.js` (which is stateless), this module implements a resumable job queue: it records which clients still need processing in a BigQuery `jobs` table and picks up where it left off on each call.

## Endpoint

### `GET /run_per_client?table=<gg_table>[&client_id=<id>]`

| Query parameter | Required | Description |
|---|---|---|
| `table` | Yes | Name of the BigQuery dbt table to process (must exist in `gg_table_config.json`) |
| `client_id` | No | If provided and numeric, only queue/process that specific client |

**Response:** `{ status: <boolean> }` — `true` means processing continued, `false` means nothing left to do.

## Request flow

```
GET /run_per_client?table=...
        │
        └─► [up to 10 iterations] ──► init(req, res)
                                           │
                              ┌────────────┴───────────────┐
                              │ Job exists with             │ No active job
                              │ clients remaining           │
                              ▼                             ▼
                        Resume job                   Check last job age
                              │                             │
                              ▼                        < 12 hrs ago?
                    For each client:                        │
                      For each report_type:            ┌────┴────┐
                        main(req)                      Yes       No
                        Remove client from list        │         │
                                                  Skip it   createJob()
                                                            (populate list)
        │
        └─► After all iterations: deduplicate result table
```

The outer loop calls `init` up to 10 times. Each call to `init` returns `false` when there are no more clients to process, which triggers a deduplication step on the results table before sending the response.

## `init(req, res)` — internal function

### Job table

Jobs are stored in BigQuery:
- **Dev:** `project-kesselrun.devs.jobs`
- **Prod:** `project-kesselrun.sla_checks.jobs` (when `live = true`)

Each job row has: `id`, `client_list` (array of client IDs), `gg_table`, `retries`, `created`.

### Resume path (job exists with `client_list.length > 0`)

1. Increments `retries` counter on the job row.
2. Iterates through remaining `client_list`.
3. For each client, iterates through all `report_type` entries in `gg_table_config` for the table.
4. Calls `main({ body: { report_type, client_id, gg_table } })` for each combination.
5. After each client completes, removes it from `client_list` in BigQuery using an `UNNEST` + filter query.
6. Returns `false` when the list is empty (job is done).

### Create path (no active job)

1. Checks if a completed job exists for this table.
2. If the last job was created within the past 12 hours: skips (returns `false` with "NOTHING TO PROCESS").
3. Otherwise: creates a new job with `createJob()`.
   - Inserts a row into the `jobs` table with `client_list` populated from `DISTINCT client_id` values in the dbt table.
   - If `client_id` query param is present, filters to just that client.
4. Returns `true` so the outer loop immediately starts processing.

## Deduplication step

After all processing is complete (the loop exits), a `CREATE OR REPLACE TABLE ... QUALIFY ROW_NUMBER() OVER (PARTITION BY s3_key, check_date) = 1` query removes any duplicate check records from the results table.

## Dependencies

- `main.js` — core check function
- `s3Helpers.js` — `bigquery`, `bigquery_dev`, `live`
- `gg_table_config.json` — table-to-report-type mapping
- `gg_tables.json` — imported but not used in the active code path
- `report_types.json` — imported but not used in the active code path
- `moment-timezone` — age comparison for job cooldown check
