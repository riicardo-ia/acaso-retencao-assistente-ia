"""Tabela de análise: uma linha por usuário elegível, com o retorno e as variáveis da 1ª experiência.

Usa as definições aprovadas no BDR-001. Rodar: python -m analise.tabela
(grava data/tmp/usuarios.parquet).
"""

from pathlib import Path
import pandas as pd

from analise import base
from analise.definicoes import elegiveis, retorno_por_dia
from analise.variaveis import conversas_detalhadas, primeira_experiencia

SAIDA = "data/tmp/usuarios.parquet"


def montar() -> pd.DataFrame:
    ev = base.eventos()
    conv = conversas_detalhadas().rename(columns={"ip": "usuario"})
    temas = pd.read_csv("data/seed/temas.csv")[["conv_id", "tema", "insatisfacao"]]
    conv = conv.merge(temas, on="conv_id", how="left")
    eventos = ev.merge(conv[["conv_id", "usuario"]], on="conv_id")
    usuarios = elegiveis(
        retorno_por_dia(eventos),
        inicio_base=ev["ts"].min(),
        fim_base=ev["ts"].max(),
    )
    tabela = usuarios.merge(
        primeira_experiencia(usuarios, conv), on="usuario", how="left"
    )
    if tabela["gpt4"].isna().any():
        raise ValueError("usuário elegível sem conversa na 1ª sessão")
    return tabela


if __name__ == "__main__":
    t = montar()
    Path(SAIDA).parent.mkdir(parents=True, exist_ok=True)
    t.to_parquet(SAIDA, index=False)
    print(
        f"{len(t)} usuários elegíveis, retorno {100 * t['retornou'].mean():.1f}% -> {SAIDA}"
    )
