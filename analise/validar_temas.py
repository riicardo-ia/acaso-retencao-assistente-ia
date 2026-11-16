"""Passo 5c: validação estatística da classificação de temas.

Classificador final: gpt-5.4 (escolhido depois da revisão manual das discordâncias).
1. Estabilidade: gpt-5.4 x gpt-5.4 em duas execuções independentes (amostra de 600).
2. Concordância entre modelos: gpt-5.4 x gpt-5.4-nano nas 11.621 conversas
   (kappa de Cohen, IC 95% por bootstrap). H0: kappa <= 0,6.
3. Revisão humana por padrão: nos 3 padrões que somam 38 das 111 discordâncias da
   amostra, a revisão manual deu razão ao gpt-5.4 (registrado em docs/analise/05-temas.md).
4. Validade de construto: associações previstas ANTES de olhar o resultado
   (qui-quadrado 2x2). H0: não há associação.

Rodar: python -m analise.validar_temas
"""

import numpy as np
import pandas as pd
from scipy.stats import chi2_contingency
from sklearn.metrics import cohen_kappa_score

from analise.variaveis import conversas_detalhadas, grupo_idioma

FINAL, REPETICAO, NANO = (
    "data/seed/temas.csv",
    "data/seed/validacao/temas_gpt54_repeticao.csv",
    "data/seed/validacao/temas_gpt54_nano.csv",
)
KAPPA_H0 = 0.6

# hipóteses registradas antes de rodar: (tema, variável, direção esperada)
HIPOTESES = [
    ("imagem_midia", "recusa", "mais recusa ou limitação declarada"),
    ("burlar_regras", "recusa", "mais recusa ou limitação declarada"),
    ("programacao", "ingles", "mais conversas em inglês"),
    ("saudacao_teste", "msg_curta", "mais 1ª mensagem com < 10 caracteres"),
    (
        "reescrita",
        "msg_longa",
        "mais 1ª mensagem com >= 500 caracteres (o texto vem pronto)",
    ),
]


def confiabilidade(a: pd.Series, b: pd.Series, n_boot: int = 2000) -> dict[str, float]:
    kappa = cohen_kappa_score(a, b)
    rng = np.random.default_rng(2026)
    idx = np.arange(len(a))
    boot = [
        cohen_kappa_score(a.iloc[s], b.iloc[s])
        for s in (rng.choice(idx, len(idx)) for _ in range(n_boot))
    ]
    lo, hi = np.percentile(boot, [2.5, 97.5])
    return {
        "n": len(a),
        "kappa": kappa,
        "ic_lo": lo,
        "ic_hi": hi,
        "p_h0": float(np.mean(np.array(boot) <= KAPPA_H0)),
    }


def construto(conv: pd.DataFrame) -> pd.DataFrame:
    linhas = []
    for tema, var, esperado in HIPOTESES:
        no_tema = conv["tema"] == tema
        tab = pd.crosstab(no_tema, conv[var])
        chi2, p, _, _ = chi2_contingency(tab)
        taxa_tema, taxa_resto = (
            conv.loc[no_tema, var].mean(),
            conv.loc[~no_tema, var].mean(),
        )
        linhas.append(
            {
                "tema": tema,
                "esperado": esperado,
                "n_tema": int(no_tema.sum()),
                "% no tema": round(100 * taxa_tema, 1),
                "% no resto": round(100 * taxa_resto, 1),
                "p": p,
                "confirma": bool(p < 0.05 and taxa_tema > taxa_resto),
            }
        )
    return pd.DataFrame(linhas)


def main() -> None:
    final, rep, nano = pd.read_csv(FINAL), pd.read_csv(REPETICAO), pd.read_csv(NANO)
    par = rep.merge(final, on="conv_id", suffixes=("_rep", "_final"))
    print(
        "ESTABILIDADE (gpt-5.4 x gpt-5.4, 2 execuções):",
        confiabilidade(par["tema_final"], par["tema_rep"]),
    )
    entre = final.merge(nano, on="conv_id", suffixes=("_final", "_nano"))
    print(
        "CONCORDÂNCIA gpt-5.4 x nano (todas):",
        confiabilidade(entre["tema_final"], entre["tema_nano"], n_boot=300),
    )
    av = par[(par["insatisfacao_rep"] != "nao_avaliavel")]
    print(
        "INSATISFAÇÃO, estabilidade gpt-5.4:",
        confiabilidade(av["insatisfacao_final"], av["insatisfacao_rep"]),
    )
    conv = conversas_detalhadas().merge(final[["conv_id", "tema"]], on="conv_id")
    conv = conv.assign(
        ingles=conv["language"].map(grupo_idioma) == "inglês",
        msg_curta=conv["tam_msg1"] < 10,
        msg_longa=conv["tam_msg1"] >= 500,
    )
    print("\nVALIDADE DE CONSTRUTO (todas as 11.621 conversas):")
    print(construto(conv).to_string(index=False))
    print("\nDistribuição final:", final["tema"].value_counts().to_dict())


if __name__ == "__main__":
    main()
