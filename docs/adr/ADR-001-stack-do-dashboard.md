# ADR-001 · Stack do dashboard: FastAPI + página estática + Postgres

**Status:** aceito

## Contexto

O PDF pede um dashboard com frontend, backend e base analítica, que suba do zero com um comando, rode localmente e tenha toda a infraestrutura e o custo na AWS. O público é de negócio, não técnico. Princípio do desenho: o número é calculado no banco e a tela só exibe.

## Opções consideradas

| Opção | Por que não |
|---|---|
| Power BI / Looker | Fora da AWS; sem backend nem endpoints próprios; não sobe com `docker compose` |
| Amazon QuickSight | Na AWS, mas não roda localmente nem expõe a API que o PDF pede |
| Streamlit / notebook publicado | O PDF pede dashboard, não notebook; mistura cálculo e tela |
| Next.js + React | Funciona, mas acrescenta build e dependências sem caso real que as justifique (2 telas, sem estado complexo) |
| **FastAPI + HTML/CSS/JS sem dependências + Postgres** | Escolhida |

## Decisão

- **Backend:** FastAPI fina, só `SELECT` no schema `mart`; uma rota por tela, devolvendo tudo de que a tela precisa, com a consulta SQL e a procedência de cada número.
- **Frontend:** uma página estática servida pela própria API, gráficos em SVG próprio, sem CDN nem build.
- **Análise:** Python (pandas, statsmodels) no mesmo repositório; o mesmo código roda na análise e na carga.

## Consequências

- Uma imagem Docker serve a carga e a API; o compose decide o comando e o que cada serviço enxerga.
- Em produção: API em ECS Fargate (ou App Runner), página em S3 + CloudFront, Postgres em RDS.
- Gráficos próprios custam mais código, mas não prendem o projeto a uma biblioteca e mantêm a página leve.
