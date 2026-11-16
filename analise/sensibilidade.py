"""Passo 2: quanto o retorno em 7 dias muda quando a definição muda.

Cada cenário troca UMA escolha em relação à referência. Rodar:
python -m analise.sensibilidade  (grava data/tmp/sensibilidade.csv e imprime a tabela)
"""

from dataclasses import dataclass, replace

from pathlib import Path
import pandas as pd
from statsmodels.stats.proportion import proportion_confint

from analise import base
from analise.definicoes import elegiveis, retorno_por_dia, retorno_por_sessao, unir_ips


@dataclass(frozen=True)
class Cenario:
    nome: str
    regra: str = "dia"  # dia (referência) | sessao
    chave: str = "ip"  # ip | ip_ua | ip_unido
    evento: str = "resposta"  # resposta | inicio_conversa
    gap_min: int = 30
    janela_dias: int = 7
    aquecimento_dias: int = 14
    corta_fim: bool = True
    sem_ip_anomalo: bool = False
    fuso: str = "America/Sao_Paulo"


REF = Cenario("referência: outro dia local, D+1 a D+7")
SESSAO = replace(
    REF,
    nome="regra anterior: nova sessão (pausa > 30 min) até 7 x 24 h",
    regra="sessao",
)
CENARIOS = [
    REF,
    SESSAO,
    replace(SESSAO, nome="  └ sessão com pausa de 15 min", gap_min=15),
    replace(SESSAO, nome="  └ sessão com pausa de 60 min", gap_min=60),
    replace(REF, nome="usuário = IP + user-agent", chave="ip_ua"),
    replace(REF, nome="usuário = IPs unidos pela conversa", chave="ip_unido"),
    replace(REF, nome="uso = só início de conversa", evento="inicio_conversa"),
    replace(REF, nome="janela de 3 dias", janela_dias=3),
    replace(REF, nome="janela de 14 dias", janela_dias=14),
    replace(REF, nome="sem corte das 2 primeiras semanas", aquecimento_dias=0),
    replace(REF, nome="sem corte do fim (janela incompleta)", corta_fim=False),
    replace(REF, nome="sem IPs anômalos (>= 10 user-agents)", sem_ip_anomalo=True),
    replace(REF, nome="dia contado em UTC", fuso="UTC"),
]


def _usuario_por_conversa(conv: pd.DataFrame, chave: str) -> pd.Series:
    if chave == "ip":
        return conv["ip"]
    if chave == "ip_ua":
        return conv["ip"] + "|" + conv["ua"]
    mapa = unir_ips(conv["ips"])
    return conv["ip"].map(mapa)


def calcular(c: Cenario, conv: pd.DataFrame, ev: pd.DataFrame) -> pd.DataFrame:
    conv = conv.assign(usuario=_usuario_por_conversa(conv, c.chave))
    if c.sem_ip_anomalo:
        uas = conv.groupby("ip")["ua"].nunique()
        conv = conv[~conv["ip"].isin(uas[uas >= 10].index)]
    if c.evento == "resposta":
        e = ev.merge(conv[["conv_id", "usuario"]], on="conv_id")
    else:
        e = conv[["usuario", "ts_inicio"]].rename(columns={"ts_inicio": "ts"})
    if c.regra == "dia":
        u = retorno_por_dia(e, janela_dias=c.janela_dias, fuso=c.fuso)
    else:
        u = retorno_por_sessao(e, gap_min=c.gap_min, janela_dias=c.janela_dias)
    fim_base = (
        ev["ts"].max()
        if c.corta_fim
        else ev["ts"].max() + pd.Timedelta(days=c.janela_dias)
    )
    return elegiveis(
        u,
        inicio_base=ev["ts"].min(),
        fim_base=fim_base,
        janela_dias=c.janela_dias,
        aquecimento_dias=c.aquecimento_dias,
        fuso=c.fuso,
    )


def resumo(c: Cenario, u: pd.DataFrame) -> dict[str, object]:
    n, k = len(u), int(u["retornou"].sum())
    lo, hi = proportion_confint(k, n, method="wilson")
    semanal = u.groupby("semana")["retornou"].agg(["size", "mean"])
    return {
        "cenario": c.nome,
        "usuarios": n,
        "voltaram": k,
        "retorno_pct": round(100 * k / n, 1),
        "ic95": f"{100 * lo:.1f}–{100 * hi:.1f}",
        "semanas": len(semanal),
        "semanas_n_menor_30": int((semanal["size"] < 30).sum()),
        "dp_semanal_pp": round(
            100 * semanal.loc[semanal["size"] >= 30, "mean"].std(), 1
        ),
    }


def main() -> pd.DataFrame:
    conv, ev = base.conversas(), base.eventos()
    tabela = pd.DataFrame([resumo(c, calcular(c, conv, ev)) for c in CENARIOS])
    Path("data/tmp").mkdir(parents=True, exist_ok=True)
    tabela.to_csv("data/tmp/sensibilidade.csv", index=False)
    return tabela


if __name__ == "__main__":
    with pd.option_context("display.width", 200, "display.max_columns", 20):
        print(main().to_string(index=False))
