<!-- traduzido de: 21c07f075249 -->
# Retention of an AI assistant: findings and decisions

**Client question:** what makes a person who tried the assistant come back to use it within 7 days? Which factors have the largest effect, how much does each one weigh, and how much of it is cause and not selection?
**Base:** WildChat-1M, conversations with `country = 'Brazil'`: 11,621 conversations, 2,266 eligible new people (Apr/2023–Apr/2024).
**Detail of each step:** [`docs/analise/`](analise/) (quality, definitions, variables, EDA, topics, analysis) · decisions: [`docs/bdr/`](bdr/), [`docs/adr/`](adr/) · incidents: [`docs/incidente-4.2.md`](incidente-4.2.md) · AWS architecture: [`docs/arquitetura-aws.md`](arquitetura-aws.md).

## 1. The answer

**18.4% come back** on another day, between the 1st and the 7th day after the first use (95% CI: 16.8–20.0).

| # | Finding (adjusted effect, 95% CI) | Decision it supports |
|---|---|---|
| 1 | **1 in every 5 people arrives just testing (14.6%) or asking for an image, video or audio (4.4%)** and comes back ~6%, against ~21% of those who arrive with a real request: **−15.6 pp [−19.6; −11.6]** and **−14.7 pp [−18.7; −10.7]**. | Redesign the 1st answer for those who just test (concrete uses with examples) and answer media requests with a useful alternative instead of refusing. Validate with A/B. Closing half of the gap = **+1.4 pp** in the total return. |
| 2 | **The model does not change the return.** GPT-4: −1.1 pp [−5.8; +3.6] adjusted; +2.9 pp [−1.7; +7.3] by IPW; +1.7 pp when the person chose it and +1.3 pp when it was the default, both crossing zero. | Do not use a more expensive model as a retention lever; invest in the 1st experience. |
| 3 | **On a phone, the return is 7.9 pp lower** [−11.3; −4.4], with the same topic, language, time of day and period. | Audit the mobile experience and test an optimized version in A/B; track phone as a risk segment. |

**Cause or selection.** The period (GPT-4 goes from 0% to 94% of conversations over the year), the intent on arrival and the profile were controlled; engagement on the 1st day was left out, as a mediator. For GPT-4, the equality between "chosen" and "default" indicates there is no relevant selection. **What is not proven:** that changing the 1st experience will make people come back; without an experiment, unobserved confounding remains (motivation, need). That is why each decision comes with an A/B test.

**The week of 11/20/2023** dropped 10.4 pp against the 4 previous ones. The decomposition shows that what changed was **the rate within each profile** (−10.0 pp), not the profile of who arrived (−0.4 pp). But with ~50 people per week, the test across the 37 weeks cannot tell the variation apart from chance (p = 0.21). The dashboard shows the uncertainty of each week instead of raising an alarm on a single week.

The effects of all factors, the answer quality and what the data allows or does not allow to measure are in [`analise/06-analise.md`](analise/06-analise.md).

## 2. Assumptions (made without an answer from the client) and what changes if they are wrong

| Assumption | Choice | If it is wrong |
|---|---|---|
| Who the user is | `hashed_ip` (there is no login) | IP + browser: 20.2%; IPs joined by conversation: 18.1% |
| What "coming back" is | using it on **another local day**, D+1 to D+7 (the PDF talks about "in which time zone a day counts") | a new session on the same day already counting: **28.1%**, the assumption that weighs the most |
| What counts as use | each assistant answer (only the assistant has a time) | only a new conversation: 17.1% |
| Time zone | São Paulo for all of Brazil | UTC: 19.6%. Brazil has 4 time zones: in Amazonas and Acre, the day turns 1 or 2 hours later than in São Paulo |
| Period | whole base, without the first 14 days (false "new") and without the last 8 (incomplete window) | no cuts: up to 18.7% |
| Base | public, without toxic conversations | the measured return is a **lower bound** |
| Session | only as sensitivity: pause of 15, 30 or 60 min | 33.4%, 28.1% or 24.6% if a new session counted as coming back |
| Window | 7 days, as in the question | 15.8% with 3 days; 19.8% with 14 |
| Topic | of the whole 1st conversation, among 11 fixed topics | depends on the classifier: stable (κ = 0.95) and confirmed in 5 out of 5 hypotheses |
| Engagement on the 1st day | out of the model, as a consequence (mediator) | controlling for it would erase the effect of a good 1st experience |
| Minimum sample | 30 people to show a number; 99% confidence in the sentences | below that, the number swings too much by chance |
| Country | `country` inferred from the IP | conversations through a VPN enter or leave Brazil; there is no data to measure it |

Options considered for each one: [`bdr/BDR-001`](bdr/BDR-001-definicoes-de-uso-e-retorno.md).

## 3. The dashboard

It starts with `docker compose up --build` and opens at `http://localhost:8000`. It is a **self-service BI**: business people explore on their own, without a notebook, and can check every number. Two screens ([BDR-003](bdr/BDR-003-o-que-o-dashboard-mostra.md)):

| Screen | Question | Charts and why |
|---|---|---|
| **The answer** (opens first; fixed, whole base) | The client's three questions, each with its own chart | At the top, three cards in %: the return (18.4%, margin from 16.8% to 20.0%), the people analyzed and the return if coming back on the same day counted (28.1%). Then, one block per question, with the question as the title and the answer in one sentence: **1. What makes people come back?** bars with each group's return in %, with margin of error and the average of everyone (simple comparison, flagged on the screen); **2. Which factors have the largest effect?** for each factor, the return of those who have the characteristic, with the measured value in the middle and the margin of error at the ends (e.g., 4.2% · 6.4% · 9.5%); **3. How much does each one weigh and how much is cause and not selection?** the weight of each factor in %, comparing similar people ("comes back 74% less"), also with the margin at the ends; it includes factors whose weight disappears when similar people are compared, because it came from the profile of who arrives. Next, the week-by-week return with the chance band, the sensitivity to the rules and how the topics were classified. Technical terms only in the collapsible detail |
| **Explore** (with filters: period of the 1st use, language, device, topic of the 1st conversation, model) | In this segment, how many come back, how did it evolve and who comes back more? | Main numbers; **line** of the return month by month with the shaded margin of error (trend); **columns** of new people per month (volume); **horizontal bars** by language, device, model and topic (compare groups); side-by-side bars "% of people × % of conversations" by topic (weight of heavy users). Rule-based sentences that change with the filter |

**Documentation.** A third link at the top opens, inside the dashboard itself, the repository's documents: this document, the indicators, the incidents, the AWS architecture, the BDRs and ADRs and the step-by-step analysis, in the language of the screen (Portuguese, English or Spanish). Only the files of a closed list are served, converted from Markdown on the server.

**Search.** A field at the top searches the screens (goes straight to the block), the filter values (opens Explore already filtered) and every document, by section (opens the document at the section, with an excerpt). Screens and filters are searched in the page itself; the documents, in an index built once on the server and kept in memory, with no database query. The search ignores accents and case, waits for the person to stop typing and takes less than 1 ms on the server.

**Language.** Returns in %, with one decimal place and the margin of error ("it can vary from 4.2% to 9.5%"); the weight of each factor also in %, relative to the comparison group ("comes back 74% less"); "margin of error", "comparing similar people", "may be chance", "no change". Each chart has "How do we calculate it?" with a simple explanation and the collapsible technical detail, plus the SQL query.

**Automatic sentences (Explore).** They are fixed rules, with no LLM (`app/insights.py`, tested):
- with fewer than 30 people, they conclude nothing;
- a difference is only "confirmed" if it passes the two-proportion test with 99% confidence (stricter, because whoever explores makes many comparisons);
- otherwise, the sentence says "may be chance".

**Indicators.** Definition, formula, denominator, period and the **SQL query of each one** are in [`indicadores.md`](indicadores.md).

| Indicator | Formula | Denominator | Period |
|---|---|---|---|
| 7-day return | people with use on D+1..D+7 ÷ new people | eligible new people | 1st use between 04/22/2023 and 04/21/2024, or the period of the filter |
| Return by month, week or group | the same, by month, week or group of the 1st use | new people of the month, week or group | month, week or group |
| Effect of a factor | average marginal effect of the logistic regression (percentage points) | the 2,266 people | whole base |

**Small sample:** with fewer than 30 people, the API returns no number for the group, not even the count. The screen shows "fewer than 30" and "widen the segment" for the segment, leaves the month without a point and writes "few people" instead of the bar.

**Indicators that only made sense after looking at the data**, already in the dashboard:
- return by topic of the 1st conversation;
- the share of those who arrive "just testing" or "asking for an image";
- return by device;
- "% of people × % of conversations";
- the sensitivity to the way of measuring.

Proposed for the next version: tracking with a 4-week moving window.

**What the dashboard shows and what it never shows.** It shows only aggregates and effects. It **never** shows conversation text, IP, user-agent, state or the number of a group with fewer than 30 people. The API returns these numbers empty, and a test guarantees it. The analytical base does not even store text, IP or user-agent: the user becomes `sha256(salt + hashed_ip)`.

## 4. Architecture

![Flow from the raw base to the screen](img/arquitetura.svg)

| Local component | On AWS | Why |
|---|---|---|
| `bruto` volume (parquet) | S3 | cheap and versionable raw base |
| `etl` service | ECS Fargate scheduled by EventBridge | runs the same container, with no server left on |
| Postgres | RDS PostgreSQL (automatic backup) | small volume; SQL readable by anyone on the data team |
| `app` service | ECS Fargate behind an ALB; page on S3 + CloudFront | thin API and static page |
| Topic classification | Amazon Bedrock (`LLM_PRIMARY_PROVIDER=bedrock_converse`) | the LLM stays on AWS; switching is only configuration |
| Passwords, pseudonym salt | Secrets Manager | no secret in the code |
| Logs and metrics | CloudWatch | one place for the load and the API |
| Login (outside the local scope) | Cognito on the ALB | the client sees only their own dashboard |

Detail of each service, the paths of a load and of a visit, network, security, deploy, monitoring and cost: [`arquitetura-aws.md`](arquitetura-aws.md).

**Classification portable across LLM providers.** The topic classification uses LangChain (`init_chat_model`), and the provider and model are chosen only in the `.env` (`LLM_PRIMARY_PROVIDER` and `LLM_PRIMARY_MODEL`), without changing code. Switching providers means changing two lines of configuration and running the topic validation again (`analise/validar_temas.py`), because the model changes:

| Provider | Configuration | Status |
|---|---|---|
| OpenAI (API key) | `openai` | used in the analysis |
| Amazon Bedrock (Claude, Llama, Mistral and others) | `bedrock_converse` | ready; it is the delivery path, with the LLM and the cost on AWS |
| Claude through the Anthropic API | `anthropic` | just install `langchain-anthropic` |
| Others supported by LangChain (Google, Azure OpenAI, local models) | the provider's name | just install the provider's package |

**Model of the analytical base** (`mart` schema, [`etl/sql/`](../etl/sql/)):

| Object | Grain | Key | Who writes → who reads |
|---|---|---|---|
| `conversas` | one conversation (no text, IP or user-agent) | `conv_id` | load → app |
| `eventos` | one assistant answer (time of use) | `usuario_id`, `ts` | load → views |
| `perfil_usuario` | one person: language, device, topic and model of the 1st conversation | `usuario_id` | load → app |
| `vw_usuarios` / `mv_usuarios` | one eligible person: 1st day, week, came back | `usuario_id` | SQL (definition from BDR-001) |
| `vw_explorar` | `mv_usuarios` + `perfil_usuario` | `usuario_id` | app (Explore screen) |
| `mv_coortes_semanais`, `vw_retorno_geral` | week / total, with Wilson CI | `semana` | app |
| `efeitos`, `gpt4_selecao`, `semana_decomposicao`, `sensibilidade`, `testes`, `uso_por_categoria` | results of the statistical analysis | — | load → app (The answer) |
| `cargas`, `migracoes` | one run / one migration | `id` / `nome` | load → app (provenance) |

**Endpoints**

| Endpoint | Input | Output |
|---|---|---|
| `GET /api/explorar` | `inicio`, `fim` (YYYY-MM-DD) and `idioma`, `dispositivo`, `tema`, `modelo` (optional; a value outside the list → 400); `lang` = language of the screen (`pt`, `en` or `es`, used in the sentences) | segment and base with margin of error, monthly series, return by group in the 4 dimensions, arrival by topic, sentences, filter options, provenance, SQL |
| `GET /api/analise` | — | overall and weekly return, raw and adjusted effects with CI, GPT-4 by three methods, decomposition of the week, sensitivity, tests, provenance, SQL |
| `GET /api/documentos` | — | index of the Documentation: name, group and title of each document |
| `GET /api/documentos/{nome}` | name of a document in the list (outside it → 404) and `lang` (`pt`, `en` or `es`) | title and HTML of the document, with the internal links pointing to the page itself |
| `GET /api/busca` | `q` (what was typed) and `lang` | up to 8 document sections in the language of the screen: document, section, anchor and an excerpt |
| `GET /healthz` | — | `{"status": "ok"}` |

Interactive documentation at `/api/docs`.

**Other countries.**
- **Interface: ready.** The screen is already in Portuguese, English and Spanish (selector at the top, or `/?lang=en`). Each text goes through a translation function with Portuguese as the key; the translations are in `app/static/i18n.json`, and `tests/test_traducoes.py` fails if a new sentence has no translation. Numbers and dates follow the format of each language, and the automatic sentences come from the API in the language of the screen (`lang`). The documents are also in the three languages: the Portuguese original is in `docs/`, the translations in `docs/en` and `docs/es`, and each translation keeps the fingerprint of the original; if the Portuguese changes and the translation does not, `tests/test_traducoes.py` fails.
- **Time zone: still fixed.** It is the critical point, because the return is by local day. Today `'America/Sao_Paulo'` is in `vw_usuarios` and in the database. For other countries, the time zone becomes a column per country (or per state, for countries with several, like Brazil itself), used in `vw_usuarios` instead of the constant.
- **Comparison: does not exist yet.** `pais` enters as a dimension in every table of the `mart` and in the routes (`?pais=`). The effects model runs per country, and the countries are compared by the effects with CI, not by raw rates, because the arrival profile changes between them.
- **Topics:** need revalidation per language.

**Performance.**
- **Precomputed:** the definition of "came back" is materialized once per load, at the person grain (`mv_usuarios`, 2,266 rows with 1st day, week and whether they came back). Any filter on the screen becomes a read of these ready rows, without recalculating events. The cohorts are in a materialized view, and the statistical effects and tests in a table: the model runs in the load, never in the request.
- **Cache:** the API keeps the result of each query in memory, with the **load version in the key**. The cache expires exactly when a new load is published, with no guessed timeout. Each request makes a minimal query on `mart.cargas` to know the version.
- **Measurement:** each response carries the `server-timing` header (visible in the browser) and a JSON log with `request_id`, route, parameters, status and duration. Measured locally: 10 to 85 ms on the 1st call of each route or segment (the first one of the API includes opening the connection) and about 3 ms with cache.
- **In production:** p50 and p95 per route in CloudWatch Logs Insights, with an alarm; the time in the browser is not measured yet (next step).

## 5. Maintenance

**What is recorded in each layer to investigate a wrong number:**
- **Load:** `mart.cargas` with the code version, rows in the source, in Brazil and loaded, users, return, reconciliation and duration.
- **Database:** numbered migrations with the decision commented at the top.
- **Backend:** JSON log per request (`request_id`, route, status, duration).
- **Screen:** the footer shows the load, the version, whether the reconciliation passed and the **request code** (`request_id`), the same one that is in the server log. With a screenshot, you get straight to the record of that query.

**Full traceability:** designed, it is one of the next steps (§7).

**How to notice the divergence before the client:** the load compares the return per cohort in SQL and in Python and **does not publish** if they diverge. In production, there is also a CloudWatch alarm for a load with an error or for the "users ÷ IPs" ratio outside its history (the symptom of §4.2).

**Tests that prevent a definition from changing without anyone noticing:**
- `tests/test_definicoes.py`: who the person is (the same IP with different browsers is the same person), 1st day, return D+1..D+7, time zone and cuts;
- `tests/test_estrutura.py`: the **frozen definition of the return** (the hash of the view and of the margin of error in the database; if it changes, the test breaks and asks for the review of BDR-001), applied migrations never edited and the dashboard role only reading the `mart`;
- `tests/test_variaveis.py`, `tests/test_classificar.py` and `tests/test_efeitos.py` (the model recovers an effect planted in synthetic data);
- `tests/test_api.py` and `tests/test_insights.py`: contract of the routes, validation of the filters, no number for groups with fewer than 30 people, the automatic sentences and the search (finds the right section and is fast);
- `tests/test_traducoes.py`: no sentence on the screen without a translation and no translated document out of date with the original;
- `tests/test_explorar_dados.py`: integration with the loaded database, which checks that with no filter the number is the official one, that the parts add up to the whole and that, for random filters, the SQL matches an independent calculation in Python.

Every push runs in the CI (`.github/workflows/ci.yml`): ruff, formatting, mypy and the tests, with a Postgres that receives the roles and the migrations. The integration with the real data runs locally, with compose.

**Path to production:** dev → staging → production environments, with the same container in all of them. A new migration is applied by the load (`mart.migracoes`), always a new file and never edited. The deploy is done by the CI with tests, image build, ECR and update of the ECS service. Staging receives the full load and the reconciliation before the switch.

## 6. Risks and decisions to take to the client

| Risk | Mitigation or decision |
|---|---|
| **An IP is not a person** (shared network, network change) | Sensitivity shows ±2 pp; **ask the client for a user ID** (login or cookie) |
| Effects are adjusted associations, not causal proof | **Decide with the client the A/B tests** of findings 1 and 3 |
| Small weekly cohorts (~45 people) | The screen shows the uncertainty; **agree on** tracking with a 4-week window |
| Topic labels come from an OpenAI LLM (analysis) | In production, Bedrock and revalidation; **confirm** the model and the cost on Bedrock |
| Public dataset without toxic conversations | The return is a lower bound; **ask** for the complete dataset if the client has it |
| The definition of "coming back" changes the number by 10 pp | **Validate with the client**: another day (18.4%) or new session (28.1%) |

## 7. Next steps

Designed and left out of this delivery because of time and risk: they change the load or the database a few hours before the delivery.

1. **Full traceability by keys.** Link each number to its origin by keys. A `usuarios` table as a dimension, with foreign keys from `conversas`, `perfil_usuario` and `eventos`; each event with the `turn_identifier` of the raw base and the `conv_id` of the conversation; `carga_id` in every table; a failed load recorded in a separate transaction; and the version equal to the commit and the hash of the source files in `mart.cargas`. The chain becomes: screen (`request_id`) → API log → `mart.cargas` (commit, source, reconciliation) → row (`carga_id`) → event (`turn_identifier`) → raw base. Today the link to the raw base already exists through the conversation (`conv_id` = 1st `turn_identifier`) and through the person (the same salt recomputes the pseudonym from the `hashed_ip`).
2. **Extra statistical robustness:** the E-value of the findings (how strong an unmeasured factor would have to be to erase the effect) and the correction for several comparisons at the same time.
3. **Other countries:** the time zone per country (or per state, where there are several), the `pais` column in every table and a comparison screen by the effects with margin of error.
4. **Time measured in the browser**, in addition to the server time that is already measured.
5. **With the client** (§6): user identifier, A/B tests of findings 1 and 3, the dataset with the toxic conversations and which definition of "coming back" applies.

## 8. Use of AI

I used Claude Code (Anthropic) as a development pair in every step: discovery, analysis, code of the load, the API and the screens, and writing of the documents. I used the OpenAI API (gpt-5.4 and gpt-5.4-nano, through LangChain) only to classify the topic of the conversations. I checked everything the AI generated, from the analysis to the screen, and fixed what did not hold up. The most important fix was in the topic: the AI classified each conversation by its first message, which is often just a "hi" before the real request, and I switched to classifying by the whole conversation. I also fixed the definition of return (the proposal of "a new session after 30 minutes" became use on another calendar day, as the brief indicates, and the number went from 28.1% to 18.4%), discarded the variable "any refusal on the 1st day" (it created a false effect, because it rises with the number of answers), switched from the smaller classifier to the larger one after reviewing the disagreements and defined the conversation key by the first `turn_identifier`, because the `conversation_hash` repeats across different people. On every load, the return calculated in SQL is compared with the one calculated in Python, and the load is not published if they diverge. I dedicated about 14 hours to the challenge.
