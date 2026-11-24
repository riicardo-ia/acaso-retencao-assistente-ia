<!-- traduzido de: bb3b58453a1f -->
# Indicadores: definición, fórmula, denominador, período y SQL

Todos se calculan en la base de datos (schema `mart`); la pantalla solo los muestra. El mismo SQL aparece en cada gráfico en "¿Cómo lo calculamos? → Ver la consulta SQL". Las definiciones vienen del [BDR-001](bdr/BDR-001-definicoes-de-uso-e-retorno.md).

## Base de todos: quién es elegible y si volvió (`mart.vw_usuarios`)

**Definición:** una fila por persona (IP seudonimizada). 1.er día = 1.er día de uso en hora de São Paulo. Volvió = algún uso (respuesta del asistente) en otro día, de D+1 a D+7. Elegible = 1.er uso a partir de 14 días después del inicio de la base y hasta 8 días antes del fin (ventana de 7 días completa).

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

El margen de error (IC 95% de Wilson) es la función `mart.wilson(volvieron, personas, ±1)`.

## 1. Retorno en 7 días

| | |
|---|---|
| Definición | % de las personas nuevas que usaron el asistente de nuevo otro día, en 7 días o menos |
| Fórmula | volvieron ÷ personas nuevas elegibles |
| Denominador | personas nuevas elegibles (2.266 en toda la base) |
| Período | 1.er uso entre el 22/04/2023 y el 21/04/2024 (o el período del filtro) |
| Muestra pequeña | con menos de 30 personas, la API no devuelve ningún número (ni el conteo); la pantalla muestra "menos de 30" y "amplía el recorte" |

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

## 2. Retorno mes a mes y por semana

| | |
|---|---|
| Definición | el mismo retorno, para quien empezó en cada mes (Explorar) o semana (La respuesta). En la semana, la **franja del azar** es donde caería el número solo por suerte si el retorno fuera el de toda la base: p ± 1,96 × √(p(1−p)/n) |
| Denominador | personas nuevas del mes/semana |
| Período | mes/semana del 1.er uso (semana de lunes a domingo, hora de São Paulo) |
| Muestra pequeña | el mes o la semana con menos de 30 personas sale de la API sin números y queda sin punto en la pantalla |

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

## 3. Quién vuelve más, por grupo (Explorar)

| | |
|---|---|
| Definición | retorno de cada grupo de idioma, dispositivo, tema de la 1.ª conversación o modelo |
| Denominador | personas del grupo, dentro del recorte |
| Muestra pequeña | el grupo con menos de 30 personas sale de la API sin números; la pantalla escribe "pocas personas" en lugar de la barra |
| Lectura | comparación simple; la frase solo llama "confirmada" a una diferencia que pasa la prueba de dos proporciones al 99% |

```sql
SELECT tema AS categoria, count(*) AS n, count(*) FILTER (WHERE retornou) AS voltaram,
       round(100.0 * count(*) FILTER (WHERE retornou) / count(*), 1) AS retorno_pct,
       mart.wilson(count(*) FILTER (WHERE retornou), count(*), -1) AS ic_lo,
       mart.wilson(count(*) FILTER (WHERE retornou), count(*), 1)  AS ic_hi
FROM recorte GROUP BY tema ORDER BY retorno_pct DESC;   -- idem para idioma, dispositivo, modelo
```

## 4. Con qué tema llegan las personas (Explorar)

| | |
|---|---|
| Definición | % de las personas por el tema de la 1.ª conversación × % de todas las conversaciones de esas personas |
| Denominador | personas del recorte / conversaciones de las personas del recorte |
| Período | el del filtro |
| Muestra pequeña | el tema con menos de 30 personas sale de la API sin números; la pantalla escribe "pocas personas" |

```sql
SELECT r.tema AS categoria, count(DISTINCT r.usuario_id) AS n,
       round(100.0 * count(DISTINCT r.usuario_id) / sum(count(DISTINCT r.usuario_id)) OVER (), 1) AS pct_pessoas,
       round(100.0 * count(c.conv_id) / sum(count(c.conv_id)) OVER (), 1) AS pct_conversas
FROM recorte r JOIN mart.conversas c ON c.usuario_id = r.usuario_id
GROUP BY r.tema ORDER BY pct_pessoas DESC;
```

## 5. Efecto de cada factor (La respuesta)

| | |
|---|---|
| Definición | cuánto más o menos vuelven las personas con la característica, comparando personas parecidas. En la pantalla, en % del retorno del grupo de comparación ("vuelve 74% menos") |
| Fórmula | efecto marginal medio de una regresión logística con todos los factores y la época, dividido por el retorno del grupo de comparación; IC 95% por el método delta |
| Denominador | las 2.266 personas elegibles |
| Período | toda la base (1.er uso entre el 22/04/2023 y el 21/04/2024) |
| Muestra pequeña | el grupo con menos de 30 personas sale de la API sin números y no aparece |

Calculado en la carga (`analise/efeitos.py`) y guardado en `mart.efeitos`:

```sql
SELECT fator, rotulo, nivel, referencia, n, retorno_pct, retorno_ref_pct,
       bruto_pp, ajustado_pp, ajustado_lo, ajustado_hi, p
FROM mart.efeitos;
```

## 6. ¿GPT-4 hace diferencia? (calculado en la carga)

| | |
|---|---|
| Definición | diferencia en el retorno entre quien tuvo la 1.ª conversación con GPT-4 y con GPT-3.5 |
| Fórmula | diferencia de proporciones en cada régimen de oferta (IC de Newcombe) y diferencia ponderada por el inverso del puntaje de propensión (IPW, IC por bootstrap) |
| Denominador | personas de cada régimen; en el IPW, las del período en que GPT-4 existía |
| Período | GPT-4 opcional: abr–jun/23 y nov/23; GPT-4 predeterminado: dic/23–abr/24 |
| Muestra pequeña | todos los grupos tienen más de 30 personas; un grupo menor no aparecería |

Calculado en la carga (`analise/efeitos.py`) y guardado en `mart.gpt4_selecao`:

```sql
SELECT metodo, detalhe, dif_pp, lo, hi, n FROM mart.gpt4_selecao;
```

## 7. ¿La semana cambió por perfil o por tasa? (calculado en la carga)

| | |
|---|---|
| Definición | cuánto del cambio en el retorno de una semana, frente a las 4 anteriores, viene del perfil de quien llegó y cuánto del retorno dentro de cada perfil |
| Fórmula | descomposición de Kitagawa: perfil = Σ (peso en la semana − peso antes) × retorno medio; tasa = Σ (retorno en la semana − retorno antes) × peso medio |
| Denominador | personas nuevas de la semana y de las 4 semanas anteriores |
| Período | semana del 20/11/2023 frente al 23/10 a 19/11/2023 |
| Muestra pequeña | el grupo con menos de 30 personas antes o en la semana sale de la API sin números; la pantalla avisa que, con ~45 personas por semana, la variación puede ser azar (prueba de homogeneidad entre las semanas, p = 0,21) |

Calculado en la carga (`analise/semana.py`) y guardado en `mart.semana_decomposicao`:

```sql
SELECT segmento, round(sum(mix_pp), 1) AS mix_pp, round(sum(taxa_pp), 1) AS taxa_pp
FROM mart.semana_decomposicao GROUP BY segmento ORDER BY segmento;
```

## 8. Sensibilidad a las reglas de conteo (La respuesta)

| | |
|---|---|
| Definición | el retorno en 7 días recalculado cambiando una regla de conteo por vez (qué es volver, quién es la persona, ventana, huso, cortes) |
| Fórmula | la del indicador 1, con la regla cambiada |
| Denominador | personas elegibles bajo cada regla |
| Período | toda la base |
| Muestra pequeña | no se aplica (todas las reglas tienen más de 2.000 personas) |

Calculado en la carga (`analise/sensibilidade.py`) y guardado en `mart.sensibilidade`:

```sql
SELECT cenario, usuarios, voltaram, retorno_pct, ic95 FROM mart.sensibilidade;
```
