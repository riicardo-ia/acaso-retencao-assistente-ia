"""API do dashboard: fina, só faz SELECT no schema mart; nenhuma regra de negócio fica aqui.

Duas telas:
- Explorar (self-host BI): números descritivos com os 5 filtros principais e frases por regra;
- Análise completa: os resultados estatísticos da análise, fixos (sem filtros).
Cada resposta traz a procedência e a consulta SQL de cada número.
"""

import logging
import os
import re
import time
import uuid
from datetime import date
from decimal import Decimal
from functools import lru_cache
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from app import insights

N_MIN = insights.N_MIN
ESTATICO = Path(__file__).parent / "static"
DIMENSOES = ("idioma", "dispositivo", "tema", "modelo")

logging.basicConfig(level=logging.INFO, format="%(message)s")
log = logging.getLogger("api")
pool = ConnectionPool(
    os.environ.get("DATABASE_URL_APP", ""),
    min_size=1,
    max_size=5,
    kwargs={"autocommit": True},
    open=False,
)
app = FastAPI(title="Retorno do assistente", docs_url="/api/docs", redoc_url=None)

# Filtro comum a todas as consultas do Explorar: parâmetros nulos = sem filtro.
RECORTE = """WITH recorte AS (
    SELECT * FROM mart.vw_explorar
    WHERE dia1 BETWEEN %(inicio)s AND %(fim)s
      AND (%(idioma)s::text IS NULL OR idioma = %(idioma)s)
      AND (%(dispositivo)s::text IS NULL OR dispositivo = %(dispositivo)s)
      AND (%(tema)s::text IS NULL OR tema = %(tema)s)
      AND (%(modelo)s::text IS NULL OR modelo = %(modelo)s)
)"""

SQL: dict[str, str] = {
    "resumo": RECORTE
    + """
SELECT count(*) AS n, count(*) FILTER (WHERE retornou) AS voltaram,
       round(100.0 * count(*) FILTER (WHERE retornou) / nullif(count(*), 0), 1) AS retorno_pct,
       mart.wilson(count(*) FILTER (WHERE retornou), nullif(count(*), 0), -1) AS ic_lo,
       mart.wilson(count(*) FILTER (WHERE retornou), nullif(count(*), 0), 1)  AS ic_hi
FROM recorte""",
    "serie": RECORTE
    + """
SELECT mes, count(*) AS n, count(*) FILTER (WHERE retornou) AS voltaram,
       round(100.0 * count(*) FILTER (WHERE retornou) / count(*), 1) AS retorno_pct,
       mart.wilson(count(*) FILTER (WHERE retornou), count(*), -1) AS ic_lo,
       mart.wilson(count(*) FILTER (WHERE retornou), count(*), 1)  AS ic_hi
FROM recorte GROUP BY mes ORDER BY mes""",
    **{
        f"grupo_{d}": RECORTE
        + f"""
SELECT {d} AS categoria, count(*) AS n, count(*) FILTER (WHERE retornou) AS voltaram,
       round(100.0 * count(*) FILTER (WHERE retornou) / count(*), 1) AS retorno_pct,
       mart.wilson(count(*) FILTER (WHERE retornou), count(*), -1) AS ic_lo,
       mart.wilson(count(*) FILTER (WHERE retornou), count(*), 1)  AS ic_hi
FROM recorte GROUP BY {d} ORDER BY retorno_pct DESC"""
        for d in DIMENSOES
    },
    "chegada": RECORTE
    + """
SELECT r.tema AS categoria,
       round(100.0 * count(DISTINCT r.usuario_id) / sum(count(DISTINCT r.usuario_id)) OVER (), 1) AS pct_pessoas,
       round(100.0 * count(c.conv_id) / sum(count(c.conv_id)) OVER (), 1) AS pct_conversas
FROM recorte r JOIN mart.conversas c ON c.usuario_id = r.usuario_id
GROUP BY r.tema ORDER BY pct_pessoas DESC""",
    "opcoes": """SELECT min(dia1) AS inicio, max(dia1) AS fim,
       array_agg(DISTINCT idioma) AS idioma, array_agg(DISTINCT dispositivo) AS dispositivo,
       array_agg(DISTINCT tema) AS tema, array_agg(DISTINCT modelo) AS modelo
FROM mart.vw_explorar""",
    "geral": "SELECT usuarios, voltaram, retorno_pct, ic_lo, ic_hi FROM mart.vw_retorno_geral",
    "coortes": "SELECT semana, novos, voltaram, retorno_pct, ic_lo, ic_hi FROM mart.mv_coortes_semanais ORDER BY semana",
    "efeitos": """SELECT fator, rotulo, nivel, referencia, natureza, n, retorno_pct, retorno_ref_pct,
       bruto_pp, bruto_lo, bruto_hi, ajustado_pp, ajustado_lo, ajustado_hi, p
FROM mart.efeitos""",
    "gpt4": "SELECT metodo, detalhe, dif_pp, lo, hi, n FROM mart.gpt4_selecao",
    "semana": "SELECT * FROM mart.semana_decomposicao ORDER BY segmento, grupo",
    "sensibilidade": "SELECT * FROM mart.sensibilidade",
    "testes": "SELECT nome, descricao, valor, lo, hi, p, n FROM mart.testes",
    "carga": """SELECT executada_em, versao_codigo, linhas_fonte, linhas_brasil, conversas,
       usuarios_elegiveis, retorno_pct, reconciliacao_ok
FROM mart.cargas ORDER BY id DESC LIMIT 1""",
}


@app.on_event("startup")
def abrir() -> None:
    pool.open()


def consultar(nome: str, params: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    with pool.connection() as c, c.cursor(row_factory=dict_row) as cur:
        cur.execute(SQL[nome], params or {})  # type: ignore[call-overload]
        return [
            {k: float(v) if isinstance(v, Decimal) else v for k, v in r.items()}
            for r in cur.fetchall()
        ]


@lru_cache(maxsize=512)
def _em_cache(
    nome: str, params: tuple[tuple[str, Any], ...], carga: str
) -> list[dict[str, Any]]:
    """Cache por carga: o resultado só muda quando uma carga nova é publicada."""
    return consultar(nome, dict(params))


def dados(nome: str, params: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    chave = tuple(sorted((params or {}).items()))
    return _em_cache(nome, chave, str(consultar("carga")[0]["executada_em"]))


def procedencia() -> dict[str, Any]:
    c = consultar("carga")[0]
    return {
        "fonte": "WildChat-1M (allenai), conversas com country = 'Brazil'",
        "carga_em": c["executada_em"],
        "versao_codigo": c["versao_codigo"],
        "linhas_fonte": c["linhas_fonte"],
        "linhas_brasil": c["linhas_brasil"],
        "reconciliacao_ok": c["reconciliacao_ok"],
        "definicao_retorno": "Voltou = usou o assistente em outro dia (horário de São Paulo), entre o 1º e o "
        "7º dia depois do primeiro dia de uso. Pessoa = endereço de internet (IP), anonimizado.",
    }


@app.middleware("http")
async def registrar(request: Request, chamar):  # type: ignore[no-untyped-def]
    rid = request.headers.get("x-request-id", f"req_{uuid.uuid4().hex[:6]}")
    inicio = time.perf_counter()
    resposta = await chamar(request)
    ms = (time.perf_counter() - inicio) * 1000
    resposta.headers["x-request-id"] = rid
    resposta.headers["server-timing"] = f"app;dur={ms:.0f}"
    log.info(
        '{"request_id": "%s", "rota": "%s", "params": "%s", "status": %d, "duracao_ms": %.0f}',
        rid,
        request.url.path,
        request.url.query,
        resposta.status_code,
        ms,
    )
    return resposta


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


def _filtros(
    inicio: str | None, fim: str | None, valores: dict[str, str | None]
) -> dict[str, Any]:
    op = dados("opcoes")[0]
    params: dict[str, Any] = {"inicio": op["inicio"], "fim": op["fim"]}
    for nome, v in (("inicio", inicio), ("fim", fim)):
        if v:
            if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", v):
                raise HTTPException(400, f"data inválida em {nome} (use AAAA-MM-DD)")
            params[nome] = date.fromisoformat(v)
    for d in DIMENSOES:
        v = valores.get(d) or None
        if v is not None and v not in op[d]:
            raise HTTPException(400, f"valor inválido para {d}")
        params[d] = v
    return params


@app.get("/api/explorar")
def explorar(
    inicio: str | None = None,
    fim: str | None = None,
    idioma: str | None = None,
    dispositivo: str | None = None,
    tema: str | None = None,
    modelo: str | None = None,
) -> dict[str, Any]:
    """Tela Explorar: números descritivos com os 5 filtros e frases por regra."""
    valores = {
        "idioma": idioma,
        "dispositivo": dispositivo,
        "tema": tema,
        "modelo": modelo,
    }
    params = _filtros(inicio, fim, valores)
    op = dados("opcoes")[0]
    sem_filtro = {
        "inicio": op["inicio"],
        "fim": op["fim"],
        **{d: None for d in DIMENSOES},
    }
    filtrado = params != sem_filtro
    recorte = dados("resumo", params)[0]
    base = dados("resumo", sem_filtro)[0]
    grupos = {
        d: [{**g, "suficiente": g["n"] >= N_MIN} for g in dados(f"grupo_{d}", params)]
        for d in DIMENSOES
    }
    frases = [insights.resumo(recorte, base, filtrado)]
    if recorte["n"] >= N_MIN:
        frases += insights.destaques(
            {
                d: [{**g, "rotulo": insights.rotulo(g["categoria"])} for g in linhas]
                for d, linhas in grupos.items()
            },
            {d: v for d, v in valores.items() if v},
        )
    return {
        "filtros": {k: str(v) if isinstance(v, date) else v for k, v in params.items()},
        "opcoes": {
            k: sorted(v) if isinstance(v, list) else str(v) for k, v in op.items()
        },
        "recorte": {**recorte, "suficiente": recorte["n"] >= N_MIN},
        "base": base,
        "serie": [{**s, "suficiente": s["n"] >= N_MIN} for s in dados("serie", params)],
        "grupos": grupos,
        "rotulos": insights.ROTULOS,
        "chegada": dados("chegada", params),
        "frases": frases,
        "n_min": N_MIN,
        "procedencia": procedencia(),
        "sql": {
            "Recorte e retorno": SQL["resumo"],
            "Retorno por mês": SQL["serie"],
            "Por grupo": SQL["grupo_tema"],
            "Com que tema chegam": SQL["chegada"],
        },
    }


@app.get("/api/analise")
def analise() -> dict[str, Any]:
    """Tela Análise completa: resultados estatísticos fixos (base inteira, sem filtros)."""
    return {
        "geral": dados("geral")[0],
        "coortes": [{**c, "suficiente": c["novos"] >= N_MIN} for c in dados("coortes")],
        "efeitos": [{**e, "suficiente": e["n"] >= N_MIN} for e in dados("efeitos")],
        "gpt4": dados("gpt4"),
        "semana": dados("semana"),
        "sensibilidade": dados("sensibilidade"),
        "testes": dados("testes"),
        "n_min": N_MIN,
        "procedencia": procedencia(),
        "sql": {
            k: SQL[k]
            for k in ("geral", "efeitos", "gpt4", "semana", "sensibilidade", "testes")
        },
    }


app.mount("/static", StaticFiles(directory=ESTATICO), name="static")


@app.get("/")
def pagina() -> FileResponse:
    return FileResponse(ESTATICO / "index.html")
