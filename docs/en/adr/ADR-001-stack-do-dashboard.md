<!-- traduzido de: 9053bed4f228 -->
# ADR-001 · Dashboard stack: FastAPI + static page + Postgres

**Status:** accepted

## Context

The PDF asks for a dashboard with frontend, backend and analytical base, that starts from scratch with one command, runs locally and has all its infrastructure and cost on AWS. The audience is business people, not technical. Design principle: the number is calculated in the database and the screen only displays it.

## Options considered

| Option | Why not |
|---|---|
| Power BI / Looker | Outside AWS; no backend or endpoints of its own; does not start with `docker compose` |
| Amazon QuickSight | On AWS, but does not run locally nor expose the API the PDF asks for |
| Streamlit / published notebook | The PDF asks for a dashboard, not a notebook; it mixes calculation and screen |
| Next.js + React | Works, but adds a build step and dependencies with no real case to justify them (2 screens, no complex state) |
| **FastAPI + HTML/CSS/JS with no dependencies + Postgres** | Chosen |

## Decision

- **Backend:** a thin FastAPI, only `SELECT` on the `mart` schema; one route per screen, returning everything the screen needs, with the SQL query and the provenance of each number.
- **Frontend:** a static page served by the API itself, charts in hand-made SVG, no CDN and no build.
- **Analysis:** Python (pandas, statsmodels) in the same repository; the same code runs in the analysis and in the load.

## Consequences

- One Docker image serves the load and the API; compose decides the command and what each service can see.
- In production: API on ECS Fargate (or App Runner), page on S3 + CloudFront, Postgres on RDS.
- Hand-made charts cost more code, but do not tie the project to a library and keep the page light.
