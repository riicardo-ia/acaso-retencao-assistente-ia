-- 001: base analítica do retorno em 7 dias.
-- Decisões: BDR-001 rev. 1 (usuário = hash do IP; uso = cada resposta do assistente;
-- 1ª experiência = 1º dia local; retorno = uso em outro dia local, D+1 a D+7).
-- Nenhuma tabela guarda texto de conversa, IP ou user-agent.

-- Fatos ---------------------------------------------------------------------

CREATE TABLE mart.conversas (
    conv_id            bigint PRIMARY KEY,        -- 1º turn_identifier (conversation_hash não é chave, Q4)
    usuario_id         text        NOT NULL,      -- sha256(sal + hashed_ip): não reversível
    inicio             timestamptz NOT NULL,      -- 1ª resposta do assistente (Q1)
    fim                timestamptz NOT NULL,      -- último turno
    modelo             text        NOT NULL,
    gpt4               boolean     NOT NULL,
    turnos             integer     NOT NULL,
    idioma             text        NOT NULL,      -- português | inglês | outro (Q8)
    dispositivo        text        NOT NULL,      -- computador | celular
    tema               text        NOT NULL,      -- classificação fechada (Passo 5)
    recusa_1a_resposta boolean     NOT NULL,
    tam_msg1           integer     NOT NULL,
    ip_anomalo         boolean     NOT NULL       -- >= 10 user-agents no mesmo IP (Q7)
);
CREATE INDEX ON mart.conversas (usuario_id, inicio);

CREATE TABLE mart.eventos (                       -- um evento por resposta do assistente
    usuario_id text        NOT NULL,
    ts         timestamptz NOT NULL
);
CREATE INDEX ON mart.eventos (usuario_id, ts);

-- Definição do retorno, em SQL (a mesma regra de analise/definicoes.py; a carga
-- confere as duas e não publica se divergirem) -------------------------------

CREATE VIEW mart.vw_usuarios AS
WITH ev AS (
    SELECT usuario_id, ts, (ts AT TIME ZONE 'America/Sao_Paulo')::date AS dia
    FROM mart.eventos
),
primeiro AS (
    SELECT usuario_id, min(dia) AS dia1 FROM ev GROUP BY 1
),
limites AS (                                      -- cortes de censura (BDR-001)
    SELECT min(ts) + interval '14 days' AS inicio_minimo,
           max(ts) - interval '8 days'  AS inicio_maximo
    FROM mart.eventos
)
SELECT p.usuario_id,
       p.dia1,
       date_trunc('week', p.dia1)::date                                      AS semana,
       min(e.ts) FILTER (WHERE e.dia = p.dia1)                               AS inicio,
       bool_or(e.dia BETWEEN p.dia1 + 1 AND p.dia1 + 7)                       AS retornou,
       count(DISTINCT e.dia)                                                 AS dias_ativos
FROM primeiro p
JOIN ev e USING (usuario_id)
CROSS JOIN limites l
GROUP BY p.usuario_id, p.dia1, l.inicio_minimo, l.inicio_maximo
HAVING min(e.ts) FILTER (WHERE e.dia = p.dia1) BETWEEN l.inicio_minimo AND l.inicio_maximo;

-- Indicador principal, pré-calculado (a tela lê daqui) ----------------------

-- IC 95% de Wilson de uma proporção k/n (z = 1,96), em pontos percentuais
CREATE FUNCTION mart.wilson(k bigint, n bigint, lado int) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
    SELECT round((100 * (
        (k::numeric / n + 1.9208 / n) / (1 + 3.8416 / n)
        + lado * 1.96 * sqrt(k::numeric / n * (1 - k::numeric / n) / n + 0.9604 / n ^ 2) / (1 + 3.8416 / n)
    ))::numeric, 1)
$$;

CREATE MATERIALIZED VIEW mart.mv_coortes_semanais AS
SELECT semana,
       count(*)                                   AS novos,
       count(*) FILTER (WHERE retornou)           AS voltaram,
       round(100.0 * count(*) FILTER (WHERE retornou) / count(*), 1) AS retorno_pct,
       mart.wilson(count(*) FILTER (WHERE retornou), count(*), -1)    AS ic_lo,
       mart.wilson(count(*) FILTER (WHERE retornou), count(*), 1)     AS ic_hi
FROM mart.vw_usuarios
GROUP BY semana;
CREATE UNIQUE INDEX ON mart.mv_coortes_semanais (semana);

CREATE VIEW mart.vw_retorno_geral AS
SELECT count(*)                                AS usuarios,
       count(*) FILTER (WHERE retornou)        AS voltaram,
       round(100.0 * count(*) FILTER (WHERE retornou) / count(*), 1) AS retorno_pct,
       mart.wilson(count(*) FILTER (WHERE retornou), count(*), -1)    AS ic_lo,
       mart.wilson(count(*) FILTER (WHERE retornou), count(*), 1)     AS ic_hi
FROM mart.vw_usuarios;

-- Resultados da análise estatística (gravados pela carga, a partir de analise/) --

CREATE TABLE mart.efeitos (
    fator text, rotulo text, nivel text, referencia text, natureza text,
    n integer, retorno_pct numeric, retorno_ref_pct numeric,
    bruto_pp numeric, bruto_lo numeric, bruto_hi numeric,
    ajustado_pp numeric, ajustado_lo numeric, ajustado_hi numeric, p numeric
);
CREATE TABLE mart.sensibilidade (
    cenario text, usuarios integer, voltaram integer, retorno_pct numeric, ic95 text,
    semanas integer, semanas_n_menor_30 integer, dp_semanal_pp numeric
);
CREATE TABLE mart.gpt4_selecao (metodo text, detalhe text, dif_pp numeric, lo numeric, hi numeric, n integer);
CREATE TABLE mart.semana_decomposicao (
    semana date, segmento text, grupo text,
    n_antes integer, peso_antes numeric, retorno_antes numeric,
    n_semana integer, peso_semana numeric, retorno_semana numeric,
    mix_pp numeric, taxa_pp numeric
);
CREATE TABLE mart.testes (              -- testes estatísticos citados nas telas
    nome text PRIMARY KEY, descricao text, valor numeric, lo numeric, hi numeric, p numeric, n integer
);
CREATE TABLE mart.uso_por_categoria (
    dimensao text, categoria text, pct_conversas numeric, pct_usuarios numeric
);

-- Controle de carga: procedência de cada número ------------------------------

CREATE TABLE mart.cargas (
    id                 serial PRIMARY KEY,
    executada_em       timestamptz NOT NULL DEFAULT now(),
    versao_codigo      text,
    linhas_fonte       integer,     -- conversas na base bruta (todos os países)
    linhas_brasil      integer,     -- depois do filtro country = 'Brazil'
    conversas          integer,     -- carregadas em mart.conversas
    eventos            integer,
    usuarios_elegiveis integer,
    retorno_pct        numeric,
    reconciliacao_ok   boolean,     -- SQL do mart = Python da análise
    duracao_s          numeric
);
