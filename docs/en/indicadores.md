<!-- traduzido de: cf05adec5762 -->
# Indicators: definition, formula, denominator, period and SQL

All of them are calculated in the database (`mart` schema); the screen only displays them. The same SQL appears in each chart under "How do we calculate it? → See the SQL query". The definitions come from [BDR-001](bdr/BDR-001-definicoes-de-uso-e-retorno.md).

## Basis of all of them: who is eligible and whether they came back (`mart.vw_usuarios`)

**Definition:** one row per person (pseudonymized IP). 1st day = 1st day of use in São Paulo time. Came back = some use (an assistant answer) on another day, from D+1 to D+7. Eligible = 1st use from 14 days after the start of the base up to 8 days before the end (complete 7-day window).

```sql
CREATE VIEW mart.vw_usuarios AS
WITH ev AS (
    SELECT usuario_id, ts, (ts AT TIME ZONE 'America/Sao_Paulo')::date AS dia
    FROM mart.eventos
),
primeiro AS (SELECT usuario_id, min(dia) AS dia1 FROM ev GROUP BY 1),
limites AS (
    SELECT min(ts) + interval '14 days' AS inicio_minimo,
           max(ts) - interval '8 days'  AS inicio_maximo
    FROM mart.eventos
)
SELECT p.usuario_id, p.dia1,
       date_trunc('week', p.dia1)::date                        AS semana,
       min(e.ts) FILTER (WHERE e.dia = p.dia1)                 AS inicio,
       bool_or(e.dia BETWEEN p.dia1 + 1 AND p.dia1 + 7)         AS retornou,
       count(DISTINCT e.dia)                                   AS dias_ativos
FROM primeiro p JOIN ev e USING (usuario_id) CROSS JOIN limites l
GROUP BY p.usuario_id, p.dia1, l.inicio_minimo, l.inicio_maximo
HAVING min(e.ts) FILTER (WHERE e.dia = p.dia1) BETWEEN l.inicio_minimo AND l.inicio_maximo;
```

The margin of error (Wilson 95% CI) is the function `mart.wilson(came_back, people, ±1)`.

## 1. 7-day return

| | |
|---|---|
| Definition | % of new people who used the assistant again on another day, within 7 days |
| Formula | came back ÷ eligible new people |
| Denominator | eligible new people (2,266 in the whole base) |
| Period | 1st use between 04/22/2023 and 04/21/2024 (or the period of the filter) |
| Small sample | with fewer than 30 people, the API returns no number (not even the count); the screen shows "fewer than 30" and "widen the segment" |

```sql
SELECT usuarios, voltaram, retorno_pct, ic_lo, ic_hi FROM mart.vw_retorno_geral;   -- A resposta

-- Explorar (com os 5 filtros; parâmetro nulo = sem filtro)
WITH recorte AS (
    SELECT * FROM mart.vw_explorar
    WHERE dia1 BETWEEN %(inicio)s AND %(fim)s
      AND (%(idioma)s::text IS NULL OR idioma = %(idioma)s)
      AND (%(dispositivo)s::text IS NULL OR dispositivo = %(dispositivo)s)
      AND (%(tema)s::text IS NULL OR tema = %(tema)s)
      AND (%(modelo)s::text IS NULL OR modelo = %(modelo)s)
)
SELECT count(*) AS n, count(*) FILTER (WHERE retornou) AS voltaram,
       round(100.0 * count(*) FILTER (WHERE retornou) / nullif(count(*), 0), 1) AS retorno_pct,
       mart.wilson(count(*) FILTER (WHERE retornou), nullif(count(*), 0), -1) AS ic_lo,
       mart.wilson(count(*) FILTER (WHERE retornou), nullif(count(*), 0), 1)  AS ic_hi
FROM recorte;
```

## 2. Return month by month and by week

| | |
|---|---|
| Definition | the same return, for those who started in each month (Explore) or week (The answer). In the week, the **chance band** is where the number would fall just by luck if the return were that of the whole base: p ± 1.96 × √(p(1−p)/n) |
| Denominator | new people of the month/week |
| Period | month/week of the 1st use (week from Monday to Sunday, São Paulo time) |
| Small sample | a month or week with fewer than 30 people comes out of the API with no numbers and has no point on the screen |

```sql
-- Explorar: o mesmo "recorte" acima, agrupado por mês
SELECT mes, count(*) AS n, count(*) FILTER (WHERE retornou) AS voltaram,
       round(100.0 * count(*) FILTER (WHERE retornou) / count(*), 1) AS retorno_pct,
       mart.wilson(count(*) FILTER (WHERE retornou), count(*), -1) AS ic_lo,
       mart.wilson(count(*) FILTER (WHERE retornou), count(*), 1)  AS ic_hi
FROM recorte GROUP BY mes ORDER BY mes;

-- A resposta: pré-calculado por semana, com a faixa do acaso
SELECT c.semana, c.novos, c.voltaram, c.retorno_pct, c.ic_lo, c.ic_hi,
       round(g.retorno_pct - 196 * sqrt(g.retorno_pct / 100 * (1 - g.retorno_pct / 100) / c.novos), 1) AS acaso_lo,
       round(g.retorno_pct + 196 * sqrt(g.retorno_pct / 100 * (1 - g.retorno_pct / 100) / c.novos), 1) AS acaso_hi
FROM mart.mv_coortes_semanais c CROSS JOIN mart.vw_retorno_geral g
ORDER BY c.semana;
```

## 3. Who comes back more, by group (Explore)

| | |
|---|---|
| Definition | return of each group of language, device, topic of the 1st conversation or model |
| Denominator | people in the group, within the segment |
| Small sample | a group with fewer than 30 people comes out of the API with no numbers; the screen writes "few people" instead of the bar |
| Reading | simple comparison; the sentence only calls "confirmed" a difference that passes the two-proportion test at 99% |

```sql
SELECT tema AS categoria, count(*) AS n, count(*) FILTER (WHERE retornou) AS voltaram,
       round(100.0 * count(*) FILTER (WHERE retornou) / count(*), 1) AS retorno_pct,
       mart.wilson(count(*) FILTER (WHERE retornou), count(*), -1) AS ic_lo,
       mart.wilson(count(*) FILTER (WHERE retornou), count(*), 1)  AS ic_hi
FROM recorte GROUP BY tema ORDER BY retorno_pct DESC;   -- idem para idioma, dispositivo, modelo
```

## 4. Which topic people arrive with (Explore)

| | |
|---|---|
| Definition | % of people by the topic of the 1st conversation × % of all the conversations of those people |
| Denominator | people in the segment / conversations of the people in the segment |
| Period | that of the filter |
| Small sample | a topic with fewer than 30 people comes out of the API with no numbers; the screen writes "few people" |

```sql
SELECT r.tema AS categoria, count(DISTINCT r.usuario_id) AS n,
       round(100.0 * count(DISTINCT r.usuario_id) / sum(count(DISTINCT r.usuario_id)) OVER (), 1) AS pct_pessoas,
       round(100.0 * count(c.conv_id) / sum(count(c.conv_id)) OVER (), 1) AS pct_conversas
FROM recorte r JOIN mart.conversas c ON c.usuario_id = r.usuario_id
GROUP BY r.tema ORDER BY pct_pessoas DESC;
```

## 5. Effect of each factor (The answer)

| | |
|---|---|
| Definition | how many percentage points more or fewer people come back with the characteristic, comparing similar people |
| Formula | average marginal effect of a logistic regression with all factors and the period; 95% CI by the delta method |
| Denominator | the 2,266 eligible people |
| Period | whole base (1st use between 04/22/2023 and 04/21/2024) |
| Small sample | a group with fewer than 30 people comes out of the API with no numbers and does not appear |

Calculated in the load (`analise/efeitos.py`) and stored in `mart.efeitos`:

```sql
SELECT fator, rotulo, nivel, referencia, n, retorno_pct, retorno_ref_pct,
       bruto_pp, ajustado_pp, ajustado_lo, ajustado_hi, p
FROM mart.efeitos;
```

## 6. Does GPT-4 make a difference? (The answer)

| | |
|---|---|
| Definition | difference in return between those whose 1st conversation was with GPT-4 and with GPT-3.5 |
| Formula | difference in proportions in each availability regime (Newcombe CI) and difference weighted by the inverse propensity score (IPW, bootstrap CI) |
| Denominator | people in each regime; in the IPW, those of the period when GPT-4 existed |
| Period | GPT-4 optional: Apr–Jun/23 and Nov/23; GPT-4 default: Dec/23–Apr/24 |
| Small sample | all groups have more than 30 people; a smaller group would not appear |

Calculated in the load (`analise/efeitos.py`) and stored in `mart.gpt4_selecao`:

```sql
SELECT metodo, detalhe, dif_pp, lo, hi, n FROM mart.gpt4_selecao;
```

## 7. Did the week change by profile or by rate? (The answer)

| | |
|---|---|
| Definition | how much of the change in the return of a week, against the 4 previous ones, comes from the profile of who arrived and how much from the return within each profile |
| Formula | Kitagawa decomposition: profile = Σ (weight in the week − weight before) × average return; rate = Σ (return in the week − return before) × average weight |
| Denominator | new people of the week and of the 4 previous weeks |
| Period | week of 11/20/2023 against 10/23 to 11/19/2023 |
| Small sample | a group with fewer than 30 people before or in the week comes out of the API with no numbers; the screen warns that, with ~45 people per week, the variation may be chance (homogeneity test across weeks, p = 0.21) |

Calculated in the load (`analise/semana.py`) and stored in `mart.semana_decomposicao`:

```sql
SELECT segmento, round(sum(mix_pp), 1) AS mix_pp, round(sum(taxa_pp), 1) AS taxa_pp
FROM mart.semana_decomposicao GROUP BY segmento ORDER BY segmento;
```

## 8. Sensitivity to the counting rules (The answer)

| | |
|---|---|
| Definition | the 7-day return recalculated changing one counting rule at a time (what coming back is, who the person is, window, time zone, cuts) |
| Formula | that of indicator 1, with the rule changed |
| Denominator | eligible people under each rule |
| Period | whole base |
| Small sample | does not apply (all rules have more than 2,000 people) |

Calculated in the load (`analise/sensibilidade.py`) and stored in `mart.sensibilidade`:

```sql
SELECT cenario, usuarios, voltaram, retorno_pct, ic95 FROM mart.sensibilidade;
```
