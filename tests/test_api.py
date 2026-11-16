"""Contrato das rotas do dashboard, sem banco (consultas simuladas)."""

from datetime import date
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app import main

GRUPO = [
    {
        "categoria": "computador",
        "n": 1543,
        "voltaram": 318,
        "retorno_pct": 20.6,
        "ic_lo": 18.7,
        "ic_hi": 22.7,
    },
    {
        "categoria": "celular",
        "n": 723,
        "voltaram": 98,
        "retorno_pct": 13.6,
        "ic_lo": 11.3,
        "ic_hi": 16.2,
    },
]
LINHAS: dict[str, list[dict[str, Any]]] = {
    "carga": [
        {
            "executada_em": "2024-05-01T00:00:00",
            "versao_codigo": "teste",
            "linhas_fonte": 837989,
            "linhas_brasil": 11621,
            "conversas": 11621,
            "usuarios_elegiveis": 2266,
            "retorno_pct": 18.4,
            "reconciliacao_ok": True,
        }
    ],
    "opcoes": [
        {
            "inicio": date(2023, 4, 23),
            "fim": date(2024, 4, 21),
            "idioma": ["inglês", "outro", "português"],
            "dispositivo": ["celular", "computador"],
            "tema": ["estudo", "saudacao_teste"],
            "modelo": ["GPT-3.5", "GPT-4"],
        }
    ],
    "resumo": [
        {"n": 2266, "voltaram": 416, "retorno_pct": 18.4, "ic_lo": 16.8, "ic_hi": 20.0}
    ],
    "serie": [
        {
            "mes": "2023-05-01",
            "n": 300,
            "voltaram": 60,
            "retorno_pct": 20.0,
            "ic_lo": 15.9,
            "ic_hi": 24.8,
        },
        {
            "mes": "2023-06-01",
            "n": 12,
            "voltaram": 1,
            "retorno_pct": 8.3,
            "ic_lo": 1.5,
            "ic_hi": 35.4,
        },
    ],
    "grupo_idioma": [],
    "grupo_dispositivo": GRUPO,
    "grupo_tema": [],
    "grupo_modelo": [],
    "chegada": [{"categoria": "estudo", "pct_pessoas": 17.1, "pct_conversas": 15.6}],
    "geral": [
        {
            "usuarios": 2266,
            "voltaram": 416,
            "retorno_pct": 18.4,
            "ic_lo": 16.8,
            "ic_hi": 20.0,
        }
    ],
    "coortes": [
        {
            "semana": "2023-11-20",
            "novos": 12,
            "voltaram": 1,
            "retorno_pct": 8.3,
            "ic_lo": 1.5,
            "ic_hi": 35.4,
        }
    ],
    "efeitos": [{"fator": "tema", "nivel": "outro", "n": 20}],
    "gpt4": [],
    "semana": [],
    "sensibilidade": [],
    "testes": [],
}


@pytest.fixture
def cliente(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setattr(main, "consultar", lambda nome, params=None: LINHAS[nome])
    monkeypatch.setattr(main.pool, "open", lambda: None)
    main._em_cache.cache_clear()
    return TestClient(main.app)


def test_explorar_sem_filtro_traz_numero_oficial_frases_e_sql(
    cliente: TestClient,
) -> None:
    d = cliente.get("/api/explorar").json()
    assert d["recorte"]["retorno_pct"] == 18.4 and d["recorte"]["suficiente"] is True
    assert (
        d["frases"][0]
        == "Neste recorte, 18,4% das 2.266 pessoas voltaram em até 7 dias."
    )
    assert any("dispositivo" in f for f in d["frases"])
    assert "mart.vw_explorar" in d["sql"]["Recorte e retorno"]
    assert d["procedencia"]["reconciliacao_ok"] is True


def test_mes_com_menos_de_30_pessoas_e_insuficiente(cliente: TestClient) -> None:
    serie = cliente.get("/api/explorar").json()["serie"]
    assert [s["suficiente"] for s in serie] == [True, False]


def test_filtro_valido_e_aceito(cliente: TestClient) -> None:
    r = cliente.get(
        "/api/explorar?dispositivo=celular&inicio=2023-06-01&fim=2023-12-31"
    )
    assert r.status_code == 200
    assert r.json()["filtros"]["dispositivo"] == "celular"


@pytest.mark.parametrize(
    "consulta",
    ["dispositivo=tablet", "idioma=klingon", "inicio=01/06/2023", "modelo=GPT-5"],
)
def test_filtro_invalido_e_rejeitado(cliente: TestClient, consulta: str) -> None:
    assert cliente.get(f"/api/explorar?{consulta}").status_code == 400


def test_analise_e_estatica_e_marca_amostra_pequena(cliente: TestClient) -> None:
    d = cliente.get("/api/analise").json()
    assert d["geral"]["retorno_pct"] == 18.4
    assert d["efeitos"][0]["suficiente"] is False
    assert d["coortes"][0]["suficiente"] is False


def test_toda_resposta_tem_request_id_e_tempo(cliente: TestClient) -> None:
    r = cliente.get("/healthz")
    assert r.headers["x-request-id"].startswith("req_")
    assert r.headers["server-timing"].startswith("app;dur=")
