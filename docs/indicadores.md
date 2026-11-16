# Indicadores: definição, fórmula, denominador, período e SQL

Todos são calculados no banco (schema `mart`); a tela só exibe. O mesmo SQL aparece em cada gráfico em "Como calculamos? → Ver a consulta SQL". As definições vêm do [BDR-001](bdr/BDR-001-definicoes-de-uso-e-retorno.md).

## Base de todos: quem é elegível e se voltou (`mart.vw_usuarios`)

**Definição:** uma linha por pessoa (IP pseudonimizado). 1º dia = 1º dia de uso no horário de São Paulo. Voltou = algum uso (resposta do assistente) em outro dia, de D+1 a D+7. Elegível = 1º uso a partir de 14 dias depois do começo da base e até 8 dias antes do fim (janela de 7 dias completa).

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

A margem de erro (IC 95% de Wilson) é a função `mart.wilson(voltaram, pessoas, ±1)`.

## 1. Retorno em 7 dias

| | |
|---|---|
| Definição | % das pessoas novas que usaram o assistente de novo em outro dia, em até 7 dias |
| Fórmula | voltaram ÷ pessoas novas elegíveis |
| Denominador | pessoas novas elegíveis (2.266 na base inteira) |
| Período | 1º uso entre 22/04/2023 e 21/04/2024 (ou o período do filtro) |
| Amostra pequena | com menos de 30 pessoas, a API não devolve nenhum número (nem a contagem); a tela mostra "menos de 30" e "amplie o recorte" |

```sql
SELECT usuarios, voltaram, retorno_pct, ic_lo, ic_hi FROM mart.vw_retorno_geral;   -- Análise completa

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

## 2. Retorno mês a mês e por semana

| | |
|---|---|
| Definição | o mesmo retorno, para quem começou em cada mês (Explorar) ou semana (Análise) |
| Denominador | pessoas novas do mês/semana |
| Período | mês/semana do 1º uso (semana de segunda a domingo, horário de São Paulo) |
| Amostra pequena | mês ou semana com menos de 30 pessoas sai sem números da API e fica sem ponto na tela |

```sql
-- Explorar: o mesmo "recorte" acima, agrupado por mês
SELECT mes, count(*) AS n, count(*) FILTER (WHERE retornou) AS voltaram,
       round(100.0 * count(*) FILTER (WHERE retornou) / count(*), 1) AS retorno_pct,
       mart.wilson(count(*) FILTER (WHERE retornou), count(*), -1) AS ic_lo,
       mart.wilson(count(*) FILTER (WHERE retornou), count(*), 1)  AS ic_hi
FROM recorte GROUP BY mes ORDER BY mes;

-- Análise completa: pré-calculado por semana
SELECT semana, novos, voltaram, retorno_pct, ic_lo, ic_hi FROM mart.mv_coortes_semanais ORDER BY semana;
```

## 3. Quem volta mais, por grupo (Explorar)

| | |
|---|---|
| Definição | retorno de cada grupo de idioma, dispositivo, tema da 1ª conversa ou modelo |
| Denominador | pessoas do grupo, dentro do recorte |
| Amostra pequena | grupo com menos de 30 pessoas sai sem números da API; a tela escreve "poucas pessoas" no lugar da barra |
| Leitura | comparação simples; a frase só chama de "confirmada" uma diferença que passa no teste de duas proporções a 99% |

```sql
SELECT tema AS categoria, count(*) AS n, count(*) FILTER (WHERE retornou) AS voltaram,
       round(100.0 * count(*) FILTER (WHERE retornou) / count(*), 1) AS retorno_pct,
       mart.wilson(count(*) FILTER (WHERE retornou), count(*), -1) AS ic_lo,
       mart.wilson(count(*) FILTER (WHERE retornou), count(*), 1)  AS ic_hi
FROM recorte GROUP BY tema ORDER BY retorno_pct DESC;   -- idem para idioma, dispositivo, modelo
```

## 4. Com que tema as pessoas chegam (Explorar)

| | |
|---|---|
| Definição | % das pessoas pelo tema da 1ª conversa × % de todas as conversas dessas pessoas |
| Denominador | pessoas do recorte / conversas das pessoas do recorte |
| Período | o do filtro |
| Amostra pequena | tema com menos de 30 pessoas sai sem números da API; a tela escreve "poucas pessoas" |

```sql
SELECT r.tema AS categoria, count(DISTINCT r.usuario_id) AS n,
       round(100.0 * count(DISTINCT r.usuario_id) / sum(count(DISTINCT r.usuario_id)) OVER (), 1) AS pct_pessoas,
       round(100.0 * count(c.conv_id) / sum(count(c.conv_id)) OVER (), 1) AS pct_conversas
FROM recorte r JOIN mart.conversas c ON c.usuario_id = r.usuario_id
GROUP BY r.tema ORDER BY pct_pessoas DESC;
```

## 5. Efeito de cada fator (Análise completa)

| | |
|---|---|
| Definição | quantos pontos percentuais a mais ou a menos voltam com a característica, comparando pessoas parecidas |
| Fórmula | efeito marginal médio de uma regressão logística com todos os fatores e a época; IC 95% pelo método delta |
| Denominador | as 2.266 pessoas elegíveis |
| Período | base inteira (1º uso entre 22/04/2023 e 21/04/2024) |
| Amostra pequena | grupo com menos de 30 pessoas sai sem números da API e não aparece |

Calculado na carga (`analise/efeitos.py`) e gravado em `mart.efeitos`:

```sql
SELECT fator, rotulo, nivel, referencia, n, retorno_pct, retorno_ref_pct,
       bruto_pp, ajustado_pp, ajustado_lo, ajustado_hi, p
FROM mart.efeitos;
```
