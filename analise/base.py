"""Leitura da camada bruta para a análise: conversas e eventos de uso."""

import duckdb
import pandas as pd

BRUTO = "data/raw/wildchat_brazil.parquet"


def conversas(bruto: str = BRUTO) -> pd.DataFrame:
    """Uma linha por conversa. Chave: 1º turn_identifier (Q4)."""
    con = duckdb.connect()
    con.execute("SET TimeZone = 'UTC'")
    return con.execute(
        f"""
        SELECT b.conversation[1].turn_identifier AS conv_id,
               b.hashed_ip AS ip,
               b.header."user-agent" AS ua,
               b.conversation[2].timestamp AS ts_inicio,
               b.timestamp AS ts_fim,
               list_distinct([x.hashed_ip FOR x IN b.conversation IF x.role = 'user'] || [b.hashed_ip]) AS ips
        FROM '{bruto}' b
        """
    ).df()


def eventos(bruto: str = BRUTO) -> pd.DataFrame:
    """Um evento por resposta do assistente (Q1, Q3)."""
    con = duckdb.connect()
    con.execute("SET TimeZone = 'UTC'")
    return con.execute(
        f"""
        SELECT b.conversation[1].turn_identifier AS conv_id, u.t.timestamp AS ts
        FROM '{bruto}' b, unnest(b.conversation) u(t)
        WHERE u.t.role = 'assistant'
        """
    ).df()
