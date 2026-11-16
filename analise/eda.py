"""Passo 4: análise exploratória. Gera os gráficos de docs/analise/img/ e imprime os números citados.

Rodar: python -m analise.eda  (depois de python -m analise.tabela)
"""

from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import pandas as pd  # noqa: E402
from statsmodels.stats.proportion import proportion_confint  # noqa: E402

from analise import base  # noqa: E402
from analise.definicoes import retorno_por_dia  # noqa: E402
from analise.classificar import TEMAS  # noqa: E402
from analise.variaveis import conversas_detalhadas, grupo_idioma  # noqa: E402

IMG = Path("docs/analise/img")
ROTULOS_TEMA = {k: v.split(":")[0] for k, v in TEMAS.items()}
AZUL, LARANJA, CINZA = "#2a78d6", "#eb6834", "#52514e"
FUNDO, TEXTO = "#fcfcfb", "#0b0b0b"
REGIMES = [  # oferta do GPT-4 (Q11)
    ("2023-04-01", "2023-07-01", "GPT-4 opcional"),
    ("2023-07-01", "2023-11-01", "sem GPT-4"),
    ("2023-11-01", "2023-12-01", "opcional"),
    ("2023-12-01", "2024-05-01", "GPT-4 maioria"),
]


def _eixo(ax: plt.Axes, titulo: str, subtitulo: str) -> None:
    ax.set_facecolor(FUNDO)
    if ax.figure is not None:
        ax.figure.set_facecolor(FUNDO)
    ax.set_title(
        titulo, loc="left", fontsize=12, color=TEXTO, pad=22, fontweight="bold"
    )
    ax.text(0, 1.02, subtitulo, transform=ax.transAxes, fontsize=9, color=CINZA)
    for lado in ("top", "right"):
        ax.spines[lado].set_visible(False)
    for lado in ("left", "bottom"):
        ax.spines[lado].set_color("#c9c8c2")
    ax.tick_params(colors=CINZA, labelsize=8)
    ax.grid(axis="y", color="#e6e5e0", linewidth=0.6)
    ax.set_axisbelow(True)


def _salvar(fig: plt.Figure, nome: str, fonte: str) -> None:
    fig.text(0.01, 0.01, fonte, fontsize=7, color=CINZA)
    fig.tight_layout(rect=(0, 0.03, 1, 1))
    fig.savefig(IMG / nome, dpi=140)
    plt.close(fig)


def _taxa_com_ic(g: pd.core.groupby.SeriesGroupBy) -> pd.DataFrame:
    r = g.agg(n="size", k="sum")
    lo, hi = proportion_confint(r["k"], r["n"], method="wilson")
    return r.assign(taxa=100 * r["k"] / r["n"], lo=100 * lo, hi=100 * hi)


def uso_no_tempo(conv: pd.DataFrame, usuarios: pd.DataFrame) -> None:
    novos = (
        usuarios.set_index("inicio")
        .resample("W-MON", label="left", closed="left")["usuario"]
        .size()
    )
    gpt4 = (
        conv.set_index("ts_inicio")
        .resample("MS")["model"]
        .apply(lambda m: 100 * m.str.startswith("gpt-4").mean())
    )
    fig, (a1, a2) = plt.subplots(
        2, 1, figsize=(9, 5.6), sharex=True, height_ratios=(3, 2)
    )
    for ini, fim, nome in REGIMES:
        for ax in (a1, a2):
            ax.axvspan(
                pd.Timestamp(ini, tz="UTC"),
                pd.Timestamp(fim, tz="UTC"),
                color="#f0efec" if "sem" in nome else FUNDO,
                zorder=0,
            )
    a1.bar(novos.index, novos.values, width=5, color=AZUL)
    _eixo(
        a1,
        "Novos usuários por semana",
        "1ª sessão de cada IP · faixa cinza: GPT-4 indisponível",
    )
    a2.plot(
        gpt4.index + pd.Timedelta(days=14),
        gpt4.values,
        color=AZUL,
        linewidth=2,
        marker="o",
        markersize=4,
    )
    _eixo(
        a2, "% das conversas com GPT-4, por mês", "a oferta do modelo muda com a época"
    )
    a2.set_ylim(0, 100)
    _salvar(
        fig,
        "01-uso-no-tempo.png",
        "Fonte: WildChat-1M, Brasil, 11.621 conversas · BDR-001",
    )


def curva_retorno(
    eventos: pd.DataFrame, usuarios: pd.DataFrame, fuso: str = "America/Sao_Paulo"
) -> pd.Series:
    """% acumulado de quem já voltou, por dia de calendário local desde o 1º dia."""
    e = eventos.merge(usuarios[["usuario", "inicio"]], on="usuario")
    dia = e["ts"].dt.tz_convert(fuso).dt.tz_localize(None).dt.normalize()
    dia1 = e["inicio"].dt.tz_convert(fuso).dt.tz_localize(None).dt.normalize()
    dist = (dia - dia1).dt.days
    primeira_volta = dist[dist >= 1].groupby(e["usuario"]).min()
    dias = pd.Series(range(0, 15))
    acum = dias.map(lambda d: 100 * (primeira_volta <= d).sum() / len(usuarios))
    fig, ax = plt.subplots(figsize=(9, 3.6))
    ax.plot(dias, acum, color=AZUL, linewidth=2, marker="o", markersize=4)
    ax.axvline(7, color=CINZA, linewidth=1, linestyle="--")
    ax.text(7.15, 1.5, "janela de 7 dias", fontsize=8, color=CINZA)
    for d in (1, 7, 14):
        ax.annotate(
            f"{acum[d]:.1f}%",
            (d, acum[d]),
            textcoords="offset points",
            xytext=(0, 8),
            ha="center",
            fontsize=8,
            color=TEXTO,
        )
    _eixo(
        ax,
        "Quanto já voltou, por dia desde o 1º dia de uso",
        f"% acumulado dos {len(usuarios):,} usuários elegíveis".replace(",", "."),
    )
    ax.set_xlabel(
        "dias de calendário depois do 1º dia (fuso de São Paulo)",
        fontsize=8,
        color=CINZA,
    )
    ax.set_ylim(0, max(acum) * 1.3)
    _salvar(
        fig,
        "02-curva-de-retorno.png",
        "Fonte: WildChat-1M, Brasil · retorno = uso em outro dia local · BDR-001 rev. 1",
    )
    return acum


def distribuicao(
    conv: pd.DataFrame,
    primeiras: pd.DataFrame,
    coluna: str,
    rotulos: dict[str, str],
    nome: str,
    titulo: str,
) -> pd.DataFrame:
    """% das conversas x % dos usuários (pela 1ª conversa) em cada categoria."""
    d = pd.DataFrame(
        {
            "conversas": 100 * conv[coluna].value_counts(normalize=True),
            "usuarios": 100 * primeiras[coluna].value_counts(normalize=True),
        }
    ).fillna(0)
    d = d.sort_values("usuarios")
    fig, ax = plt.subplots(figsize=(9, 0.42 * len(d) + 1.6))
    y = range(len(d))
    ax.barh(
        [i + 0.2 for i in y],
        d["conversas"],
        height=0.38,
        color=LARANJA,
        label="% das conversas",
    )
    ax.barh(
        [i - 0.2 for i in y],
        d["usuarios"],
        height=0.38,
        color=AZUL,
        label="% dos usuários (1ª conversa)",
    )
    ax.set_yticks(list(y), [rotulos.get(str(k), str(k)) for k in d.index])
    ax.legend(fontsize=8, frameon=False, loc="lower right")
    _eixo(
        ax,
        titulo,
        "laranja: todas as conversas · azul: 1ª conversa de cada usuário elegível",
    )
    ax.grid(axis="x", color="#e6e5e0", linewidth=0.6)
    ax.grid(axis="y", visible=False)
    fonte = "Fonte: WildChat-1M, Brasil, 11.621 conversas"
    if coluna == "tema":
        fonte += " · temas: classificação por LLM (Passo 5)"
    _salvar(fig, nome, fonte)
    return d.round(1)


def retorno_por_faixa(
    t: pd.DataFrame,
    coluna: str,
    cortes: list[float],
    rotulos: list[str],
    nome: str,
    titulo: str,
    sub: str,
) -> pd.DataFrame:
    faixa = pd.cut(t[coluna], cortes, labels=rotulos, right=False)
    r = _taxa_com_ic(t.groupby(faixa, observed=True)["retornou"])
    fig, ax = plt.subplots(figsize=(9, 3.6))
    x = range(len(r))
    ax.errorbar(
        x,
        r["taxa"],
        yerr=[r["taxa"] - r["lo"], r["hi"] - r["taxa"]],
        fmt="o",
        color=AZUL,
        ecolor=AZUL,
        elinewidth=1.5,
        capsize=0,
        markersize=7,
    )
    media = 100 * t["retornou"].mean()
    ax.axhline(media, color=CINZA, linewidth=1, linestyle="--")
    ax.text(
        len(r) - 0.6,
        media + 1,
        f"média {media:.1f}%",
        fontsize=8,
        color=CINZA,
        ha="right",
    )
    ax.set_xticks(list(x), [f"{lab}\nn={n}" for lab, n in zip(r.index, r["n"])])
    ax.set_xlim(-0.5, len(r) - 0.5)
    _eixo(ax, titulo, sub)
    _salvar(
        fig,
        nome,
        "Fonte: WildChat-1M, Brasil · barras: IC 95% (Wilson) · só descritivo, sem ajuste de confusão",
    )
    return r


def main() -> None:
    IMG.mkdir(parents=True, exist_ok=True)
    t = pd.read_parquet("data/tmp/usuarios.parquet")
    conv = conversas_detalhadas().rename(columns={"ip": "usuario"})
    ev = base.eventos().merge(conv[["conv_id", "usuario"]], on="conv_id")

    uso_no_tempo(conv, t)
    temas = pd.read_csv("data/seed/temas.csv")[["conv_id", "tema", "insatisfacao"]]
    conv = conv.merge(temas, on="conv_id", how="left")
    conv["idioma"] = conv["language"].map(grupo_idioma)
    conv["tamanho"] = pd.cut(
        conv["turn"],
        [1, 2, 3, 5, 10, 10**6],
        labels=["1 turno", "2", "3–4", "5–9", "10+"],
        right=False,
    ).astype(str)
    conv["modelo"] = conv["model"].str.replace("-turbo", "")
    primeiras = (
        conv.merge(t[["usuario", "inicio", "fim_exp1"]], on="usuario")
        .query("ts_inicio >= inicio and ts_inicio <= fim_exp1")
        .sort_values(["ts_inicio", "conv_id"])
        .groupby("usuario")
        .first()
    )
    for col, nome, titulo in [
        ("tema", "05-uso-por-tema.png", "Uso por tema"),
        ("idioma", "06-uso-por-idioma.png", "Uso por idioma"),
        ("tamanho", "07-uso-por-tamanho.png", "Uso por tamanho da conversa (turnos)"),
        ("modelo", "08-uso-por-modelo.png", "Uso por versão do modelo"),
    ]:
        print(
            f"\n{titulo}\n",
            distribuicao(conv, primeiras, col, ROTULOS_TEMA, nome, titulo),
        )
    acum = curva_retorno(ev, t)
    print(
        "retorno acumulado (dia 1, 3, 7, 14):",
        [round(acum[d], 1) for d in (1, 3, 7, 14)],
    )

    r = retorno_por_faixa(
        t,
        "turnos_exp1",
        [1, 2, 3, 5, 10, 999],
        ["1", "2", "3–4", "5–9", "10+"],
        "03-retorno-por-turnos.png",
        "Retorno em 7 dias por nº de turnos no 1º dia",
        "quanto mais a pessoa conversa na 1ª vez, mais volta: é engajamento, não causa",
    )
    print(r[["n", "taxa", "lo", "hi"]].round(1))
    r = retorno_por_faixa(
        t,
        "tam_msg1",
        [0, 10, 50, 200, 1000, 10**9],
        ["< 10", "10–49", "50–199", "200–999", "1.000+"],
        "04-retorno-por-tamanho-da-1a-mensagem.png",
        "Retorno em 7 dias pelo tamanho da 1ª mensagem (caracteres)",
        'quem chega com "oi" ou "teste" volta menos',
    )
    print(r[["n", "taxa", "lo", "hi"]].round(1))

    por_usuario: pd.Series = conv["usuario"].value_counts()
    for p in (0.01, 0.05, 0.10):
        top = por_usuario.head(max(1, int(len(por_usuario) * p))).sum()
        print(
            f"top {int(p * 100)}% dos IPs: {100 * top / por_usuario.sum():.1f}% das conversas"
        )
    todos = retorno_por_dia(ev)
    print(
        "usuários com 1 só dia ativo em toda a base:",
        f"{100 * (todos["dias_ativos"] == 1).mean():.1f}%",
    )


if __name__ == "__main__":
    main()
