# package.json

**Role:** Node.js project manifest. Defines the application name, version, entry point, npm scripts, and runtime dependencies.

## Project metadata

| Field | Value |
|---|---|
| `name` | `checker_app` |
| `version` | `1.0.0` |
| `description` | `checker app` |
| `author` | `jr` |
| `license` | `ISC` |
| `type` | `commonjs` |
| `main` | `index.js` |

## npm scripts

| Script | Command | Description |
|---|---|---|
| `start` | `node --watch-path=. index.js` | Starts the server with file-watching enabled (auto-restarts on changes) |
| `start2` | `node index.js` | Starts the server once without file watching |
| `test` | *(not configured)* | Placeholder — exits with error code 1 |

Run with:
```bash
npm start        # development (auto-reload)
npm run start2   # production-style single run
```

## Dependencies

| Package | Version | Purpose |
|---|---|---|
| `@aws-sdk/client-s3` | `^3.929.0` | S3 `HeadObject` calls to check file existence |
| `@aws-sdk/client-secrets-manager` | `^3.929.0` | AWS Secrets Manager client (imported but not actively used) |
| `@google-cloud/bigquery` | `^8.1.1` | BigQuery client for reading report metadata and writing check results |
| `cors` | `^2.8.5` | Express CORS middleware |
| `dotenv` | `^17.2.3` | Loads environment variables from `.env` file |
| `express` | `^5.1.0` | HTTP server and routing framework |
| `luxon` | `^3.7.2` | Date/time arithmetic in `slaChecker.js` |
| `moment` | `^2.30.1` | Date formatting |
| `moment-timezone` | `^0.6.0` | UTC-aware date formatting used throughout the app |
| `serverless-http` | `^4.0.0` | Wraps the Express app for AWS Lambda deployment |

## Environment variables required at runtime

These are not declared in `package.json` but are required by the application (loaded via `dotenv`):

| Variable | Used by |
|---|---|
| `PORT` | `index.js` |
| `AWS_REGION` | `s3Helpers.js` |
| `AMAZON_ACCESS_KEY` | `s3Helpers.js` |
| `AMAZON_SECRET_ACCESS_KEY` | `s3Helpers.js` |
| `BQ_PROJECT` | `s3Helpers.js` |
| `BQ_PROJECT_DEV` | `s3Helpers.js` |
| `BQ_PROJECT_PROD` | `s3Helpers.js` |
| `BQ_DATASET_PROD` | `main.js` |
| `BQ_DATASET_DEV` | `main.js` |
| `CHECKS_TABLE` | `main.js` |

A `key.json` file is also required in the project root for BigQuery authentication (excluded from version control via `.gitignore`).
