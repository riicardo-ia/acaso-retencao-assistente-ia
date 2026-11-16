"""Passo 1: checagens de qualidade da camada bruta (Brasil).

Cada checagem é uma consulta nomeada; o resultado sustenta a tabela de
docs/analise/01-qualidade.md. Rodar: python -m analise.qualidade
"""

import sys

import duckdb

BRUTO = "data/raw/wildchat_brazil.parquet"

CONVERSAS = f"""
SELECT b.conversation[1].turn_identifier AS conv_id,
       b.hashed_ip, b.conversation_hash, b.model, b.turn, b.language, b.state,
       b.header."user-agent" AS ua, b.redacted, b.toxic,
       b.timestamp AS ts_ultimo,
       b.conversation[2].timestamp AS ts_inicio,       -- 1ª resposta: só o assistente tem horário
       b.conversation[1].content AS primeira_msg,
       len(b.conversation) AS n_msgs,
       len(list_distinct([x.hashed_ip FOR x IN b.conversation IF x.role = 'user'])) AS n_ips,
       len([x FOR x IN b.conversation IF x.role = 'user' AND coalesce(trim(x.content), '') = '']) AS user_vazias
FROM '{BRUTO}' b
"""

MENSAGENS = f"""
SELECT b.conversation[1].turn_identifier AS conv_id, u.t.role, u.t.timestamp AS ts, u.t.turn_identifier AS tid
FROM '{BRUTO}' b, unnest(b.conversation) u(t)
"""

CHECAGENS: list[tuple[str, str]] = [
    ("conversas", "SELECT count(*) FROM c"),
    ("ips distintos", "SELECT count(DISTINCT hashed_ip) FROM c"),
    ("conv_id (1º turn_identifier) distintos", "SELECT count(DISTINCT conv_id) FROM c"),
    ("conversation_hash distintos", "SELECT count(DISTINCT conversation_hash) FROM c"),
    (
        "hash repetido: grupos / linhas / mesmo IP",
        "SELECT count(*), sum(n), sum((ips = 1)::int) FROM (SELECT conversation_hash, count(*) n, "
        "count(DISTINCT hashed_ip) ips FROM c GROUP BY 1 HAVING count(*) > 1)",
    ),
    (
        "mensagens do usuário sem horário / total",
        "SELECT count(*) FILTER (WHERE ts IS NULL), count(*) FROM msg WHERE role = 'user'",
    ),
    (
        "mensagens do assistente sem horário / total",
        "SELECT count(*) FILTER (WHERE ts IS NULL), count(*) FROM msg WHERE role = 'assistant'",
    ),
    (
        "turn_identifier repetido entre linhas",
        "SELECT count(*) - count(DISTINCT (tid, role)) FROM msg",
    ),
    ("n_msgs <> 2 * turn", "SELECT count(*) FILTER (WHERE n_msgs <> 2 * turn) FROM c"),
    (
        "início depois do último turno",
        "SELECT count(*) FILTER (WHERE ts_inicio > ts_ultimo) FROM c",
    ),
    (
        "duração em minutos: p50 / p90 / p99",
        "SELECT quantile_cont(epoch(ts_ultimo - ts_inicio) / 60, [0.5, 0.9, 0.99]) FROM c",
    ),
    (
        "conversas reabertas (pausa > 30 min entre respostas)",
        "SELECT count(DISTINCT conv_id) FROM (SELECT conv_id, ts - lag(ts) OVER (PARTITION BY conv_id "
        "ORDER BY ts) gap FROM msg WHERE role = 'assistant') WHERE gap > INTERVAL 30 MINUTE",
    ),
    (
        "IP do usuário muda dentro da conversa",
        "SELECT count(*) FILTER (WHERE n_ips > 1) FROM c",
    ),
    (
        "mesma 1ª mensagem, mesmo IP, < 10 min (reenvio)",
        "SELECT count(*) FROM (SELECT ts_inicio - lag(ts_inicio) OVER (PARTITION BY hashed_ip, primeira_msg "
        "ORDER BY ts_inicio) gap FROM c) WHERE gap < INTERVAL 10 MINUTE",
    ),
    (
        "conversas com mensagem do usuário vazia",
        "SELECT count(*) FILTER (WHERE user_vazias > 0) FROM c",
    ),
    (
        "1ª mensagem com < 10 caracteres",
        "SELECT count(*) FILTER (WHERE length(trim(primeira_msg)) < 10) FROM c",
    ),
    ("toxic = true", "SELECT count(*) FILTER (WHERE toxic) FROM c"),
    ("redacted = true", "SELECT count(*) FILTER (WHERE redacted) FROM c"),
    ("state nulo", "SELECT count(*) FILTER (WHERE state IS NULL) FROM c"),
    (
        "maior IP: conversas / % do total / user-agents / idiomas / dias ativos",
        "SELECT n, round(100.0 * n / (SELECT count(*) FROM c), 1), uas, idiomas, dias FROM ("
        "SELECT hashed_ip, count(*) n, count(DISTINCT ua) uas, count(DISTINCT language) idiomas, "
        "count(DISTINCT ts_inicio::date) dias FROM c GROUP BY 1 ORDER BY n DESC LIMIT 1)",
    ),
    (
        "IPs com 1 só conversa / total de IPs",
        "SELECT count(*) FILTER (WHERE n = 1), count(*) FROM (SELECT hashed_ip, count(*) n FROM c GROUP BY 1)",
    ),
    (
        "idioma raro com 1ª mensagem mediana < 10 caracteres (detecção não confiável)",
        "SELECT string_agg(language || ':' || n, ' ') FROM (SELECT language, count(*) n FROM c "
        "WHERE language NOT IN ('Portuguese', 'English', 'Spanish') GROUP BY 1 "
        "HAVING median(length(primeira_msg)) < 10 ORDER BY 2 DESC)",
    ),
    (
        "% GPT-4 por mês",
        "SELECT string_agg(mes || ':' || pct, ' ' ORDER BY mes) FROM (SELECT strftime(ts_inicio, '%Y-%m') mes, "
        "round(100 * avg((model LIKE 'gpt-4%')::int))::int pct FROM c GROUP BY 1)",
    ),
]


def rodar(bruto: str = BRUTO) -> list[tuple[str, object]]:
    con = duckdb.connect()
    con.execute("SET TimeZone = 'UTC'")
    con.execute(f"CREATE TEMP TABLE c AS {CONVERSAS.replace(BRUTO, bruto)}")
    con.execute(f"CREATE TEMP TABLE msg AS {MENSAGENS.replace(BRUTO, bruto)}")
    resultados = []
    for nome, consulta in CHECAGENS:
        linha = con.execute(consulta).fetchone()
        resultados.append(
            (nome, linha if linha is None or len(linha) > 1 else linha[0])
        )
    return resultados


if __name__ == "__main__":
    for nome, valor in rodar(sys.argv[1] if len(sys.argv) > 1 else BRUTO):
        print(f"{nome}: {valor}")
