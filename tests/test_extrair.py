"""Extração da camada bruta: só as conversas do país pedido saem do arquivo de origem."""

from pathlib import Path

import duckdb

from etl.extrair import filtrar_arquivo


def _parquet_sintetico(caminho: Path) -> None:
    duckdb.sql(
        """
        COPY (
            SELECT * FROM (VALUES
                ('a', 'Brazil',  [{'content': 'oi'}]),
                ('b', 'Brazil',  [{'content': 'olá'}]),
                ('c', 'Portugal', [{'content': 'olá'}]),
                ('d', NULL,      [{'content': 'hi'}])
            ) t(conversation_hash, country, conversation)
        ) TO '"""
        + str(caminho)
        + "' (FORMAT parquet)"
    )


def test_filtra_so_o_pais_e_conta_origem_e_destino(tmp_path: Path) -> None:
    origem, destino = tmp_path / "origem.parquet", tmp_path / "brasil.parquet"
    _parquet_sintetico(origem)

    total, filtradas = filtrar_arquivo(origem, destino, pais="Brazil")

    assert (total, filtradas) == (4, 2)
    linhas = duckdb.sql(
        f"SELECT conversation_hash, country FROM '{destino}' ORDER BY 1"
    ).fetchall()
    assert linhas == [("a", "Brazil"), ("b", "Brazil")]


def test_preserva_colunas_aninhadas(tmp_path: Path) -> None:
    origem, destino = tmp_path / "origem.parquet", tmp_path / "brasil.parquet"
    _parquet_sintetico(origem)

    filtrar_arquivo(origem, destino, pais="Brazil")

    conteudo = duckdb.sql(
        f"SELECT conversation[1].content FROM '{destino}' ORDER BY 1"
    ).fetchall()
    assert conteudo == [("oi",), ("olá",)]
