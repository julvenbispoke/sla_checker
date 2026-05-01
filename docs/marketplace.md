# marketplace.json

**Role:** Lookup table mapping Amazon marketplace IDs to ISO 3166-1 alpha-2 country codes.

## Overview

`marketplace.json` is a static reference array loaded by `s3Helpers.js` at startup. It is used to build the country segment of S3 file paths. The array is converted into a plain object (`MARKETPLACE_MAP`) for O(1) lookups.

## Schema

```json
[
  {
    "marketplaceid": "<Amazon marketplace ID>",
    "countrycode": "<ISO country code>"
  }
]
```

| Field | Type | Description |
|---|---|---|
| `marketplaceid` | string | Amazon's internal marketplace identifier |
| `countrycode` | string | Two-letter country code used as the S3 path segment |

## Marketplace reference

| Marketplace ID | Country Code | Country |
|---|---|---|
| `A2EUQ1WTGCTBG2` | CA | Canada |
| `ATVPDKIKX0DER` | US | United States |
| `A1AM78C64UM0Y8` | MX | Mexico |
| `A2Q3Y263D00KWC` | BR | Brazil |
| `A1RKKUPIHCS9HS` | ES | Spain |
| `A1F83G8C2ARO7P` | UK | United Kingdom |
| `A13V1IB3VIYZZH` | FR | France |
| `AMEN7PMS3EDWL` | BE | Belgium |
| `A1805IZSGTT6HS` | NL | Netherlands |
| `A1PA6795UKMFR9` | DE | Germany |
| `APJ6JRA9NG5V4` | IT | Italy |
| `A2NODRKZP88ZB9` | SE | Sweden |
| `AE08WJ6YKNBMC` | ZA | South Africa |
| `A1C3SOZRARQ6R3` | PL | Poland |
| `ARBP9OOSHTCHU` | EG | Egypt |
| `A33AVAJ2PDY3EV` | TR | Turkey |
| `A17E79C6D8DWNP` | SA | Saudi Arabia |
| `A2VIGQ35RCS4UG` | AE | United Arab Emirates |
| `A21TJRUUN4KGV` | IN | India |
| `A19VAU5U5O7RUS` | SG | Singapore |
| `A39IBJ37TRP1C6` | AU | Australia |
| `A1VC38T7YXB528` | JP | Japan |

## How it is used

In `s3Helpers.js`:

```js
const MARKETPLACE_MAP = {}
marketplaceList.forEach(x => {
    MARKETPLACE_MAP[x.marketplaceid] = x.countrycode
})
```

The resulting `MARKETPLACE_MAP` is then used in `main.js` to resolve the country segment of the S3 path:

```
amazon-selling-partners-api/<report_type>/<country>/<client_id>/...
```

If a marketplace ID is not found in the map, `buildS3Path` defaults to `'US'` (though the inline path building in `main.js` does not apply this fallback).
