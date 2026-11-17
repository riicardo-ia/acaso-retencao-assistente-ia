<!-- traduzido de: 6eded6f04183 -->
# Incidentes · "el retorno de la semana del 20/11/2023 cayó del 31% al 18%"

## El síntoma, en números

| Semana | Dashboard: nuevos | Dashboard: volvieron | Dashboard: retorno | Informe (hashed_ip): nuevos | Informe: volvieron | Informe: retorno |
|---|---:|---:|---:|---:|---:|---:|
| 06/11 | 1.210 | 375 | 31,0% | 1.150 | 345 | 30% |
| 13/11 | 1.188 | 368 | 31,0% | 1.131 | 351 | 31% |
| **20/11** | **2.034** | 366 | **18,0%** | 1.172 | 352 | 30% |

El numerador (volvieron) es prácticamente el mismo en las dos fuentes; lo que casi **se duplica es el denominador**: el dashboard ve **862 "nuevos" de más** en una semana en la que el informe ve un volumen normal. La caída no es de comportamiento: es de **conteo de personas**.

## 1. Por dónde empezaría y por qué

Por la **divergencia entre las dos fuentes**, no por la pantalla. El informe cuenta directo en la base bruta y está estable; el dashboard diverge solo en una semana y solo en el denominador. Eso descarta la base bruta (las dos fuentes leen la misma) y apunta a lo que es **distinto entre ellas**: la definición de usuario. El informe cuenta por `hashed_ip`; la carga guarda `usuario_id = sha256(hashed_ip | user-agent)`. Primera pregunta: "¿cuántos de los 2.034 nuevos del 20/11 son IPs que ya existían antes con otro user-agent?"

## 2. En qué capa está la falla y las evidencias

**En la carga** (base bruta → base analítica), no en el endpoint ni en la pantalla:

- La pantalla muestra exactamente lo que devuelve el endpoint (`novos: 2034`, `voltaram_7d: 366` → 18,0%).
- El endpoint calcula bien sobre lo que recibe: el SQL agrupa por `usuario_id`, y el problema es lo que significa `usuario_id`.
- La carga cambia la identidad de la persona cuando **cambia el user-agent**. Los números muestran lo que cambió el 20/11: los 862 "nuevos" de más **casi no vuelven**. Si fueran personas reales que cambiaron de navegador una vez, seguirían usando el asistente, y "volvieron" subiría unos 270 (31% de 862). Quedó igual (366 frente a 368). Y el informe por `hashed_ip` no ve IPs nuevas (1.172, volumen normal). Por lo tanto, los extras son identidades de **una sola conversación**, que vienen de IPs que ya existían: un user-agent distinto en cada conversación desde la misma IP. La causa puede ser un robot, un proxy o un cambio en el propio cliente, que pasó a variar el encabezado.
- La base bruta está bien: el informe, que lee de ella por `hashed_ip`, es estable.
- **En nuestra base, el mismo mecanismo aparece a menor escala:** con la clave IP + user-agent, las 2.266 personas pasan a ser 2.747 (+21%) a partir de las mismas IPs ([`analise/02-definicoes.md`](analise/02-definicoes.md)).

**Consulta de confirmación** (en la base bruta; la misma regla del endpoint, cambiando solo la clave):

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

La hipótesis se confirma si, el 20/11, `novos_ip_mais_ua` ≈ 2.034, `novos_so_ip` ≈ 1.172, `ip_ja_existia_antes` ≈ 860 y el retorno de esos pares es cercano a cero. Para encontrar el origen, basta comparar cuántos user-agents nuevos generó cada IP el 13/11 y el 20/11. Si el cambio se concentra en pocas IPs, es un robot o un proxy; si se dispersa, es un cambio en el cliente.

## 3. El fragmento que causa el problema y la corrección

**Causa principal:** la clave de usuario incluye el user-agent.

```python
chave = f"{c['hashed_ip']}|{c['header']['user-agent']}"
```

**Causas secundarias en el mismo código** (no explican el salto del 20/11, pero distorsionan el número):

| Fragmento | Problema |
|---|---|
| `ON CONFLICT (conversa_id) DO NOTHING` | La carga diaria recibe de nuevo una conversación que siguió otro día; `DO NOTHING` descarta el nuevo `ultimo_turno`. Los retornos dentro de conversaciones antiguas desaparecen. Y corregir la clave **no arregla las filas ya guardadas**. |
| `min(ultimo_turno) AS primeira_vez` | Usa el **último** turno como "primera vez": desplaza la cohorte y puede convertir la propia 1.ª conversación en retorno. |
| `date_trunc('week', ...)` sin huso | La semana se corta en el huso de la sesión de la base de datos (UTC), no en el del negocio. |
| `EXISTS (SELECT 1 FROM analytics.conversas c WHERE c.usuario_id = ...)` sin `pais` | El filtro de país está solo en la CTE `primeira`: una conversación de la misma persona en otro país cuenta como retorno en el dashboard de Brasil. |

**Corrección de la carga:**

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

**Corrección del endpoint:** `min(primeiro_turno)` en lugar de `min(ultimo_turno)`, la semana en el huso del negocio y el país también en el retorno:

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

## 4. Qué más hay que hacer y cómo evitar que vuelva

**Además del código:**
1. **Reprocesar todo el historial** (todas las filas tienen el `usuario_id` equivocado, y `DO NOTHING` impediría la corrección): carga completa en una tabla nueva y cambio atómico (`ALTER TABLE ... RENAME` en la misma transacción), sin que la pantalla vea datos a medias.
2. **Medir el daño:** qué semanas y pantallas cambiaron después del reprocesamiento, y cuánto.
3. **Avisar a quien usó el número** (ver ítem 5) y registrar el incidente.

**Para que no vuelva:**
- **Prueba de conciliación automática** después de cada carga: nuevos por semana en la base analítica × conteo directo en la base bruta por `hashed_ip`; una diferencia por encima del 2% bloquea la publicación y alerta al equipo **antes** que al cliente.
- **Prueba de contrato de la definición de usuario:** dos conversaciones con la misma IP y user-agents distintos tienen que generar el mismo `usuario_id` (en nuestro proyecto: `tests/test_definicoes.py::test_mesmo_ip_com_navegadores_diferentes_e_a_mesma_pessoa`).
- **Monitor de anomalías:** razón `usuario_id distintos / hashed_ip distintos` por semana; un salto por encima del historial dispara una alerta.
- **Carga idempotente** (borrar la ventana y recargar en la misma transacción), no `DO NOTHING`.
- **Todo cambio de definición pasa por un BDR** y cambia una prueba: la clave con user-agent no habría pasado la revisión.

## 5. Qué decirle a la gerente de producto

**Durante:**
> "Identificamos que el número del 20/11 está equivocado, no el comportamiento de los usuarios: el informe que cuenta directo en la base sigue estable en 30%. El dashboard pasó a contar como persona nueva cada navegador distinto que aparece en la misma dirección. Esa semana, eso casi duplicó los 'nuevos' sin que llegara nadie nuevo. Por favor, no use el retorno del 20/11 para decidir hasta que lo corrijamos. Próxima actualización hoy a las [hora]."

**Después:**
> "Causa: la regla que identifica a la persona incluía el navegador. El 20/11, direcciones que ya usaban el asistente empezaron a aparecer con un navegador distinto en cada conversación, y unas 860 conversaciones pasaron a ser 'personas nuevas' que, por definición, nunca volvían. Corregimos la regla y recalculamos todas las semanas: el 20/11 queda en ~30%, como en el informe, y las demás semanas cambiaron como máximo [x] pp. Ahora, en cada carga, el dashboard se compara automáticamente con la base bruta y no se publica si difieren."

## Observación

Los volúmenes del enunciado (~1.150 nuevos por semana en Brasil) son de una implementación de referencia: en la base real de WildChat-1M, Brasil tiene ~45 usuarios nuevos por semana (2.266 elegibles en 53 semanas). Las respuestas de arriba tratan el caso tal como lo describe el enunciado.
