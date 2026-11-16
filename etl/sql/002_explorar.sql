-- 002: base da tela Explorar (self-host BI), com os 5 filtros principais.
-- Decisão de negócio (BDR-003): filtros só por período do 1º uso, idioma,
-- dispositivo, tema da 1ª conversa e modelo; nenhum filtro por engajamento.

CREATE TABLE mart.perfil_usuario (            -- atributos da 1ª experiência (gravados pela carga)
    usuario_id  text PRIMARY KEY,
    idioma      text NOT NULL,                -- português | inglês | outro
    dispositivo text NOT NULL,                -- computador | celular
    tema        text NOT NULL,                -- tema da 1ª conversa (Passo 5)
    modelo      text NOT NULL                 -- GPT-4 | GPT-3.5 (modelo da 1ª conversa)
);

-- quem é elegível e se voltou: a mesma regra de mart.vw_usuarios, materializada
CREATE MATERIALIZED VIEW mart.mv_usuarios AS SELECT * FROM mart.vw_usuarios;
CREATE UNIQUE INDEX ON mart.mv_usuarios (usuario_id);

CREATE VIEW mart.vw_explorar AS
SELECT u.usuario_id, u.dia1, u.semana, date_trunc('month', u.dia1)::date AS mes, u.retornou,
       p.idioma, p.dispositivo, p.tema, p.modelo
FROM mart.mv_usuarios u
JOIN mart.perfil_usuario p USING (usuario_id);
