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
    {
        "categoria": "tablet",
        "n": 12,
        "voltaram": 1,
        "retorno_pct": 8.3,
        "ic_lo": 1.5,
        "ic_hi": 35.4,
    },
]
RECORTE_PEQUENO = {
    "n": 12,
    "voltaram": 1,
    "retorno_pct": 8.3,
    "ic_lo": 1.5,
    "ic_hi": 35.4,
}
NUMEROS = ("n", "voltaram", "retorno_pct", "ic_lo", "ic_hi")
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
    "chegada": [
        {"categoria": "estudo", "n": 387, "pct_pessoas": 17.1, "pct_conversas": 15.6},
        {"categoria": "outro", "n": 9, "pct_pessoas": 0.4, "pct_conversas": 0.3},
    ],
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
    "efeitos": [
        {
            "fator": "tema",
            "nivel": "outro",
            "n": 20,
            "retorno_pct": 5.0,
            "ajustado_pp": -3.1,
        }
    ],
    "gpt4": [],
    "semana_total": [
        {
            "semana": date(2023, 11, 20),
            "n_antes": 188,
            "voltaram_antes": 43,
            "retorno_antes_pct": 22.9,
            "n_semana": 64,
            "voltaram_semana": 8,
            "retorno_semana_pct": 12.5,
        }
    ],
    "semana_segmentos": [{"segmento": "chegada", "mix_pp": -0.4, "taxa_pp": -10.0}],
    "semana_grupos": [
        {
            "segmento": "chegada",
            "grupo": "pedido real",
            "n_antes": 152,
            "retorno_antes_pct": 26.3,
            "n_semana": 50,
            "retorno_semana_pct": 14.0,
        },
        {
            "segmento": "chegada",
            "grupo": "só testa / pede imagem / burla",
            "n_antes": 36,
            "retorno_antes_pct": 8.3,
            "n_semana": 14,
            "retorno_semana_pct": 7.1,
        },
    ],
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


# Amostra mínima (BDR-003): grupo com menos de 30 pessoas não sai da API com nenhum
# número, nem a contagem. A garantia está no backend, não só na tela.


def test_grupo_pequeno_do_explorar_sai_sem_numeros(cliente: TestClient) -> None:
    d = cliente.get("/api/explorar").json()
    tablet = next(g for g in d["grupos"]["dispositivo"] if g["categoria"] == "tablet")
    assert tablet["suficiente"] is False
    assert all(tablet[k] is None for k in NUMEROS)
    mes = d["serie"][1]
    assert all(mes[k] is None for k in NUMEROS)
    tema = next(c for c in d["chegada"] if c["categoria"] == "outro")
    assert tema["n"] is None and tema["pct_pessoas"] is None


def test_recorte_pequeno_sai_sem_numeros_nem_na_frase(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def consultar(nome: str, params: dict[str, Any] | None = None) -> Any:
        filtrado = bool(params and params.get("tema"))
        return [RECORTE_PEQUENO] if nome == "resumo" and filtrado else LINHAS[nome]

    monkeypatch.setattr(main, "consultar", consultar)
    monkeypatch.setattr(main.pool, "open", lambda: None)
    main._em_cache.cache_clear()
    d = TestClient(main.app).get("/api/explorar?tema=estudo").json()
    assert all(d["recorte"][k] is None for k in NUMEROS)
    assert "12" not in d["frases"][0]


def test_analise_esconde_numeros_de_grupo_pequeno(cliente: TestClient) -> None:
    d = cliente.get("/api/analise").json()
    assert d["coortes"][0]["novos"] is None and d["coortes"][0]["retorno_pct"] is None
    assert d["efeitos"][0]["ajustado_pp"] is None
    grupos = {g["grupo"]: g for g in d["semana"]["grupos"]}
    assert grupos["pedido real"]["suficiente"] is True
    pequeno = grupos["só testa / pede imagem / burla"]
    assert pequeno["n_semana"] is None and pequeno["retorno_semana_pct"] is None
    assert d["semana"]["segmentos"][0]["taxa_pp"] == -10.0


def test_toda_resposta_tem_request_id_e_tempo(cliente: TestClient) -> None:
    r = cliente.get("/healthz")
    assert r.headers["x-request-id"].startswith("req_")
    assert r.headers["server-timing"].startswith("app;dur=")
