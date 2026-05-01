# gg_table_config.json

**Role:** Per-table report type configuration. Defines how dates and file suffixes are computed for each BigQuery dbt table's S3 check.

## Overview

This is the primary configuration file for the checker app. Every table that can be checked must have an entry here. It is read by `s3Helpers.js` at startup and consulted by `date_modify`, `suffix_modify`, `getTableInfo`, and `getS3ReportType` when building S3 file paths.

## Schema

```json
[
  {
    "table": "<dbt_table_name>",
    "info": [
      {
        "report_type": "<Amazon SP-API report type>",
        "s3_report_type": "<optional: S3 folder name if different from report_type>",
        "days": <integer: day offset applied to the report date>,
        "suffix": "<file suffix appended to the S3 key>"
      }
    ]
  }
]
```

### Top-level fields

| Field | Type | Description |
|---|---|---|
| `table` | string | BigQuery dbt table name. Matched against the `table` query parameter in API requests. |
| `info` | array | One or more report type entries for this table. A table can have multiple report types. |

### `info` entry fields

| Field | Type | Required | Description |
|---|---|---|---|
| `report_type` | string | Yes | Amazon SP-API report type. Must match values stored in the dbt table. |
| `s3_report_type` | string | No | Override for the S3 folder name. Used when the dbt report_type differs from the folder name on S3. |
| `days` | integer | Yes | Day offset added to the report date when computing the S3 path and due-by date. `0` means same-day; `13` means 13 days after the report date. |
| `suffix` | string | Yes | File extension/suffix appended to the S3 key. May contain `%ASIN%` as a placeholder that gets substituted with the actual ASIN value at runtime. |

## Configured tables

| Table | Report Type | Days Offset | Suffix |
|---|---|---|---|
| `gapguardian_all_dates_amazon_fulfilled_shipments` | `GET_AMAZON_FULFILLED_SHIPMENTS_DATA_GENERAL` | 0 | `.tsv.gz` |
| `gapguardian_all_dates_fba_all_listings` | `GET_FBA_INVENTORY_PLANNING_DATA` | 0 | `.tsv.gz` |
| `gapguardian_all_dates_fba_fulfillment_customer_returns_data` | `GET_FBA_FULFILLMENT_CUSTOMER_RETURNS_DATA` | 13 | `.tsv.gz` |
| `gapguardian_all_dates_fba_inventory_planning_data` | `GET_FBA_INVENTORY_PLANNING_DATA` | 0 | `.tsv.gz` |
| `gapguardian_all_dates_ledger_detail` | `GET_LEDGER_DETAIL_VIEW_DATA` | 0 | `.tsv.gz` |
| `gapguardian_all_dates_merchant_listings_all_data` | `GET_MERCHANT_LISTINGS_ALL_DATA` | 0 | `_asinGranularity=CHILD_dateGranularity=DAY.tsv.gz` |
| `gapguardian_all_dates_merchant_listings_fyp_report` | `GET_MERCHANTS_LISTINGS_FYP_REPORT` | 0 | `.tsv.gz` |
| `gapguardian_all_dates_myi_all_inventory` | `GET_FBA_MYI_ALL_INVENTORY_DATA` | 0 | `.tsv.gz` |
| `gapguardian_all_dates_reserved_inventory` | `GET_RESERVED_INVENTORY_DATA` | 0 | `.tsv.gz` |
| `gapguardian_all_dates_restock_inventory_recommendations` | `GET_RESTOCK_INVENTORY_RECOMMENDATIONS_REPORT` | 0 | `.tsv.gz` |
| `gapguardian_all_dates_vendor_sales_manufacturing_dbt` | `GET_VENDOR_SALES_MANUFACTURING_REPORT__RETAIL_MANUFACTURING_DAY` | 0 | `_sellingProgram=RETAIL_distributorView=MANUFACTURING_reportPeriod=DAY.json.gz` |
| `gapguardian_all_dates_vendor_sales_sourcing_dbt` | `GET_VENDOR_SALES_SOURCING_REPORT__RETAIL_SOURCING_DAY` | 0 | `_sellingProgram=RETAIL_distributorView=SOURCING_reportPeriod=DAY.json.gz` |
| `gapguardian_historical_new_trial` | `GET_VENDOR_SALES_MANUFACTURING_REPORT__RETAIL_MANUFACTURING_DAY` + 2 others | 0 | various |
| `gapguardian_sales_and_traffic_restatement` | `GET_SALES_AND_TRAFFIC_REPORT` | 0 | `_asinGranularity=CHILD_dateGranularity=DAY.json.gz` |
| `gapguardian_search_query_performance_top_1200` | `GET_BRAND_ANALYTICS_SEARCH_QUERY_PERFORMANCE_REPORT` | 6 | `_asin=%ASIN%.json.gz` |

## Special cases

### `s3_report_type` override

`gapguardian_sales_and_traffic_restatement` uses `GET_SALES_AND_TRAFFIC_REPORT` as the dbt report type but `GET_SALES_AND_TRAFFIC_REPORT__CHILD_DAY` as the S3 folder name. `getS3ReportType` reads the `s3_report_type` field to resolve this discrepancy.

### `%ASIN%` placeholder in suffix

`gapguardian_search_query_performance_top_1200` has `"suffix": "_asin=%ASIN%.json.gz"`. At runtime, `suffix_modify` replaces `%ASIN%` with the ASIN value from the BigQuery report row, so each file check targets the ASIN-specific file.

### Multi-report tables

`gapguardian_historical_new_trial` has three `info` entries (Vendor Sales Manufacturing, Vendor Sales Sourcing, and Sales & Traffic), meaning all three report types are checked for each client on this table.

## How it is used

1. `run_per_client.js` and `run_client.js` read `gg_table_config` to enumerate which report types to check for a table.
2. `s3Helpers.getTableInfo(table, report_type)` looks up the specific `info` entry.
3. `date_modify` uses `days` to compute the end date in the S3 path.
4. `suffix_modify` uses `suffix` (with optional ASIN substitution) to complete the S3 key.
5. `getS3ReportType` uses `s3_report_type` (if present) for the S3 folder segment.
