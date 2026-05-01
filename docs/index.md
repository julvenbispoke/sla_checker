# index.js

**Role:** Application entry point. Bootstraps the Express HTTP server and wires all route modules together.

## Overview

`index.js` is the top-level file that Node.js executes when the app starts (`node index.js`). It creates the Express application, registers middleware, mounts routers, exposes a test endpoint, and starts the HTTP listener. It also exports a `handler` for serverless (AWS Lambda) deployment via `serverless-http`.

## Startup sequence

1. `dotenv.config()` — loads environment variables from a `.env` file.
2. `cors()` and `express.json()` middleware are applied globally so every route accepts cross-origin requests and JSON bodies.
3. Three routers are mounted:

| Path | Module |
|---|---|
| `/write_config` | `write_config.js` |
| `/run_per_client` | `run_per_client.js` |
| `/run_client` | `run_client.js` |

4. `app.listen(PORT || 3002)` starts the server locally.
5. `module.exports.handler = serverless(app)` makes the same app deployable as a Lambda function.

## Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/test` | Health-check. Returns the current UTC date (`YYYY-MM-DD`). |
| `*` | `/write_config` | Delegates to `write_config.js` router. |
| `*` | `/run_per_client` | Delegates to `run_per_client.js` router. |
| `*` | `/run_client` | Delegates to `run_client.js` router. |

## Dependencies

| Package | Purpose |
|---|---|
| `express` | HTTP server and routing |
| `dotenv` | Load `.env` config |
| `cors` | Allow cross-origin requests |
| `moment-timezone` | UTC date formatting for the test endpoint |
| `serverless-http` | Wrap Express for Lambda deployment |
| `luxon` | Imported but unused directly in this file (used in sub-modules) |

## Environment variables used

- `PORT` — port to listen on (default `3002`)

## Notes

- The `/main` route and the `main` module import are commented out; the `main` function is called indirectly through `run_per_client` and `run_client`.
- `bigquery_dev` is imported from `s3Helpers` but not used directly in this file.
