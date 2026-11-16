"""Carga da base analítica: base bruta (parquet) -> Postgres (schema mart).

Uma execução faz tudo, de forma idempotente (apaga e recarrega na mesma transação):
  1. extrai a base bruta do Brasil se ela ainda não existe (etl.extrair);
  2. deriva conversas e eventos (sem texto, IP ou user-agent) e roda a análise;
  3. carrega o mart, atualiza a view materializada e confere o retorno calculado em
     SQL contra o calculado em Python; se divergir, NÃO publica (código de saída 1).

Rodar: python -m etl.carga
"""

import hashlib
import io
import json
import os
import subprocess
import sys
import time
from pathlib import Path

import pandas as pd
import psycopg
from statsmodels.stats.proportion import (
    confint_proportions_2indep,
    test_proportions_2indep,
)

from analise import base, efeitos, semana, sensibilidade
from analise.classificar import TEMAS
from analise.definicoes import elegiveis, retorno_por_dia
from analise.variaveis import (
    conversas_detalhadas,
    dispositivo,
    grupo_idioma,
    primeira_experiencia,
)

BRUTO = Path(os.environ.get("BRUTO", "data/raw/wildchat_brazil.parquet"))
TEMAS_SEED = "data/seed/temas.csv"
SQL_DIR = Path(__file__).parent / "sql"
SEMANA_ANALISADA = os.environ.get("SEMANA_ANALISADA", "2023-11-20")


def usuario_id(ip: str, sal: str) -> str:
    """Pseudônimo estável e não reversível do IP (que já vem com hash na base)."""
    return hashlib.sha256((sal + ip).encode()).hexdigest()[:20]


def pessoas(conv: pd.DataFrame, sal: str) -> pd.Series:
    """Quem é a pessoa de cada conversa: o IP pseudonimizado (BDR-001).

    O user-agent fica de fora de propósito: ele muda com o navegador ou o aparelho, e
    somá-lo à chave transforma a mesma pessoa em várias (a falha do incidente §4.2).
    """
    return conv["ip"].map(lambda ip: usuario_id(ip, sal))


def montar(sal: str) -> dict[str, pd.DataFrame]:
    conv = conversas_detalhadas(str(BRUTO)).merge(
        pd.read_csv(TEMAS_SEED)[["conv_id", "tema", "insatisfacao"]],
        on="conv_id",
        how="left",
    )
    conv["tema"] = conv["tema"].fillna("outro")
    conv["insatisfacao"] = conv["insatisfacao"].fillna("nao_avaliavel")
    uas = conv.groupby("ip")["ua"].nunique()
    conv["ip_anomalo"] = conv["ip"].map(uas >= 10)
    conv["usuario_id"] = pessoas(conv, sal)
    ev = base.eventos(str(BRUTO)).merge(conv[["conv_id", "usuario_id"]], on="conv_id")

    mart_conv = pd.DataFrame(
        {
            "conv_id": conv["conv_id"],
            "usuario_id": conv["usuario_id"],
            "inicio": conv["ts_inicio"],
            "fim": conv["ts_fim"],
            "modelo": conv["model"],
            "gpt4": conv["model"].str.startswith("gpt-4"),
            "turnos": conv["turn"],
            "idioma": conv["language"].map(grupo_idioma),
            "dispositivo": conv["ua"].map(dispositivo),
            "tema": conv["tema"],
            "recusa_1a_resposta": conv["recusa_1a_resposta"],
            "tam_msg1": conv["tam_msg1"],
            "ip_anomalo": conv["ip_anomalo"],
        }
    )

    # análise, sobre os mesmos dados (usuário = pseudônimo)
    u = elegiveis(
        retorno_por_dia(
            ev[["usuario_id", "ts"]].rename(columns={"usuario_id": "usuario"})
        ),
        inicio_base=ev["ts"].min(),
        fim_base=ev["ts"].max(),
    )
    c = conv.rename(columns={"usuario_id": "usuario"})
    tabela = u.merge(primeira_experiencia(u, c), on="usuario", how="left")
    d = efeitos.preparar(tabela)
    ef = efeitos.bruto(d).merge(efeitos.ajustado(d), on=["fator", "nivel"], how="left")
    ef = ef.sort_values(
        "ajustado_pp", key=lambda s: s.abs(), ascending=False, na_position="last"
    )

    regime = efeitos.gpt4_por_regime(d)
    ipw = efeitos.ipw_gpt4(d)
    gpt4 = pd.concat(
        [
            pd.DataFrame(
                {
                    "metodo": "regime de oferta",
                    "detalhe": regime["regime"],
                    "dif_pp": regime["dif_pp"],
                    "lo": regime["lo"],
                    "hi": regime["hi"],
                    "n": regime["n_gpt4"] + regime["n_gpt35"],
                }
            ),
            pd.DataFrame(
                [
                    {
                        "metodo": "IPW",
                        "detalhe": f"SMD máx. {ipw['smd_max_antes']:.2f} -> {ipw['smd_max_depois']:.2f}",
                        "dif_pp": ipw["ipw_pp"],
                        "lo": ipw["ipw_lo"],
                        "hi": ipw["ipw_hi"],
                        "n": ipw["n"],
                    }
                ]
            ),
        ]
    )

    conv_sens = base.conversas(str(BRUTO))
    ev_sens = base.eventos(str(BRUTO))
    sens = pd.DataFrame(
        [
            sensibilidade.resumo(cn, sensibilidade.calcular(cn, conv_sens, ev_sens))
            for cn in sensibilidade.CENARIOS
        ]
    )

    tabela["semana"] = pd.to_datetime(tabela["semana"])
    tabela["chegada"] = tabela["tema"].map(
        lambda x: "só testa / pede imagem / burla"
        if x in semana.CHEGADA_FRACA
        else "pedido real"
    )
    cort = semana.coortes(tabela).sort_values("semana").reset_index(drop=True)
    alvo = pd.Timestamp(SEMANA_ANALISADA)
    i = cort.index[cort["semana"] == alvo][0]
    antes, depois = (
        tabela[tabela["semana"].isin(cort["semana"].iloc[i - 4 : i])],
        tabela[tabela["semana"] == alvo],
    )
    decomp = []
    for seg in ["chegada", "dispositivo", "gpt4"]:
        k = (
            semana.kitagawa(antes, depois, seg)
            .reset_index()
            .rename(columns={seg: "grupo"})
        )
        decomp.append(
            k.assign(semana=alvo.date(), segmento=seg, grupo=k["grupo"].astype(str))
        )
    dec = pd.concat(decomp).rename(
        columns={
            "n_1": "n_antes",
            "w_1": "peso_antes",
            "r_1": "retorno_antes",
            "n_2": "n_semana",
            "w_2": "peso_semana",
            "r_2": "retorno_semana",
        }
    )

    homog = semana.homogeneidade(cort)
    kb, nb = antes["retornou"].sum(), len(antes)
    ka, na = depois["retornou"].sum(), len(depois)
    _, p_semana = test_proportions_2indep(ka, na, kb, nb, method="wald")
    lo_s, hi_s = confint_proportions_2indep(ka, na, kb, nb, method="newcomb")
    insat = efeitos.insatisfacao(d).iloc[0]
    diag = efeitos.diagnostico(d)
    testes = pd.DataFrame(
        [
            {
                "nome": "homogeneidade_semanas",
                "descricao": f"qui-quadrado entre {homog['semanas']} semanas com n >= 30 "
                f"({homog['gl']} gl): H0 = todas as semanas têm o mesmo retorno",
                "valor": homog["chi2"],
                "lo": None,
                "hi": None,
                "p": homog["p"],
                "n": homog["semanas"],
            },
            {
                "nome": "semana_analisada",
                "descricao": f"retorno da semana de {alvo.date()} menos o das 4 semanas anteriores (pp)",
                "valor": 100 * (ka / na - kb / nb),
                "lo": 100 * lo_s,
                "hi": 100 * hi_s,
                "p": p_semana,
                "n": na + nb,
            },
            {
                "nome": "modelo_efeitos",
                "descricao": "regressão logística dos efeitos: pseudo-R² de McFadden; p = teste da "
                "razão de verossimilhança contra o modelo sem fatores",
                "valor": diag["pseudo_r2"],
                "lo": None,
                "hi": None,
                "p": diag["p"],
                "n": diag["n"],
            },
            {
                "nome": "insatisfacao",
                "descricao": "insatisfação na 1ª conversa (corrige, repete ou reclama), ajustado (pp); "
                "só quem mandou mais de uma mensagem",
                "valor": insat["ajustado_pp"],
                "lo": insat["lo"],
                "hi": insat["hi"],
                "p": insat["p"],
                "n": insat["n_avaliavel"],
            },
        ]
    )

    primeiras = c.merge(tabela[["usuario"]], on="usuario")
    primeiras = (
        primeiras.sort_values(["ts_inicio", "conv_id"]).groupby("usuario").first()
    )
    uso = []
    for dim, serie_c, serie_u in [
        ("tema", conv["tema"], primeiras["tema"]),
        (
            "idioma",
            conv["language"].map(grupo_idioma),
            primeiras["language"].map(grupo_idioma),
        ),
        ("dispositivo", conv["ua"].map(dispositivo), primeiras["ua"].map(dispositivo)),
    ]:
        pc, pu = (
            serie_c.value_counts(normalize=True),
            serie_u.value_counts(normalize=True),
        )
        for cat in pc.index.union(pu.index):
            nome = TEMAS[cat].split(":")[0] if dim == "tema" and cat in TEMAS else cat
            uso.append(
                {
                    "dimensao": dim,
                    "categoria": nome,
                    "pct_conversas": 100 * pc.get(cat, 0),
                    "pct_usuarios": 100 * pu.get(cat, 0),
                }
            )

    return {
        "conversas": mart_conv,
        "eventos": ev[["usuario_id", "ts"]],
        "efeitos": ef[
            [
                "fator",
                "rotulo",
                "nivel",
                "referencia",
                "natureza",
                "n",
                "retorno_pct",
                "retorno_ref_pct",
                "bruto_pp",
                "bruto_lo",
                "bruto_hi",
                "ajustado_pp",
                "ajustado_lo",
                "ajustado_hi",
                "p",
            ]
        ],
        "sensibilidade": sens,
        "gpt4_selecao": gpt4,
        "semana_decomposicao": dec[
            [
                "semana",
                "segmento",
                "grupo",
                "n_antes",
                "peso_antes",
                "retorno_antes",
                "n_semana",
                "peso_semana",
                "retorno_semana",
                "mix_pp",
                "taxa_pp",
            ]
        ],
        "uso_por_categoria": pd.DataFrame(uso),
        "testes": testes,
        "perfil_usuario": pd.DataFrame(
            {
                "usuario_id": tabela["usuario"],
                "idioma": tabela["idioma"],
                "dispositivo": tabela["dispositivo"],
                "tema": tabela["tema"].fillna("outro"),
                "modelo": tabela["gpt4"].map({True: "GPT-4", False: "GPT-3.5"}),
            }
        ),
        "_python_coortes": semana.coortes(tabela).assign(
            semana=lambda x: x["semana"].dt.date
        ),
    }


def aplicar_migracoes(con: psycopg.Connection) -> None:
    con.execute(
        "CREATE TABLE IF NOT EXISTS mart.migracoes (nome text PRIMARY KEY, em timestamptz DEFAULT now())"
    )
    feitas = {r[0] for r in con.execute("SELECT nome FROM mart.migracoes").fetchall()}
    for arq in sorted(SQL_DIR.glob("*.sql")):
        if arq.name not in feitas:
            with con.transaction():
                con.execute(arq.read_text())  # type: ignore[call-overload]
                con.execute(
                    "INSERT INTO mart.migracoes (nome) VALUES (%s)", (arq.name,)
                )
            print(f"migração aplicada: {arq.name}", flush=True)


def copiar(con: psycopg.Connection, tabela: str, df: pd.DataFrame) -> None:
    """COPY em lote. Colunas inteiras no banco recebem inteiros (o pandas vira float com nulos)."""
    inteiras = {
        r[0]
        for r in con.execute(
            "SELECT column_name FROM information_schema.columns"
            " WHERE table_schema = 'mart' AND table_name = %s AND data_type IN ('integer', 'bigint')",
            (tabela,),
        ).fetchall()
    }
    df = df.copy()
    for col in inteiras & set(df.columns):
        df[col] = pd.to_numeric(df[col]).round().astype("Int64")
    buf = io.StringIO()
    df.to_csv(buf, index=False, header=False, na_rep="\\N")
    buf.seek(0)
    cols = ", ".join(df.columns)
    with con.cursor().copy(
        f"COPY mart.{tabela} ({cols}) FROM STDIN WITH (FORMAT csv, NULL '\\N')"
    ) as cp:  # type: ignore[arg-type]
        cp.write(buf.read())


def main() -> int:
    inicio = time.monotonic()
    if not BRUTO.exists():
        from etl.extrair import extrair

        extrair(BRUTO.parent)
    contagens = json.loads((BRUTO.parent / "contagens.json").read_text())
    dados = montar(os.environ["SAL_USUARIO"])
    python_coortes = dados.pop("_python_coortes")
    versao = (
        os.environ.get("VERSAO_CODIGO")
        or subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"], capture_output=True, text=True
        ).stdout.strip()
        or "desconhecida"
    )

    with psycopg.connect(os.environ["DATABASE_URL_ETL"]) as con:
        aplicar_migracoes(con)
        with con.transaction():
            for tabela, df in dados.items():
                con.execute(f"TRUNCATE mart.{tabela}")  # type: ignore[arg-type]
                copiar(con, tabela, df)
            con.execute("REFRESH MATERIALIZED VIEW mart.mv_usuarios")
            con.execute("REFRESH MATERIALIZED VIEW mart.mv_coortes_semanais")
            sql_coortes = pd.DataFrame(
                con.execute(
                    "SELECT semana, novos, voltaram FROM mart.mv_coortes_semanais ORDER BY semana"
                ).fetchall(),
                columns=["semana", "novos", "voltaram"],
            )
            py = (
                python_coortes[["semana", "n", "voltaram"]]
                .rename(columns={"n": "novos"})
                .sort_values("semana")
            )
            ok = (
                sql_coortes.reset_index(drop=True)
                .astype(str)
                .equals(py.reset_index(drop=True).astype(str))
            )
            total, voltaram = (
                int(sql_coortes["novos"].sum()),
                int(sql_coortes["voltaram"].sum()),
            )
            con.execute(
                "INSERT INTO mart.cargas (versao_codigo, linhas_fonte, linhas_brasil, conversas, eventos,"
                " usuarios_elegiveis, retorno_pct, reconciliacao_ok, duracao_s) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                (
                    versao,
                    sum(v["total"] for v in contagens.values()),
                    sum(v["brasil"] for v in contagens.values()),
                    len(dados["conversas"]),
                    len(dados["eventos"]),
                    total,
                    round(100 * voltaram / total, 1),
                    ok,
                    round(time.monotonic() - inicio, 1),
                ),
            )
            if not ok:
                print(
                    "RECONCILIAÇÃO FALHOU: o retorno em SQL diverge do Python. Carga NÃO publicada.",
                    file=sys.stderr,
                )
                print(
                    sql_coortes.merge(
                        py, on="semana", how="outer", suffixes=("_sql", "_py")
                    ).to_string(),
                    file=sys.stderr,
                )
                raise SystemExit(1)
    print(
        f"carga ok: {len(dados['conversas'])} conversas, {total} usuários elegíveis, retorno {100 * voltaram / total:.1f}%,"
        f" reconciliação SQL = Python ({time.monotonic() - inicio:.0f}s)",
        flush=True,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
