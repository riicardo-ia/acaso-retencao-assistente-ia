"""Validação dos dados da tela Explorar contra o banco da carga (teste de integração).

Roda com o compose no ar:
  DATABASE_URL_APP=postgresql://bi_app:local_app@127.0.0.1:55432/bi pytest tests/test_explorar_dados.py
Sem a variável, os testes são pulados.

1. Sem filtro, o número é o oficial.
2. As partes somam o todo, em cada dimensão.
3. O SQL do banco bate com um cálculo independente em Python (analise/definicoes.py)
   para filtros sorteados.
"""

import os
import random
from datetime import date
from typing import Any

import pandas as pd
import psycopg
import pytest
from psycopg.rows import dict_row

from analise.definicoes import elegiveis, retorno_por_dia
from app.main import DIMENSOES, SQL

URL = os.environ.get("DATABASE_URL_APP")
pytestmark = pytest.mark.skipif(
    not URL, reason="sem DATABASE_URL_APP: teste de integração pulado"
)


def _sql(nome: str, params: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    with psycopg.connect(URL or "") as c, c.cursor(row_factory=dict_row) as cur:
        cur.execute(SQL[nome], params or {})  # type: ignore[call-overload]
        return cur.fetchall()


def _sem_filtro() -> dict[str, Any]:
    op = _sql("opcoes")[0]
    return {"inicio": op["inicio"], "fim": op["fim"], **{d: None for d in DIMENSOES}}


@pytest.fixture(scope="module", autouse=True)
def _exige_carga() -> None:
    """No CI o banco existe, mas está vazio (sem a base bruta): a integração fica para o local."""
    with psycopg.connect(URL or "") as c:
        linha = c.execute("SELECT count(*) FROM mart.cargas").fetchone()
    if not linha or not linha[0]:
        pytest.skip("banco sem carga: teste de integração pulado")


@pytest.fixture(scope="module")
def python() -> pd.DataFrame:
    """Retorno por pessoa calculado em Python a partir dos eventos, com o perfil do banco."""
    with psycopg.connect(URL or "") as c:
        ev = pd.DataFrame(
            c.execute("SELECT usuario_id, ts FROM mart.eventos").fetchall(),
            columns=["usuario", "ts"],
        )
        perfil = pd.DataFrame(
            c.execute(
                "SELECT usuario_id, idioma, dispositivo, tema, modelo FROM mart.perfil_usuario"
            ).fetchall(),
            columns=["usuario", *DIMENSOES],
        )
    ev["ts"] = pd.to_datetime(ev["ts"], utc=True)
    u = elegiveis(
        retorno_por_dia(ev), inicio_base=ev["ts"].min(), fim_base=ev["ts"].max()
    )
    u["dia1"] = u["inicio"].dt.tz_convert("America/Sao_Paulo").dt.date
    return u.merge(perfil, on="usuario")


def test_sem_filtro_e_o_numero_oficial() -> None:
    recorte = _sql("resumo", _sem_filtro())[0]
    oficial = _sql("geral")[0]
    assert (recorte["n"], recorte["voltaram"]) == (
        oficial["usuarios"],
        oficial["voltaram"],
    )


@pytest.mark.parametrize("dimensao", DIMENSOES)
def test_partes_somam_o_todo(dimensao: str) -> None:
    params = _sem_filtro()
    total = _sql("resumo", params)[0]
    partes = _sql(f"grupo_{dimensao}", params)
    assert sum(p["n"] for p in partes) == total["n"]
    assert sum(p["voltaram"] for p in partes) == total["voltaram"]


def test_banco_bate_com_python_em_filtros_sorteados(python: pd.DataFrame) -> None:
    op = _sql("opcoes")[0]
    sorteio = random.Random(2026)
    for _ in range(25):
        params: dict[str, Any] = _sem_filtro()
        for d in DIMENSOES:
            if sorteio.random() < 0.5:
                params[d] = sorteio.choice(op[d])
        if sorteio.random() < 0.5:
            params["inicio"] = date(2023, sorteio.randint(5, 12), 1)
        banco = _sql("resumo", params)[0]
        x = python[
            (python["dia1"] >= params["inicio"]) & (python["dia1"] <= params["fim"])
        ]
        for d in DIMENSOES:
            if params[d] is not None:
                x = x[x[d] == params[d]]
        assert (banco["n"], banco["voltaram"]) == (
            len(x),
            int(x["retornou"].sum()),
        ), params
