"""Passo 6: uma semana em que o retorno caiu ou subiu, e o que explica.

1. A variação entre semanas é maior que o acaso? Qui-quadrado de homogeneidade
   entre as coortes semanais com n >= 30.
2. Semana escolhida: a maior variação contra a média das 4 semanas anteriores
   (base mais estável que 1 semana de ~45 pessoas), com teste de duas proporções.
3. Decomposição de Kitagawa: Δ retorno = mix (mudou o perfil de quem chegou)
   + taxa (mudou o retorno dentro de cada perfil).

Rodar: python -m analise.semana
"""

import sys

import pandas as pd
from scipy.stats import chi2_contingency
from statsmodels.stats.proportion import (
    confint_proportions_2indep,
    test_proportions_2indep,
)

TABELA = "data/tmp/usuarios.parquet"
N_MIN = 30
CHEGADA_FRACA = {"saudacao_teste", "imagem_midia", "burlar_regras"}


def coortes(t: pd.DataFrame) -> pd.DataFrame:
    c = t.groupby("semana")["retornou"].agg(n="size", voltaram="sum").reset_index()
    c["retorno_pct"] = 100 * c["voltaram"] / c["n"]
    return c


def homogeneidade(c: pd.DataFrame) -> dict[str, float]:
    x = c[c["n"] >= N_MIN]
    tab = pd.DataFrame({"sim": x["voltaram"], "nao": x["n"] - x["voltaram"]})
    chi2, p, gl, _ = chi2_contingency(tab)
    return {"semanas": len(x), "chi2": chi2, "gl": gl, "p": p}


def candidatas(c: pd.DataFrame) -> pd.DataFrame:
    linhas = []
    for i in range(4, len(c)):
        alvo, base = c.iloc[i], c.iloc[i - 4 : i]
        if alvo["n"] < N_MIN:
            continue
        kb, nb = base["voltaram"].sum(), base["n"].sum()
        _, p = test_proportions_2indep(
            alvo["voltaram"], alvo["n"], kb, nb, method="wald"
        )
        lo, hi = confint_proportions_2indep(
            alvo["voltaram"], alvo["n"], kb, nb, method="newcomb"
        )
        linhas.append(
            {
                "semana": alvo["semana"],
                "n": int(alvo["n"]),
                "retorno_pct": alvo["retorno_pct"],
                "base_4sem_pct": 100 * kb / nb,
                "dif_pp": alvo["retorno_pct"] - 100 * kb / nb,
                "lo": 100 * lo,
                "hi": 100 * hi,
                "p": p,
            }
        )
    return pd.DataFrame(linhas)


def kitagawa(antes: pd.DataFrame, depois: pd.DataFrame, segmento: str) -> pd.DataFrame:
    """Δ = Σ (w2 - w1)(r1 + r2)/2  [mix]  +  Σ (r2 - r1)(w1 + w2)/2  [taxa]."""

    def perfil(x: pd.DataFrame) -> pd.DataFrame:
        g = x.groupby(segmento)["retornou"].agg(n="size", r="mean")
        return g.assign(w=g["n"] / g["n"].sum())

    a, d = perfil(antes), perfil(depois)
    j = a.join(d, lsuffix="_1", rsuffix="_2", how="outer").fillna(
        {"n_1": 0, "n_2": 0, "w_1": 0, "w_2": 0}
    )
    j["r_1"] = j["r_1"].fillna(j["r_2"])
    j["r_2"] = j["r_2"].fillna(j["r_1"])
    j["mix_pp"] = 100 * (j["w_2"] - j["w_1"]) * (j["r_1"] + j["r_2"]) / 2
    j["taxa_pp"] = 100 * (j["r_2"] - j["r_1"]) * (j["w_1"] + j["w_2"]) / 2
    return j


def main(semana: str | None = None) -> None:
    t = pd.read_parquet(TABELA)
    t["semana"] = pd.to_datetime(t["semana"])
    t["chegada"] = t["tema"].map(
        lambda x: "só testa / pede imagem / burla"
        if x in CHEGADA_FRACA
        else "pedido real"
    )
    c = coortes(t).sort_values("semana").reset_index(drop=True)
    print("Homogeneidade entre semanas (n >= 30):", homogeneidade(c))
    cand = candidatas(c)
    with pd.option_context(
        "display.width", 200, "display.float_format", "{:.1f}".format
    ):
        print("\nMaiores variações contra as 4 semanas anteriores:")
        print(
            cand.reindex(cand["dif_pp"].abs().sort_values(ascending=False).index)
            .head(6)
            .to_string(index=False)
        )
    alvo = (
        pd.Timestamp(semana)
        if semana
        else cand.loc[cand["dif_pp"].abs().idxmax(), "semana"]
    )
    i = c.index[c["semana"] == alvo][0]
    base_semanas = c["semana"].iloc[i - 4 : i]
    antes, depois = t[t["semana"].isin(base_semanas)], t[t["semana"] == alvo]
    print(
        f"\nSemana {str(alvo)[:10]}: {len(depois)} novos, retorno {100 * depois['retornou'].mean():.1f}% "
        f"vs {100 * antes['retornou'].mean():.1f}% nas 4 anteriores ({len(antes)} novos)"
    )
    for seg in ["chegada", "dispositivo", "gpt4"]:
        k = kitagawa(antes, depois, seg)
        print(
            f"\nSegmento {seg}: mix {k['mix_pp'].sum():+.1f} pp · taxa {k['taxa_pp'].sum():+.1f} pp"
        )
        with pd.option_context("display.float_format", "{:.2f}".format):
            print(
                k[
                    ["n_1", "w_1", "r_1", "n_2", "w_2", "r_2", "mix_pp", "taxa_pp"]
                ].to_string()
            )


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else None)
