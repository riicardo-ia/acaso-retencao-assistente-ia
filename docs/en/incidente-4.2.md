<!-- traduzido de: 6eded6f04183 -->
# Incidents · "the return of the week of 11/20/2023 dropped from 31% to 18%"

## The symptom, in numbers

| Week | Dashboard: new | Dashboard: came back | Dashboard: return | Report (hashed_ip): new | Report: came back | Report: return |
|---|---:|---:|---:|---:|---:|---:|
| 11/06 | 1,210 | 375 | 31.0% | 1,150 | 345 | 30% |
| 11/13 | 1,188 | 368 | 31.0% | 1,131 | 351 | 31% |
| **11/20** | **2,034** | 366 | **18.0%** | 1,172 | 352 | 30% |

The numerator (came back) is practically the same in both sources; what almost **doubles is the denominator**: the dashboard sees **862 more "new" people** in a week in which the report sees a normal volume. The drop is not in behavior: it is in the **count of people**.

## 1. Where I would start and why

With the **divergence between the two sources**, not with the screen. The report counts directly on the raw base and is stable; the dashboard diverges in only one week and only in the denominator. This rules out the raw base (both sources read the same one) and points to what is **different between them**: the definition of user. The report counts by `hashed_ip`; the load writes `usuario_id = sha256(hashed_ip | user-agent)`. First question: "how many of the 2,034 new people of 11/20 are IPs that already existed before with another user-agent?"

## 2. Which layer the failure is in, and the evidence

**In the load** (raw base → analytical base), not in the endpoint nor on the screen:

- The screen shows exactly what the endpoint returns (`novos: 2034`, `voltaram_7d: 366` → 18.0%).
- The endpoint calculates correctly on what it receives: the SQL groups by `usuario_id`, and the problem is what `usuario_id` means.
- The load changes the identity of the person when the **user-agent changes**. The numbers show what changed on 11/20: the 862 extra "new" people **almost never come back**. If they were real people who changed browser once, they would keep using the assistant, and "came back" would rise by about 270 (31% of 862). It stayed the same (366 against 368). And the report by `hashed_ip` sees no new IPs (1,172, normal volume). So the extras are identities of **a single conversation**, coming from IPs that already existed: a different user-agent on every conversation from the same IP. The cause may be a bot, a proxy or a change in the client itself, which started to vary the header.
- The raw base is correct: the report, which reads from it by `hashed_ip`, is stable.
- **In our own data, the same mechanism appears on a smaller scale:** with the IP + user-agent key, the 2,266 people become 2,747 (+21%) from the same IPs ([`analise/02-definicoes.md`](analise/02-definicoes.md)).

**Confirmation query** (on the raw base; the same rule as the endpoint, changing only the key):

```sql
WITH conv AS (
    SELECT hashed_ip, header ->> 'user-agent' AS ua, "timestamp" AS ts
    FROM bruto.wildchat
    WHERE country = 'Brazil'
),
primeira_ip   AS (SELECT hashed_ip,     min(ts) AS p FROM conv GROUP BY 1),
primeira_ipua AS (SELECT hashed_ip, ua, min(ts) AS p FROM conv GROUP BY 1, 2),
par AS (                -- cada par (IP, user-agent) novo: o IP já existia? o par voltou em 7 dias?
    SELECT date_trunc('week', u.p)::date        AS semana,
           i.p < date_trunc('week', u.p)        AS ip_ja_existia,
           EXISTS (SELECT 1 FROM conv c
                   WHERE c.hashed_ip = u.hashed_ip AND c.ua = u.ua
                     AND c.ts >  u.p + interval '1 hour'
                     AND c.ts <= u.p + interval '7 days') AS voltou
    FROM primeira_ipua u
    JOIN primeira_ip i USING (hashed_ip)
),
so_ip AS (SELECT date_trunc('week', p)::date AS semana, count(*) AS novos_so_ip FROM primeira_ip GROUP BY 1)
SELECT semana,
       count(*)                                                        AS novos_ip_mais_ua,
       s.novos_so_ip,
       count(*) FILTER (WHERE ip_ja_existia)                           AS ip_ja_existia_antes,
       round(100.0 * avg(voltou::int) FILTER (WHERE ip_ja_existia), 1) AS retorno_desses_pares_pct
FROM par
JOIN so_ip s USING (semana)
WHERE semana BETWEEN '2023-11-06' AND '2023-11-20'
GROUP BY semana, s.novos_so_ip
ORDER BY semana;

-- de onde vêm os pares novos: poucos IPs (robô ou proxy) ou muitos (mudança no cliente)?
SELECT date_trunc('week', p)::date AS semana, hashed_ip, count(*) AS user_agents_novos
FROM (SELECT hashed_ip, ua, min(ts) AS p FROM conv GROUP BY 1, 2) x
WHERE p >= '2023-11-13' AND p < '2023-11-27'
GROUP BY 1, 2
ORDER BY 3 DESC
LIMIT 20;
```

The hypothesis is confirmed if, on 11/20, `novos_ip_mais_ua` ≈ 2,034, `novos_so_ip` ≈ 1,172, `ip_ja_existia_antes` ≈ 860 and the return of these pairs is close to zero. To find the origin, compare how many new user-agents each IP generated on 11/13 and on 11/20. If the change is concentrated in few IPs, it is a bot or a proxy; if it is spread out, it is a change in the client.

## 3. The code that causes the problem, and the fix

**Main cause:** the user key includes the user-agent.

```python
chave = f"{c['hashed_ip']}|{c['header']['user-agent']}"
```

**Secondary causes in the same code** (they do not explain the jump on 11/20, but they distort the number):

| Code | Problem |
|---|---|
| `ON CONFLICT (conversa_id) DO NOTHING` | The daily load receives again a conversation that continued on another day; `DO NOTHING` discards the new `ultimo_turno`. Returns inside old conversations disappear. And fixing the key **does not repair the rows already written**. |
| `min(ultimo_turno) AS primeira_vez` | Uses the **last** turn as the "first time": it shifts the cohort and can turn the 1st conversation itself into a return. |
| `date_trunc('week', ...)` with no time zone | The week is cut in the time zone of the database session (UTC), not in the business one. |
| `EXISTS (SELECT 1 FROM analytics.conversas c WHERE c.usuario_id = ...)` without `pais` | The country filter is only in the `primeira` CTE: a conversation of the same person in another country counts as a return in the Brazil dashboard. |

**Fix of the load:**

```python
SAL = os.environ["SAL_USUARIO"]  # sal fixo: o usuario_id não é reversível para o IP

def carregar_conversas(conversas: list[dict]) -> None:
    """Grava uma linha por conversa. Idempotente: reprocessar o mesmo dia dá o mesmo resultado."""
    for c in conversas:
        db.execute(
            """
            INSERT INTO analytics.conversas
                (conversa_id, usuario_id, primeiro_turno, ultimo_turno, modelo, turnos, pais)
            VALUES
                (%(conversa_id)s, %(usuario_id)s, %(primeiro_turno)s, %(ultimo_turno)s,
                 %(modelo)s, %(turnos)s, %(pais)s)
            ON CONFLICT (conversa_id) DO UPDATE SET
                usuario_id   = EXCLUDED.usuario_id,
                ultimo_turno = EXCLUDED.ultimo_turno,
                turnos       = EXCLUDED.turnos,
                modelo       = EXCLUDED.modelo
            """,
            {
                "conversa_id": c["conversation"][0]["turn_identifier"],
                # mesma chave do relatório e do BDR-001: só o IP (o user-agent muda com o navegador e pode variar a cada conversa)
                "usuario_id": sha256((SAL + c["hashed_ip"]).encode()).hexdigest(),
                "primeiro_turno": c["conversation"][1]["timestamp"],  # 1ª resposta: o usuário não tem horário
                "ultimo_turno": c["timestamp"],
                "modelo": c["model"],
                "turnos": c["turn"],
                "pais": c["country"],
            },
        )
```

**Fix of the endpoint:** `min(primeiro_turno)` instead of `min(ultimo_turno)`, the week in the business time zone and the country also in the return:

```sql
WITH primeira AS (
    SELECT usuario_id, min(primeiro_turno) AS primeira_vez
    FROM analytics.conversas
    WHERE pais = $3
    GROUP BY usuario_id
)
SELECT date_trunc('week', p.primeira_vez AT TIME ZONE 'America/Sao_Paulo')::date AS semana,
       count(*) AS novos,
       count(*) FILTER (WHERE EXISTS (
           SELECT 1 FROM analytics.conversas c
           WHERE c.usuario_id = p.usuario_id
             AND c.pais = $3
             AND c.primeiro_turno > p.primeira_vez + interval '1 hour'
             AND c.primeiro_turno <= p.primeira_vez + interval '7 days'
       )) AS voltaram_7d
FROM primeira p
WHERE p.primeira_vez >= $1 AND p.primeira_vez < $2
GROUP BY 1
ORDER BY 1
```

## 4. What else needs to be done and how to prevent it from coming back

**Beyond the code:**
1. **Reprocess the whole history** (every row has the wrong `usuario_id`, and `DO NOTHING` would block the fix): full load into a new table and an atomic swap (`ALTER TABLE ... RENAME` in the same transaction), without the screen seeing half-done data.
2. **Measure the damage:** which weeks and screens changed after the reprocessing, and by how much.
3. **Warn whoever used the number** (see item 5) and record the incident.

**So that it does not come back:**
- **Automatic reconciliation test** after each load: new people per week in the analytical base × direct count on the raw base by `hashed_ip`; a difference above 2% blocks the publication and alerts the team **before** the client.
- **Contract test of the user definition:** two conversations with the same IP and different user-agents must produce the same `usuario_id` (in our project: `tests/test_definicoes.py::test_mesmo_ip_com_navegadores_diferentes_e_a_mesma_pessoa`).
- **Anomaly monitor:** ratio `distinct usuario_id / distinct hashed_ip` per week; a jump above its history fires an alert.
- **Idempotent load** (delete the window and reload in the same transaction), not `DO NOTHING`.
- **Every change of definition goes through a BDR** and changes a test: the key with the user-agent would not have passed the review.

## 5. What to tell the product manager

**During:**
> "We have identified that the number for 11/20 is wrong, not the behavior of the users: the report that counts directly on the base is still stable at 30%. The dashboard started counting as a new person every different browser that appears at the same address. That week, this almost doubled the 'new' people without anyone new having arrived. Please do not use the return of 11/20 for decisions until we fix it. Next update today at [time]."

**After:**
> "Cause: the rule that identifies the person included the browser. On 11/20, addresses that already used the assistant started to appear with a different browser on every conversation, and about 860 conversations became 'new people' who, by definition, never came back. We fixed the rule and recalculated every week: 11/20 is at ~30%, as in the report, and the other weeks changed by at most [x] pp. Now, on every load, the dashboard is automatically checked against the raw base and is not published if they diverge."

## Note

The volumes in the brief (~1,150 new people per week in Brazil) come from a reference implementation: in the real WildChat-1M data, Brazil has ~45 new users per week (2,266 eligible in 53 weeks). The answers above treat the case as described in the brief.
