"""Modelo dos efeitos: o efeito ajustado recupera o que foi plantado em dados sintéticos."""

import numpy as np
import pandas as pd

from analise.efeitos import ajustado, diagnostico


def _pessoas(n: int = 4000, efeito_celular: float = -0.10) -> pd.DataFrame:
    rng = np.random.default_rng(7)
    d = pd.DataFrame(
        {
            "tema": rng.choice(["conhecimento", "estudo", "saudacao_teste"], n),
            "recusa_1a": rng.choice(["True", "False"], n),
            "gpt4": rng.choice(["True", "False"], n),
            "resposta_longa": rng.choice(["True", "False"], n),
            "msg_curta": rng.choice(["True", "False"], n),
            "idioma": rng.choice(["português", "inglês"], n),
            "dispositivo": rng.choice(["computador", "celular"], n),
            "faixa_horaria": rng.choice(["tarde", "noite"], n),
            "fim_de_semana": rng.choice(["True", "False"], n),
            "periodo": rng.choice(["a", "b"], n),
        }
    )
    p = 0.25 + efeito_celular * (d["dispositivo"] == "celular")
    d["y"] = (rng.random(n) < p).astype(int)
    return d


def test_efeito_plantado_e_recuperado_com_incerteza() -> None:
    ef = ajustado(_pessoas()).set_index(["fator", "nivel"])
    cel = ef.loc[("dispositivo", "celular")]
    assert cel["ajustado_lo"] < -10 < cel["ajustado_hi"]
    gpt4 = ef.loc[("gpt4", "True")]
    assert gpt4["ajustado_lo"] < 0 < gpt4["ajustado_hi"]  # sem efeito plantado


def test_diagnostico_do_modelo() -> None:
    diag = diagnostico(_pessoas())
    assert diag["n"] == 4000
    assert 0 < diag["pseudo_r2"] < 0.1
