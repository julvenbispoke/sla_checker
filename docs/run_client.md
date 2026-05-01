# run_client.js

**Role:** Stateless endpoint to trigger SLA checks for one table, either for a specific client or all clients, without using a job queue.

## Overview

`run_client.js` exposes a `GET /run_client` endpoint. It is simpler than `run_per_client.js`: it does not maintain a job queue in BigQuery — it queries all distinct client IDs directly, then processes them in a single sequential loop.

## Endpoint

### `GET /run_client?table=<gg_table>&client_id=<id|all>`

| Query parameter | Required | Description |
|---|---|---|
| `table` | Yes | Name of the BigQuery dbt table (must exist in `gg_table_config.json`) |
| `client_id` | Yes | A specific numeric client ID, or `'all'` to process every client |

**Response:** `{ total_processed, missing, late }` — aggregate counts for this run.

## Request flow

1. Validates that `table` is present and exists in `gg_table_config.json`.
2. Iterates over all matching table entries in `gg_table_config`.
3. For each table entry, iterates over all `report_type` values in its `info` array.
4. Sets `req.body.report_type` and `req.body.gg_table` and calls `process_report(req, res)`.
5. After all iterations, returns aggregate stats and resets counters.

## `process_report(req, res)` — internal function

Handles the `client_id` routing logic before calling `main`:

| `client_id` value | Behavior |
|---|---|
| `'all'` | Queries `DISTINCT client_id` from the dbt table, sorts numerically, processes each one in sequence |
| A finite numeric string | Converts to number, calls `main` once |
| Anything else | Returns HTTP 500 with `{ error: "valid client_id parameter required" }` |

## Counters

Module-level counters `total_processed`, `missing`, and `late` accumulate across all `main()` calls during the request, then are included in the response and reset. Note: counter resets happen after the response is sent, so concurrent requests could cause counter contamination.

## Dependencies

- `main.js` — core check function
- `s3Helpers.js` — `bigquery` client (for the `all` path)
- `gg_table_config.json` — table-to-report-type mapping
- `express`, `cors`, `dotenv`
