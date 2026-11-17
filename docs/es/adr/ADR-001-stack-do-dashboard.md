<!-- traduzido de: 9053bed4f228 -->
# ADR-001 · Stack del dashboard: FastAPI + página estática + Postgres

**Estado:** aceptado

## Contexto

El PDF pide un dashboard con frontend, backend y base analítica, que arranque desde cero con un comando, corra localmente y tenga toda la infraestructura y el costo en AWS. El público es de negocio, no técnico. Principio del diseño: el número se calcula en la base de datos y la pantalla solo lo muestra.

## Opciones consideradas

| Opción | Por qué no |
|---|---|
| Power BI / Looker | Fuera de AWS; sin backend ni endpoints propios; no arranca con `docker compose` |
| Amazon QuickSight | En AWS, pero no corre localmente ni expone la API que pide el PDF |
| Streamlit / notebook publicado | El PDF pide dashboard, no notebook; mezcla cálculo y pantalla |
| Next.js + React | Funciona, pero agrega build y dependencias sin un caso real que las justifique (2 pantallas, sin estado complejo) |
| **FastAPI + HTML/CSS/JS sin dependencias + Postgres** | Elegida |

## Decisión

- **Backend:** FastAPI delgada, solo `SELECT` en el schema `mart`; una ruta por pantalla, que devuelve todo lo que la pantalla necesita, con la consulta SQL y la procedencia de cada número.
- **Frontend:** una página estática servida por la propia API, gráficos en SVG propio, sin CDN ni build.
- **Análisis:** Python (pandas, statsmodels) en el mismo repositorio; el mismo código corre en el análisis y en la carga.

## Consecuencias

- Una imagen Docker sirve a la carga y a la API; el compose decide el comando y lo que ve cada servicio.
- En producción: API en ECS Fargate (o App Runner), página en S3 + CloudFront, Postgres en RDS.
- Los gráficos propios cuestan más código, pero no atan el proyecto a una biblioteca y mantienen la página liviana.
