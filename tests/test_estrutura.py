"""Testes estruturais: propriedades do desenho que não podem mudar sem ninguém perceber.

1. A definição do retorno (a view e a margem de erro) está congelada por hash: se mudar,
   o teste quebra e pede a revisão do BDR-001.
2. Migração aplicada nunca é editada: mudança no banco entra como arquivo novo.
3. O papel do dashboard só lê o schema mart e não escreve.

Os testes 1 e 3 precisam de um Postgres com os papéis e as migrações aplicados (o CI sobe
um vazio; localmente, o do compose). Sem DATABASE_URL_ETL e DATABASE_URL_APP, são pulados.
"""

import hashlib
import os
from pathlib import Path

import psycopg
import pytest

SQL_DIR = Path(__file__).parents[1] / "etl" / "sql"
MIGRACOES = {"001_mart.sql": "89af24087764054e", "002_explorar.sql": "11f10b80733f49af"}
DEFINICAO_DO_RETORNO = "d14317660987ee91"  # vw_usuarios + mart.wilson, no Postgres 16

ETL, APP = os.environ.get("DATABASE_URL_ETL"), os.environ.get("DATABASE_URL_APP")
com_banco = pytest.mark.skipif(
    not (ETL and APP), reason="sem banco: teste estrutural pulado"
)


def _hash(texto: str) -> str:
    return hashlib.sha256(texto.encode()).hexdigest()[:16]


def _um(con: psycopg.Connection, sql: str) -> object:
    linha = con.execute(sql).fetchone()  # type: ignore[call-overload]
    assert linha is not None
    return linha[0]


def test_migracao_aplicada_nunca_e_editada() -> None:
    atuais = {a.name: _hash(a.read_text()) for a in sorted(SQL_DIR.glob("*.sql"))}
    for nome, h in MIGRACOES.items():
        assert (
            atuais.get(nome) == h
        ), f"{nome} foi editada: mudança no banco entra como migração nova"
    novas = set(atuais) - set(MIGRACOES)
    assert not novas, f"registre neste teste o hash das migrações novas: {novas}"


@com_banco
def test_definicao_do_retorno_congelada() -> None:
    with psycopg.connect(APP or "") as c:
        view = _um(c, "SELECT pg_get_viewdef('mart.vw_usuarios'::regclass, true)")
        funcao = _um(c, "SELECT pg_get_functiondef('mart.wilson'::regproc)")
    assert (
        _hash(f"{view}{funcao}") == DEFINICAO_DO_RETORNO
    ), "a definição do retorno mudou: revise o BDR-001 e atualize este hash"


@com_banco
def test_dashboard_so_le_o_mart() -> None:
    with psycopg.connect(APP or "") as c:
        permissoes = c.execute(
            "SELECT DISTINCT table_schema, privilege_type"
            " FROM information_schema.role_table_grants WHERE grantee = 'bi_app'"
        ).fetchall()
        assert set(permissoes) == {("mart", "SELECT")}
        assert (
            _um(c, "SELECT has_schema_privilege('bi_app', 'public', 'CREATE')") is False
        )
        with pytest.raises(psycopg.Error):
            c.execute("INSERT INTO mart.cargas (versao_codigo) VALUES ('teste')")
