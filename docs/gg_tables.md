# gg_tables.json

**Role:** Master list of all known BigQuery dbt table names in the GapGuardian data pipeline.

## Overview

`gg_tables.json` is a JSON array of strings — one entry per BigQuery dbt table. It serves as a catalogue of all tables the system is aware of. Currently it is used only by `write_config.js` (which is disabled), but it represents the full set of tables across the pipeline.

## Schema

```json
["<table_name>", "<table_name>", ...]
```

A flat array of strings. Each string is a fully qualified dbt table name (without the BigQuery project/dataset prefix, which is prepended at query time as `amazon-sp-report-loader.dbt.<table>`).

## Contents (35 tables)

### GapGuardian `all_dates` tables (historical data)

| Table name | Description |
|---|---|
| `gapguardian_all_dates_amazon_fulfilled_shipments` | FBA fulfilled shipments |
| `gapguardian_all_dates_amazon_list_transactions` | Amazon listing transactions |
| `gapguardian_all_dates_catalog` | Product catalog data |
| `gapguardian_all_dates_fba_all_listings` | FBA all listings |
| `gapguardian_all_dates_fba_fulfillment_customer_returns_data` | FBA customer returns |
| `gapguardian_all_dates_fba_inventory_planning_data` | FBA inventory planning |
| `gapguardian_all_dates_fba_sns_forecast` | FBA Subscribe & Save forecast |
| `gapguardian_all_dates_fba_sns_performance` | FBA Subscribe & Save performance |
| `gapguardian_all_dates_ledger_detail` | Ledger detail view |
| `gapguardian_all_dates_ledger_summary` | Ledger summary view |
| `gapguardian_all_dates_merchant_listings_all_data` | Merchant listings (all) |
| `gapguardian_all_dates_merchant_listings_fyp_report` | Merchant listings FYP report |
| `gapguardian_all_dates_myi_all_inventory` | FBA MYI all inventory |
| `gapguardian_all_dates_reserved_inventory` | Reserved inventory |
| `gapguardian_all_dates_restock_inventory_recommendations` | Restock recommendations |
| `gapguardian_all_dates_vendor_sales_manufacturing_dbt` | Vendor sales (manufacturing view) |
| `gapguardian_all_dates_vendor_sales_sourcing_dbt` | Vendor sales (sourcing view) |
| `gapguardian_all_dates_vendor_traffic_dbt` | Vendor traffic |

### Advertising tables

| Table name |
|---|
| `apguardian_ads_dsp` |
| `gapguardian_ads_exports` |
| `gapguardian_ads_portfolios` |

### Other GapGuardian tables

| Table name | Description |
|---|---|
| `gapgaurdian_orders_by_date_general_lw_lm_ly` | Orders by date (last week/month/year) |
| `gapguardian_catalog_asins` | Catalog ASINs |
| `gapguardian_historical_new_trial` | Historical trial table (multi-report) |
| `gapguardian_orders_hourly_data_by_date_general` | Hourly orders data |
| `gapguardian_replenishments` | Replenishments |
| `gapguardian_replenishments_list_offer_metrics` | Replenishment list offer metrics |
| `gapguardian_replenishments_selling_partner_metrics` | Replenishment selling partner metrics |
| `gapguardian_sales_and_traffic_restatement` | Sales & traffic restatement |
| `gapguardian_search_query_performance_top_1200` | Search query performance (Brand Analytics) |

### Today/Yesterday missing-data tables

| Table name | Description |
|---|---|
| `gg_today_missing_fba_all_listings` | FBA listings missing today |
| `gg_today_missing_myi_all_inventory` | MYI inventory missing today |
| `gg_today_missing_reserved_inventory` | Reserved inventory missing today |
| `gg_today_missing_restock_inventory_recommendations` | Restock recs missing today |
| `gg_ystrday_missing_sales_and_traffic` | Sales & traffic missing yesterday |

## Relationship to `gg_table_config.json`

`gg_tables.json` is a superset — it lists all tables in the pipeline. `gg_table_config.json` is the subset of tables that have active S3 check configuration. Tables in `gg_tables.json` that are not in `gg_table_config.json` cannot be checked by this app.

## Usage

Currently only imported by `write_config.js` and `run_per_client.js`. In `write_config.js` (currently disabled), it drove a loop that queried BigQuery for distinct report types per table to auto-generate config. In `run_per_client.js`, it is imported but not referenced in the active code path.
