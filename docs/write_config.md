# write_config.js

**Role:** Utility endpoint that was intended to write/refresh `gg_table_config.json` by querying BigQuery for distinct report types per table. Currently disabled.

## Overview

`write_config.js` exposes a `GET /write_config` router. The active code path immediately returns `{ status: false }` — the rest of the function body is unreachable (dead code). The logic below describes what the function was designed to do.

## Endpoint

### `GET /write_config`

**Current response:** `{ status: false }` (always, immediately)

## Intended behavior (currently unreachable)

If the early return were removed, the endpoint would:

1. Parse `report_types.json` — each entry is a space-delimited string `"<report_type> <days> <suffix>"`. These are split into `{ report_type, days, suffix }` objects.

2. For each table name in `gg_tables.json`:
   - Query BigQuery: `SELECT DISTINCT report_type FROM amazon-sp-report-loader.dbt.<table>`
   - Cross-reference the returned report types against the parsed `report_types.json` list.
   - Build an output object: `{ table, info: [matching entries] }`.

3. Return the filtered array (only tables with at least one matching report type) as the response.

This was designed to auto-generate or validate the contents of `gg_table_config.json` by querying which report types are actually present in each dbt table.

## Why it is disabled

The endpoint always returns early with `{ status: false }` before any BigQuery queries run. This suggests the config-writing logic was either replaced by the static `gg_table_config.json` file or is temporarily disabled to prevent accidental overwrites.

## Dependencies

- `s3Helpers.js` — `bigquery` client
- `gg_tables.json` — list of all known dbt table names
- `report_types.json` — canonical list of report types with day offsets and file suffixes
- `express`, `cors`, `dotenv`
