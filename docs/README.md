# checker_app — Documentation

SLA checker for Amazon SP-API reports. Verifies that expected report files exist in S3 on time, and writes pass/fail results to BigQuery.

## How it works (high level)

1. An HTTP request hits `/run_per_client` or `/run_client` with a BigQuery table name.
2. BigQuery is queried for expected report metadata (client IDs, dates, marketplaces).
3. S3 `HeadObject` calls verify whether each expected file exists.
4. `slaChecker.js` classifies each file as `OK`, `LATE`, or `MISSING`.
5. Results are inserted back into BigQuery.

## File index

### JavaScript

| File | Role |
|---|---|
| [index.md](index.md) | Entry point — boots Express server, mounts all routers |
| [main.md](main.md) | Core engine — builds S3 paths, runs checks, writes results |
| [slaChecker.md](slaChecker.md) | Pure function — classifies a single file as OK / LATE / MISSING |
| [s3Helpers.md](s3Helpers.md) | Shared utilities — S3 client, BigQuery clients, path helpers |
| [run_per_client.md](run_per_client.md) | Route — resumable job-queue orchestrator for full table runs |
| [run_client.md](run_client.md) | Route — stateless single-request runner for one or all clients |
| [write_config.md](write_config.md) | Route — disabled config generator (queries BQ for report types) |
| [node_test.md](node_test.md) | Dev script — manual test for `getTableInfo` |

### JSON configuration

| File | Role |
|---|---|
| [gg_table_config.md](gg_table_config.md) | Active config — per-table report types, day offsets, S3 suffixes |
| [gg_tables.md](gg_tables.md) | Master list of all known dbt table names |
| [report_types.md](report_types.md) | Legacy reference — report type constants with offsets and suffixes |
| [marketplace.md](marketplace.md) | Marketplace ID → country code lookup table |
| [package.md](package.md) | npm manifest — dependencies, scripts, env var reference |

## Request flow diagram

```
GET /run_per_client?table=X          GET /run_client?table=X&client_id=Y
         │                                        │
         ▼                                        ▼
  run_per_client.js                        run_client.js
  (job queue in BQ)                        (stateless loop)
         │                                        │
         └──────────────┬─────────────────────────┘
                        ▼
                     main.js
              ┌────────────────┐
              │ 1. Query BQ    │  ← BigQuery (dbt table + sla config)
              │ 2. Build S3    │
              │    paths       │
              │ 3. HeadObject  │  ← S3 (amazon-reporting-data bucket)
              │ 4. decideStatus│  ← slaChecker.js
              │ 5. Insert BQ   │  ← BigQuery (results table)
              └────────────────┘
```

## Environment setup

Requires a `.env` file and a `key.json` (BigQuery service account) in the project root. See [package.md](package.md) for the full list of required environment variables.
