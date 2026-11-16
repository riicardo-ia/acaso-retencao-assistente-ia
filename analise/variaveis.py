"""Passo 3: variáveis da 1ª experiência (1ª sessão de cada usuário).

Cada função abaixo é a regra de derivação de uma variável; o dicionário com a
explicação de cada uma está em docs/analise/03-variaveis.md.
"""

import re

import duckdb
import pandas as pd

PADROES_RECUSA = re.compile(
    "|".join(
        [
            r"(desculp|sinto muito|lamento)[^.\n]{0,80}(não posso|não consigo|não é possível|não sou capaz|não tenho como)",
            r"como (um|uma) (modelo|assistente|ia|inteligência)[^.\n]{0,60}(não posso|não consigo|não tenho|não sou capaz)",
            r"(i'm sorry|i apologize|sorry)[^.\n]{0,60}(i can't|i cannot|i'm unable|i am unable|i'm not able)",
            r"as an ai( language model)?[^.\n]{0,60}(i can't|i cannot|i don't|i do not)",
        ]
    )
)


def tem_recusa(texto: str | None) -> bool:
    """Recusa ou limitação declarada nos primeiros 400 caracteres da resposta."""
    return bool(texto) and PADROES_RECUSA.search(str(texto).lower()[:400]) is not None


def dispositivo(ua: str) -> str:
    return (
        "celular"
        if re.search(r"mobile|android|iphone|ipad", ua, re.IGNORECASE)
        else "computador"
    )


def grupo_idioma(idioma: str) -> str:
    # detecção não confiável em mensagens curtas (Q8): só os dois idiomas com volume
    return {"Portuguese": "português", "English": "inglês"}.get(idioma, "outro")


def faixa_horaria(hora: int) -> str:
    return ["madrugada", "manhã", "tarde", "noite"][hora // 6]


def periodo_oferta(ts: pd.Timestamp) -> str:
    """Regime de oferta do GPT-4 (Q11): o modelo disponível muda com a época."""
    mes = ts.strftime("%Y-%m")
    if mes <= "2023-06":
        return "1 abr–jun/23 (GPT-4 opcional)"
    if mes <= "2023-10":
        return "2 jul–out/23 (sem GPT-4)"
    if mes == "2023-11":
        return "3 nov/23 (GPT-4 opcional)"
    return "4 dez/23–abr/24 (GPT-4 maioria)"


def conversas_detalhadas(
    bruto: str = "data/raw/wildchat_brazil.parquet", com_texto: bool = False
) -> pd.DataFrame:
    """Uma linha por conversa, com as medidas que viram variáveis.

    `com_texto=True` inclui a 1ª mensagem (`msg1`): só para a análise, nunca vai para a base analítica."""
    con = duckdb.connect()
    con.execute("SET TimeZone = 'UTC'")
    conv = con.execute(
        f"""
        SELECT b.conversation[1].turn_identifier AS conv_id, b.hashed_ip AS ip, b.model, b.turn,
               b.language, b.header."user-agent" AS ua, b.redacted,
               b.conversation[2].timestamp AS ts_inicio,
               b.timestamp AS ts_fim,
               length(coalesce(b.conversation[1].content, '')) AS tam_msg1,
               coalesce(trim(b.conversation[1].content), '') = '' AS msg_vazia,
               list_avg([length(coalesce(x.content, '')) FOR x IN b.conversation IF x.role = 'assistant'])
                   AS tam_resposta_media,
               [x.content FOR x IN b.conversation IF x.role = 'assistant'] AS respostas,
               b.conversation[1].content AS msg1
        FROM '{bruto}' b
        """
    ).df()
    conv["recusa"] = conv["respostas"].map(lambda rs: any(tem_recusa(r) for r in rs))
    # 1ª resposta: acontece antes de qualquer engajamento (não sobe com o nº de turnos)
    conv["recusa_1a_resposta"] = conv["respostas"].map(
        lambda rs: tem_recusa(rs[0]) if len(rs) else False
    )
    return conv.drop(columns=["respostas"] if com_texto else ["respostas", "msg1"])


def primeira_experiencia(
    usuarios: pd.DataFrame, conv: pd.DataFrame, fuso: str = "America/Sao_Paulo"
) -> pd.DataFrame:
    """`usuarios`: usuario, inicio, fim_exp1. `conv`: conversas com a coluna `usuario`.

    Só entram as conversas que começam dentro da 1ª experiência (1º dia local).
    A 1ª conversa é a que começa primeiro (horário da 1ª resposta); empate: menor conv_id."""
    c = conv.merge(usuarios[["usuario", "inicio", "fim_exp1"]], on="usuario")
    c = c[
        (c["ts_inicio"] >= c["inicio"]) & (c["ts_inicio"] <= c["fim_exp1"])
    ].sort_values(["ts_inicio", "conv_id"])
    g = c.groupby("usuario")
    primeira = g.first()
    local = primeira["inicio"].dt.tz_convert(fuso)
    r = pd.DataFrame(
        {
            "gpt4": primeira["model"].str.startswith("gpt-4"),
            "tema": primeira["tema"] if "tema" in c else None,
            "varios_temas": (g["tema"].nunique() > 1) if "tema" in c else None,
            "insatisfacao": primeira["insatisfacao"] if "insatisfacao" in c else None,
            "idioma": primeira["language"].map(grupo_idioma),
            "dispositivo": primeira["ua"].map(dispositivo),
            "turnos_exp1": g["turn"].sum(),
            "conversas_exp1": g.size(),
            "tam_msg1": primeira["tam_msg1"],
            "msg_curta": primeira["tam_msg1"] < 10,
            "tam_resposta_media": g["tam_resposta_media"].mean(),
            "recusa": g["recusa"].any(),
            "recusa_1a": primeira["recusa_1a_resposta"],
            "redacted": g["redacted"].any(),
            "faixa_horaria": local.dt.hour.map(faixa_horaria),
            "fim_de_semana": local.dt.weekday >= 5,
            "periodo": local.dt.tz_localize(None).map(periodo_oferta),
        }
    )
    return r.reset_index()
