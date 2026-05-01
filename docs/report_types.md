# report_types.json

**Role:** Canonical reference list of Amazon SP-API report types with their day offsets and file suffixes. Used as input for the now-disabled `write_config.js` config generator.

## Overview

`report_types.json` is an array of space-delimited strings. Each string encodes three fields: the SP-API report type name, a day offset, and the expected S3 file suffix. When parsed, each string becomes a `{ report_type, days, suffix }` object.

## Schema

Each entry is a string in the format:
```
"<REPORT_TYPE_NAME> <days> <suffix>"
```

| Position | Field | Description |
|---|---|---|
| 1 | `report_type` | Amazon SP-API report type constant |
| 2 | `days` | Day offset for computing the report's end date |
| 3 | `suffix` | File extension / S3 key suffix |

Parsed by splitting on spaces: `entry.split(" ")` → `[report_type, days, suffix]`.

## Entries

| Report type | Days | Suffix |
|---|---|---|
| `GET_AMAZON_FULFILLED_SHIPMENTS_DATA_GENERAL` | 1 | `.tsv.gz` |
| `GET_FBA_INVENTORY_PLANNING_DATA` | 1 | `.tsv.gz` |
| `GET_FBA_FULFILLMENT_CUSTOMER_RETURNS_DATA` | 14 | `.tsv.gz` |
| `GET_FBA_SNS_FORECAST_DATA` | 1 | `.tsv.gz` |
| `GET_FBA_SNS_PERFORMANCE_DATA` | 1 | `.tsv.gz` |
| `GET_LEDGER_DETAIL_VIEW_DATA` | 1 | `.tsv.gz` |
| `GET_LEDGER_SUMMARY_VIEW_DATA__COUNTRY_DAILY` | 1 | `_aggregateByLocation=COUNTRY_aggregatedByTimePeriod=DAILY.tsv.gz` |
| `GET_MERCHANT_LISTINGS_ALL_DATA` | 1 | `_asinGranularity=CHILD_dateGranularity=DAY.tsv.gz` |
| `GET_MERCHANTS_LISTINGS_FYP_REPORT` | 1 | `.tsv.gz` |
| `GET_FBA_MYI_ALL_INVENTORY_DATA` | 1 | `.tsv.gz` |
| `GET_RESERVED_INVENTORY_DATA` | 1 | `.tsv.gz` |
| `GET_RESTOCK_INVENTORY_RECOMMENDATIONS_REPORT` | 1 | `.tsv.gz` |
| `GET_VENDOR_SALES_MANUFACTURING_REPORT__RETAIL_MANUFACTURING_DAY` | 1 | `_sellingProgram=RETAIL_distributorView=MANUFACTURING_reportPeriod=DAY.json.gz` |
| `GET_VENDOR_SALES_SOURCING_REPORT__RETAIL_SOURCING_DAY` | 1 | `_sellingProgram=RETAIL_distributorView=SOURCING_reportPeriod=DAY.json.gz` |
| `GET_VENDOR_TRAFFIC_REPORT__DAY` | 1 | `_reportPeriod=DAY.json.gz` |
| `GET_SALES_AND_TRAFFIC_REPORT__CHILD_DAY` | 1 | `_asinGranularity=CHILD_dateGranularity=DAY.json.gz` |
| `GET_SALES_AND_TRAFFIC_REPORT__SKU_DAY` | 1 | `_asinGranularity=SKU_dateGranularity=DAY.json.gz` |
| `GET_SALES_AND_TRAFFIC_REPORT` | 1 | `.tsv.gz` |
| `GET_BRAND_ANALYTICS_SEARCH_QUERY_PERFORMANCE_REPORT` | 7 | `_asin=B07DCLKNHN.json.gz` |

## Relationship to `gg_table_config.json`

This file predates the current `gg_table_config.json`. The values here served as the source of truth for day offsets and suffixes. Note some discrepancies:

- Day offsets here are mostly `1`, while `gg_table_config.json` uses `0` for many of the same report types — the active code uses `gg_table_config.json` values.
- `GET_BRAND_ANALYTICS_SEARCH_QUERY_PERFORMANCE_REPORT` shows 7 days here vs. 6 days in `gg_table_config.json`.
- The suffix for `GET_BRAND_ANALYTICS_SEARCH_QUERY_PERFORMANCE_REPORT` here contains a hardcoded ASIN (`B07DCLKNHN`), while `gg_table_config.json` uses the `%ASIN%` placeholder for dynamic substitution.

## Usage

Imported only by `write_config.js` and `run_per_client.js`. In `write_config.js` (disabled), it was used to populate `info` arrays for each table. In `run_per_client.js`, it is imported but not referenced in the active code path.

The active configuration is `gg_table_config.json` — this file is effectively a legacy reference.
