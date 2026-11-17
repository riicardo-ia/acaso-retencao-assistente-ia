"""Contrato das rotas do dashboard, sem banco (consultas simuladas)."""

import time
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
    "achados": [
        {
            "achado": "dispositivo",
            "grupo": "celular",
            "n": 723,
            "voltaram": 98,
            "retorno_pct": 13.6,
            "ic_lo": 11.3,
            "ic_hi": 16.2,
        },
        {
            "achado": "chegada",
            "grupo": "burlar_regras",
            "n": 12,
            "voltaram": 1,
            "retorno_pct": 8.3,
            "ic_lo": 1.5,
            "ic_hi": 35.4,
        },
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


def test_resposta_traz_achados_com_margem_e_faixa_do_acaso(cliente: TestClient) -> None:
    d = cliente.get("/api/analise").json()
    cel = next(a for a in d["achados"] if a["grupo"] == "celular")
    assert cel["ic_lo"] < cel["retorno_pct"] < cel["ic_hi"]
    pequeno = next(a for a in d["achados"] if a["grupo"] == "burlar_regras")
    assert pequeno["retorno_pct"] is None
    assert "acaso_lo" in d["sql"]["coortes"] and "mart.wilson" in d["sql"]["achados"]


# Documentação: só os arquivos da lista fechada; links internos abrem na própria página.


def test_documentacao_lista_decisoes_e_analise(cliente: TestClient) -> None:
    nomes = {d["nome"] for d in cliente.get("/api/documentos").json()}
    assert {"documento", "bdr-001", "adr-002", "eda", "incidente"} <= nomes


def test_documento_vira_html_com_links_internos(cliente: TestClient) -> None:
    d = cliente.get("/api/documentos/documento").json()
    assert "<table>" in d["html"]
    assert 'href="#documentacao/bdr-001"' in d["html"]
    assert 'src="/documentacao/arquivos/img/arquitetura.svg"' in d["html"]
    eda = cliente.get("/api/documentos/eda").json()["html"]
    assert 'src="/documentacao/arquivos/analise/img/01-uso-no-tempo.png"' in eda


@pytest.mark.parametrize(
    "caminho",
    ["inexistente", "..%2F..%2Fetc%2Fpasswd", "DOCUMENTO.md", "%2E%2E%2F.env"],
)
def test_documento_fora_da_lista_e_404(cliente: TestClient, caminho: str) -> None:
    assert cliente.get(f"/api/documentos/{caminho}").status_code == 404


def test_imagem_da_documentacao_e_servida(cliente: TestClient) -> None:
    r = cliente.get("/documentacao/arquivos/img/arquitetura.svg")
    assert r.status_code == 200 and r.content.startswith(b"<svg")


def test_frases_no_idioma_da_tela(cliente: TestClient) -> None:
    en = cliente.get("/api/explorar?lang=en").json()["frases"][0]
    assert en == "In this segment, 18.4% of the 2,266 people came back within 7 days."
    es = cliente.get("/api/explorar?lang=es").json()["frases"][0]
    assert es.startswith("En este recorte, el 18,4% de las 2.266 personas")
    assert cliente.get("/api/explorar?lang=fr").status_code == 400


def test_tela_sempre_confere_se_ha_versao_nova(cliente: TestClient) -> None:
    """Sem isso, o navegador mostra a versão antiga da tela depois de uma atualização."""
    assert cliente.get("/static/app.css").headers["cache-control"] == "no-cache"
    assert (
        "cache-control" not in cliente.get("/api/explorar").headers
    )  # a API usa o cache por carga


# Busca nos documentos: índice em memória, sem acento e sem diferenciar maiúsculas.


def test_busca_encontra_a_secao_do_documento(cliente: TestClient) -> None:
    achados = cliente.get("/api/busca?q=KITAGAWA").json()
    assert achados and achados[0]["documento"] in {"indicadores", "analise"}
    assert all({"secao", "ancora", "trecho"} <= set(a) for a in achados)


def test_busca_ignora_acento_e_termo_curto(cliente: TestClient) -> None:
    com, sem = (
        cliente.get("/api/busca?q=sessão").json(),
        cliente.get("/api/busca?q=sessao").json(),
    )
    assert com == sem and com
    assert cliente.get("/api/busca?q=a").json() == []


def test_busca_e_rapida(cliente: TestClient) -> None:
    from app import busca, main as m

    docs = tuple((n, t, m.DOCS / a) for n, (_, t, a) in m.DOCUMENTOS.items())
    busca.buscar("premissa", docs)  # monta o índice uma vez
    inicio = time.perf_counter()
    for termo in ("fuso", "celular retorno", "margem de erro", "incidente", "ipw") * 20:
        busca.buscar(termo, docs)
    assert time.perf_counter() - inicio < 0.5  # 100 buscas em menos de meio segundo


def test_ancora_da_busca_existe_no_documento(cliente: TestClient) -> None:
    achado = cliente.get("/api/busca?q=premissas").json()[0]
    html = cliente.get(f"/api/documentos/{achado['documento']}").json()["html"]
    assert f'id="{achado["ancora"]}"' in html


def test_documento_no_idioma_da_tela(cliente: TestClient) -> None:
    d = cliente.get("/api/documentos/documento?lang=en").json()
    assert '<h2 id="1-the-answer">1. The answer</h2>' in d["html"]
    # links e imagens continuam resolvidos a partir do original
    assert 'href="#documentacao/bdr-001"' in d["html"]
    assert 'src="/documentacao/arquivos/img/arquitetura.svg"' in d["html"]
    es = cliente.get("/api/documentos/eda?lang=es").json()["html"]
    assert 'src="/documentacao/arquivos/analise/img/01-uso-no-tempo.png"' in es
    assert cliente.get("/api/documentos/documento?lang=fr").status_code == 400


def test_busca_no_idioma_da_tela(cliente: TestClient) -> None:
    en = cliente.get("/api/busca?q=assumptions&lang=en").json()
    assert en and en[0]["documento"] == "documento"
    assert cliente.get("/api/busca?q=assumptions&lang=pt").json() == []
    assert cliente.get("/api/busca?q=fuso&lang=fr").status_code == 400
