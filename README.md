# Retenção de um assistente de IA: desafio técnico Acaso

O que faz uma pessoa que experimentou um assistente de IA voltar a usá-lo em até 7 dias? Análise estatística e dashboard sobre o WildChat-1M (conversas do Brasil).

O enunciado está em [`Desafio Técnico Acaso Análise e Dashboard de Retenção de um Assistente de IA.pdf`](<Desafio Técnico Acaso Análise e Dashboard de Retenção de um Assistente de IA.pdf>).

**Comece por aqui:** [`docs/DOCUMENTO.md`](docs/DOCUMENTO.md) traz os achados, as decisões, a arquitetura, a sustentação, os riscos e o uso de IA.

## Rodar

Requisitos: Docker com Compose, ~4 GB livres (imagens e base bruta) e acesso à internet (a primeira carga baixa ~3,4 GB do HuggingFace, um arquivo por vez, e guarda só o Brasil).

```bash
docker compose up --build
```

Na primeira vez, a carga leva cerca de 6 minutos (download e filtro); depois, cerca de 30 segundos. Quando o serviço `etl` terminar com `carga ok: ... reconciliação SQL = Python`, o dashboard estará em **http://localhost:8000**, com duas telas: **A resposta** (a pergunta de negócio respondida, com a estatística; abre primeiro) e **Explorar** (filtros por período, idioma, dispositivo, tema e modelo). A tela está em português, inglês e espanhol (seletor no topo) e tem uma busca que procura nas telas, nos filtros e nos documentos. O link **Documentação**, no topo, abre as decisões, a análise passo a passo, os indicadores e a arquitetura sem sair do dashboard. A documentação da API fica em `/api/docs`.

Nenhuma credencial é necessária: os temas das conversas já vêm classificados em `data/seed/temas.csv`, e as senhas padrão do compose servem só para rodar localmente.

## Validar os números

```bash
# retorno em 7 dias calculado no banco (o mesmo que a tela mostra)
docker compose exec db psql -U bi_owner -d bi -c "SELECT * FROM mart.vw_retorno_geral;"
# procedência da última carga e resultado da reconciliação SQL x Python
docker compose exec db psql -U bi_owner -d bi -c "SELECT * FROM mart.cargas ORDER BY id DESC LIMIT 1;"
```

Cada gráfico mostra a consulta SQL em "Como calculamos?"; todas estão em [`docs/indicadores.md`](docs/indicadores.md).

Validação automática contra o banco (com o compose no ar): os filtros, a definição do retorno congelada e o acesso só de leitura do dashboard.

```bash
DATABASE_URL_ETL=postgresql://bi_etl:local_etl@127.0.0.1:55432/bi \
DATABASE_URL_APP=postgresql://bi_app:local_app@127.0.0.1:55432/bi \
.venv/bin/python -m pytest tests/test_explorar_dados.py tests/test_estrutura.py
```

Os mesmos gates (ruff, formatação, mypy e testes) rodam no CI a cada push.

## Reproduzir a análise (fora do Docker)

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
.venv/bin/python -m etl.extrair data/raw            # base bruta do Brasil
.venv/bin/python -m analise.qualidade               # Passo 1: qualidade dos dados
.venv/bin/python -m analise.sensibilidade           # Passo 2: definições e sensibilidade
.venv/bin/python -m analise.tabela                  # Passo 3: variáveis da 1ª experiência
.venv/bin/python -m analise.eda                     # Passo 4: análise exploratória
.venv/bin/python -m analise.validar_temas           # Passo 5: validação dos temas
.venv/bin/python -m analise.efeitos                 # Passo 6: efeitos, causa x seleção
.venv/bin/python -m analise.semana 2023-11-20       #          a semana que mudou
.venv/bin/python -m pytest                          # testes (definições, variáveis, temas, frases, API)
```

Reclassificar os temas exige `OPENAI_API_KEY` ou credencial AWS (Bedrock) no `.env` (ver `.env.example`).

## Estrutura

```
analise/        análise em Python: definições, variáveis, temas, EDA, efeitos, semana
etl/            extração da base bruta e carga da base analítica (etl/sql: migrações do mart)
app/            API FastAPI e telas (HTML/CSS/JS, gráficos em SVG próprio)
db/init/        papéis do Postgres (o app só lê o schema mart)
data/seed/      temas classificados por LLM e rótulos da validação, sem conteúdo de conversa
docs/           documento final, análise passo a passo, BDRs, ADRs e incidentes
tests/          testes que travam as definições e o contrato da API
```

Requisitos do desafio e andamento: [`BACKLOG_ACASO.md`](BACKLOG_ACASO.md).

