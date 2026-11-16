"""Passo 6: o que faz quem experimentou voltar em até 7 dias, quanto pesa cada fator
e quanto é causa e não seleção.

1. Efeito BRUTO de cada fator: diferença de retorno (pp) contra a referência, IC 95%.
2. Efeito AJUSTADO: regressão logística com todos os fatores e controles juntos;
   efeito marginal médio (pp) com IC 95% (método delta), ordenado pelo tamanho.
   Mediadores (engajamento no 1º dia) ficam FORA do modelo principal.
3. Causa x seleção do GPT-4: IPW (escore de propensão com variáveis anteriores ao
   uso) + comparação entre o regime em que o GPT-4 era escolhido e o regime em que
   era o padrão.

Rodar: python -m analise.efeitos (depois de python -m analise.tabela)
"""

from pathlib import Path
import json

import numpy as np
import pandas as pd
import statsmodels.formula.api as smf
from statsmodels.tools.sm_exceptions import PerfectSeparationError
from statsmodels.stats.proportion import confint_proportions_2indep

TABELA = "data/tmp/usuarios.parquet"
N_MIN = 30  # abaixo disso o grupo não tem estimativa própria

# fator -> (rótulo legível, nível de referência, natureza)
FATORES: dict[str, tuple[str, str, str]] = {
    "tema": ("Tema da 1ª conversa", "conhecimento", "experiência"),
    "recusa_1a": ("Recusa ou limitação na 1ª resposta", "False", "experiência"),
    "gpt4": ("1ª conversa com GPT-4", "False", "experiência"),
    "resposta_longa": (
        "Resposta média ≥ 1.200 caracteres (mediana)",
        "False",
        "experiência",
    ),
    "msg_curta": ("1ª mensagem com < 10 caracteres", "False", "perfil"),
    "idioma": ("Idioma da 1ª conversa", "português", "perfil"),
    "dispositivo": ("Dispositivo", "computador", "perfil"),
    "faixa_horaria": ("Horário de início", "tarde", "contexto"),
    "fim_de_semana": ("Começou no fim de semana", "False", "contexto"),
}
CONTROLES = ["periodo"]  # época (oferta do GPT-4): controle, não fator
MEDIADORES = {
    "turnos_exp1": "Turnos no 1º dia (≥ 5)",
    "varios_temas": "Mais de um tema no 1º dia",
}


def preparar(t: pd.DataFrame) -> pd.DataFrame:
    d = t.copy()
    d["y"] = d["retornou"].astype(int)
    d["resposta_longa"] = d["tam_resposta_media"] >= d["tam_resposta_media"].median()
    contagem = d["tema"].value_counts()
    d["tema"] = d["tema"].where(d["tema"].map(contagem) >= N_MIN, "outro")
    for c in [
        "recusa_1a",
        "gpt4",
        "resposta_longa",
        "msg_curta",
        "fim_de_semana",
        "varios_temas",
    ]:
        d[c] = d[c].astype(bool).astype(str)
    d["turnos_exp1"] = (d["turnos_exp1"] >= 5).astype(str)
    return d


def bruto(d: pd.DataFrame) -> pd.DataFrame:
    linhas = []
    for fator, (rotulo, ref, natureza) in {
        **FATORES,
        **{k: (v, "False", "mediador") for k, v in MEDIADORES.items()},
    }.items():
        r = d.loc[d[fator] == ref, "y"]
        for nivel, g in d.groupby(fator):
            if str(nivel) == ref:
                continue
            lo, hi = confint_proportions_2indep(
                g["y"].sum(), len(g), r.sum(), len(r), method="newcomb"
            )
            linhas.append(
                {
                    "fator": fator,
                    "rotulo": rotulo,
                    "nivel": str(nivel),
                    "referencia": ref,
                    "natureza": natureza,
                    "n": len(g),
                    "retorno_pct": 100 * g["y"].mean(),
                    "retorno_ref_pct": 100 * r.mean(),
                    "bruto_pp": 100 * (g["y"].mean() - r.mean()),
                    "bruto_lo": 100 * lo,
                    "bruto_hi": 100 * hi,
                }
            )
    return pd.DataFrame(linhas)


def _termo(fator: str) -> str:
    return f"C({fator}, Treatment(reference='{FATORES[fator][1]}'))"


def ajustado(d: pd.DataFrame) -> pd.DataFrame:
    """Efeito marginal médio de cada nível, com todos os fatores e a época no modelo."""
    formula = "y ~ " + " + ".join(
        [_termo(f) for f in FATORES] + [f"C({c})" for c in CONTROLES]
    )
    modelo = smf.logit(formula, data=d).fit(disp=0, cov_type="HC1")
    me = modelo.get_margeff(at="overall", dummy=True).summary_frame()
    linhas = []
    for termo, row in me.iterrows():
        termo = str(termo)
        for fator in FATORES:
            prefixo = _termo(fator) + "[T."
            if termo.startswith(prefixo):
                linhas.append(
                    {
                        "fator": fator,
                        "nivel": termo[len(prefixo) : -1],
                        "ajustado_pp": 100 * row["dy/dx"],
                        "ajustado_lo": 100 * row["Conf. Int. Low"],
                        "ajustado_hi": 100 * row["Cont. Int. Hi."],
                        "p": row["Pr(>|z|)"],
                    }
                )
    return pd.DataFrame(linhas)


def ipw_gpt4(d: pd.DataFrame, n_boot: int = 500) -> dict[str, float]:
    """Efeito do GPT-4 por ponderação pelo inverso do escore de propensão.

    O escore usa só o que existe ANTES da resposta do modelo: época, horário, dia,
    dispositivo, idioma, tamanho da 1ª mensagem e tema pedido."""
    ps_formula = "g ~ C(periodo) + C(faixa_horaria) + C(fim_de_semana) + C(dispositivo) + C(idioma) + np.log1p(tam_msg1) + C(tema)"
    base = d.assign(g=(d["gpt4"] == "True").astype(int))
    base = base[
        base["periodo"] != "2 jul–out/23 (sem GPT-4)"
    ]  # sem sobreposição: ninguém podia usar GPT-4

    def estimar(x: pd.DataFrame) -> tuple[float, pd.DataFrame]:
        ps = smf.logit(ps_formula, data=x).fit(disp=0).predict(x).clip(0.02, 0.98)
        w = np.where(x["g"] == 1, 1 / ps, 1 / (1 - ps))
        y1 = np.average(x["y"][x["g"] == 1], weights=w[x["g"] == 1])
        y0 = np.average(x["y"][x["g"] == 0], weights=w[x["g"] == 0])
        return 100 * (y1 - y0), x.assign(w=w)

    efeito, pesado = estimar(base)
    # Reamostras em que uma categoria rara some deixam o escore de propensão sem
    # solução (matriz singular): são descartadas e contadas; exige >= 95% válidas.
    rng = np.random.default_rng(2026)
    # ordem fixa pelo horário do 1º uso: o resultado não depende do pseudônimo do usuário
    base = base.sort_values(["inicio", "y"]).reset_index(drop=True)
    boot = []
    for _ in range(n_boot):
        amostra = base.sample(
            len(base), replace=True, random_state=int(rng.integers(10**9))
        )
        try:
            boot.append(estimar(amostra)[0])
        except (np.linalg.LinAlgError, PerfectSeparationError):
            continue
    if len(boot) < 0.95 * n_boot:
        raise RuntimeError(
            f"bootstrap do IPW instável: só {len(boot)} de {n_boot} reamostras válidas"
        )
    lo, hi = np.percentile(boot, [2.5, 97.5])
    bruto_pp = 100 * (
        base.loc[base["g"] == 1, "y"].mean() - base.loc[base["g"] == 0, "y"].mean()
    )

    def smd(col: pd.Series, w: np.ndarray | None) -> float:
        a, b = col[pesado["g"] == 1], col[pesado["g"] == 0]
        wa = None if w is None else w[pesado["g"] == 1]
        wb = None if w is None else w[pesado["g"] == 0]
        ma, mb = np.average(a, weights=wa), np.average(b, weights=wb)
        va, vb = (
            np.average((a - ma) ** 2, weights=wa),
            np.average((b - mb) ** 2, weights=wb),
        )
        return float(abs(ma - mb) / np.sqrt((va + vb) / 2)) if va + vb > 0 else 0.0

    covs = pd.get_dummies(
        pesado[["periodo", "dispositivo", "idioma", "tema", "faixa_horaria"]]
    ).astype(float)
    covs["log_tam_msg1"] = np.log1p(pesado["tam_msg1"])
    smd_antes = max(smd(covs[c], None) for c in covs)
    smd_depois = max(smd(covs[c], pesado["w"].to_numpy()) for c in covs)
    return {
        "n": len(base),
        "n_gpt4": int(base["g"].sum()),
        "bruto_pp": bruto_pp,
        "ipw_pp": efeito,
        "ipw_lo": lo,
        "ipw_hi": hi,
        "smd_max_antes": smd_antes,
        "smd_max_depois": smd_depois,
        "reamostras_validas": len(boot),
    }


def gpt4_por_regime(d: pd.DataFrame) -> pd.DataFrame:
    """GPT-4 escolhido (abr–jun/23, nov/23) x GPT-4 padrão (dez/23–abr/24)."""
    linhas = []
    for nome, periodos in {
        "GPT-4 opcional (escolhido pela pessoa)": [
            "1 abr–jun/23 (GPT-4 opcional)",
            "3 nov/23 (GPT-4 opcional)",
        ],
        "GPT-4 padrão (≈ 90% das conversas)": ["4 dez/23–abr/24 (GPT-4 maioria)"],
    }.items():
        x = d[d["periodo"].isin(periodos)]
        a, b = x[x["gpt4"] == "True"]["y"], x[x["gpt4"] == "False"]["y"]
        lo, hi = confint_proportions_2indep(
            a.sum(), len(a), b.sum(), len(b), method="newcomb"
        )
        linhas.append(
            {
                "regime": nome,
                "n_gpt4": len(a),
                "n_gpt35": len(b),
                "retorno_gpt4": 100 * a.mean(),
                "retorno_gpt35": 100 * b.mean(),
                "dif_pp": 100 * (a.mean() - b.mean()),
                "lo": 100 * lo,
                "hi": 100 * hi,
            }
        )
    return pd.DataFrame(linhas)


ROTULO_NIVEL = {
    "saudacao_teste": "só cumprimenta ou testa",
    "imagem_midia": "pede imagem, vídeo ou áudio",
    "burlar_regras": "tenta burlar regras",
    "estudo": "estudo",
    "programacao": "programação",
    "reescrita": "reescrita, resumo, tradução",
    "marketing": "marketing",
    "ficcao": "ficção e roleplay",
    "vida_pratica": "vida prática",
    "outro": "outro",
    "True": "sim",
    "celular": "celular",
    "noite": "noite",
    "madrugada": "madrugada",
    "manhã": "manhã",
    "inglês": "inglês",
    "outro_idioma": "outro idioma",
}


def grafico(
    efeitos: pd.DataFrame,
    n_total: int,
    caminho: str = "docs/analise/img/09-efeitos.png",
) -> None:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    e = efeitos.dropna(subset=["ajustado_pp"])
    e = e[e["n"] >= N_MIN].iloc[::-1]
    fig, ax = plt.subplots(figsize=(9, 0.36 * len(e) + 1.6))
    y = range(len(e))
    cor = [
        "#2a78d6" if lo > 0 or hi < 0 else "#a7a59c"
        for lo, hi in zip(e["ajustado_lo"], e["ajustado_hi"])
    ]
    ax.hlines(list(y), e["ajustado_lo"], e["ajustado_hi"], color=cor, linewidth=2)
    ax.scatter(
        e["ajustado_pp"], list(y), color=cor, s=36, zorder=3, label="ajustado (IC 95%)"
    )
    ax.scatter(
        e["bruto_pp"],
        list(y),
        facecolors="none",
        edgecolors="#52514e",
        s=30,
        zorder=3,
        label="bruto",
    )
    ax.axvline(0, color="#52514e", linewidth=1)
    nomes = [
        f"{rot}: {ROTULO_NIVEL.get(niv, niv)}  (n={n})"
        if fat in ("tema", "idioma", "dispositivo", "faixa_horaria")
        else f"{rot}  (n={n})"
        for fat, rot, niv, n in zip(
            e["fator"].astype(str),
            e["rotulo"].astype(str),
            e["nivel"].astype(str),
            e["n"],
        )
    ]
    ax.set_yticks(list(y), nomes, fontsize=8)
    ax.set_xlabel(
        "diferença no retorno em 7 dias, em pontos percentuais, contra a referência",
        fontsize=8,
        color="#52514e",
    )
    ax.set_title(
        "O que muda o retorno em 7 dias",
        loc="left",
        fontsize=12,
        fontweight="bold",
        pad=22,
    )
    ax.text(
        0,
        1.01,
        "efeito ajustado por todos os fatores e pela época · azul: IC não cruza o zero · cinza: inconclusivo",
        transform=ax.transAxes,
        fontsize=8,
        color="#52514e",
    )
    for lado in ("top", "right"):
        ax.spines[lado].set_visible(False)
    ax.grid(axis="x", color="#e6e5e0", linewidth=0.6)
    ax.legend(fontsize=8, frameon=False, loc="lower right")
    fig.text(
        0.01,
        0.01,
        f"Fonte: WildChat-1M, Brasil, {n_total:_} usuários elegíveis".replace("_", ".")
        + " · retorno = uso em outro dia local, de D+1 a D+7 · regressão logística, efeito marginal médio"
        + f" · grupos com n < {N_MIN} omitidos",
        fontsize=7,
        color="#52514e",
    )
    fig.tight_layout(rect=(0, 0.03, 1, 1))
    fig.savefig(caminho, dpi=140)
    plt.close(fig)


def insatisfacao(d: pd.DataFrame) -> pd.DataFrame:
    """Subanálise de qualidade da resposta: só quem mandou mais de uma mensagem na 1ª conversa
    (sem 2ª mensagem não há reação a observar). Ajustada pelos mesmos fatores e pela época."""
    x = d[d["insatisfacao"] != "nao_avaliavel"].copy()
    x["insatisfeito"] = (x["insatisfacao"] != "nenhum").astype(str)
    formula = "y ~ C(insatisfeito, Treatment(reference='False')) + " + " + ".join(
        [_termo(f) for f in FATORES if f != "tema"] + [f"C({c})" for c in CONTROLES]
    )
    m = (
        smf.logit(formula, data=x)
        .fit(disp=0, cov_type="HC1")
        .get_margeff(at="overall", dummy=True)
        .summary_frame()
    )
    linha = m.iloc[0]
    a, b = x[x["insatisfeito"] == "True"]["y"], x[x["insatisfeito"] == "False"]["y"]
    return pd.DataFrame(
        [
            {
                "n_avaliavel": len(x),
                "n_insatisfeito": len(a),
                "retorno_insatisfeito": 100 * a.mean(),
                "retorno_satisfeito": 100 * b.mean(),
                "ajustado_pp": 100 * linha["dy/dx"],
                "lo": 100 * linha["Conf. Int. Low"],
                "hi": 100 * linha["Cont. Int. Hi."],
                "p": linha["Pr(>|z|)"],
            }
        ]
    )


def main() -> None:
    d = preparar(pd.read_parquet(TABELA))
    efeitos = bruto(d).merge(ajustado(d), on=["fator", "nivel"], how="left")
    efeitos = efeitos.sort_values(
        "ajustado_pp", key=lambda s: s.abs(), ascending=False, na_position="last"
    )
    Path("data/tmp").mkdir(parents=True, exist_ok=True)
    efeitos.to_csv("data/tmp/efeitos.csv", index=False)
    grafico(efeitos, n_total=len(d))
    cols = [
        "rotulo",
        "nivel",
        "n",
        "retorno_pct",
        "bruto_pp",
        "ajustado_pp",
        "ajustado_lo",
        "ajustado_hi",
        "p",
    ]
    with pd.option_context(
        "display.width",
        220,
        "display.max_columns",
        20,
        "display.float_format",
        "{:.1f}".format,
    ):
        print(efeitos[cols].to_string(index=False))
        print(
            "\nGPT-4 por regime de oferta:\n", gpt4_por_regime(d).to_string(index=False)
        )
    print(
        "\nInsatisfação na 1ª conversa (quem mandou > 1 mensagem):\n",
        insatisfacao(d).round(2).to_string(index=False),
    )
    ipw = ipw_gpt4(d)
    print(
        "\nGPT-4 por IPW:",
        json.dumps({k: round(v, 2) for k, v in ipw.items()}, ensure_ascii=False),
    )
    json.dump(ipw, open("data/tmp/ipw_gpt4.json", "w"), indent=2)


if __name__ == "__main__":
    main()
