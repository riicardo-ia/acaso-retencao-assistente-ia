<!-- traduzido de: b3b93aac6a2c -->
# ADR-002 · Analytical base: `mart` schema on Postgres, read-only role and load with reconciliation

**Status:** accepted

## Context

The PDF requires that the dashboard **does not read the raw base** and that the data goes through an analytical base designed by us. The conversations may contain personal data. The §4.2 incident shows what happens when the load changes the definition without anyone noticing.

## Options considered

| Option | Assessment |
|---|---|
| DuckDB in a file | Simple, but the dashboard and the load would share the file; no access roles |
| Redshift / Athena | Scale that the volume (11.6 thousand conversations) does not ask for |
| **Postgres with a `mart` schema and two roles** | Chosen |

## Decision

- **Raw base** = Brazil parquet (on S3 in production), mounted **only** in the load container.
- **`mart`** stores conversations and events **with no text, IP or user-agent** (user = `sha256(salt + hashed_ip)`), the views that define the return, the materialized view of the cohorts and the result tables of the analysis.
- **Roles:** `bi_etl` owns the `mart`; `bi_app` only has `SELECT` and a read-only session (`default_transaction_read_only`), with a 5 s `statement_timeout`.
- **Idempotent load:** deletes and reloads everything in the same transaction; numbered migrations in `etl/sql/`.
- **Reconciliation:** the return per cohort calculated in SQL (`mart.vw_usuarios`) is compared with the one calculated in Python (`analise/definicoes.py`); if they diverge, the transaction is not published and the load exits with an error. Each run records its provenance in `mart.cargas`.

## Consequences

- An error like the one in §4.2 (a user key different from the definition) breaks the load before it reaches the screen.
- The 95% CI of each cohort is calculated in the database (`mart.wilson`), not in JavaScript.
- In production: RDS Postgres with automatic backup; the load on scheduled ECS (EventBridge), with reprocessing by date window.
