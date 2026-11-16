"""Passo 5a: descoberta de temas candidatos, sem LLM (TF-IDF + k-means).

Agrupa as CONVERSAS INTEIRAS (mensagens do usuário, ver `texto_da_conversa`) e mostra, por
grupo, os termos mais característicos e exemplos curtos. A lista final de temas é
revisada manualmente; o LLM depois só escolhe entre as opções fechadas.
Rodar: python -m analise.temas_descoberta [k]
"""

import re
import sys

import pandas as pd
from sklearn.cluster import KMeans
from sklearn.feature_extraction.text import TfidfVectorizer

import duckdb

PARADAS = (
    "a o as os de da do das dos e é em um uma uns umas para por com sem que se no na nos nas ao à "
    "me eu você voce meu minha seu sua isso esse essa este esta como mais mas ou ser ter tem foi "
    "the of and to in is it for on with as be this that you your i me my an are can what how please "
    "não nao sim muito pode poder fazer faça faca quero preciso sobre qual quais quando onde"
).split()


MAX_MSGS, MAX_CHARS = 5, 2000


def texto_da_conversa(bruto: str = "data/raw/wildchat_brazil.parquet") -> pd.DataFrame:
    """Uma linha por conversa: as `MAX_MSGS` primeiras mensagens do usuário, unidas por " | ",
    cortadas em `MAX_CHARS` caracteres. As respostas do assistente não entram: o assunto
    vem de quem pergunta."""
    con = duckdb.connect()
    return con.execute(
        f"""
        SELECT b.conversation[1].turn_identifier AS conv_id,
               left(array_to_string(
                   [coalesce(x.content, '') FOR x IN b.conversation IF x.role = 'user'][1:{MAX_MSGS}],
                   ' | '), {MAX_CHARS}) AS texto
        FROM '{bruto}' b
        """
    ).df()


def agrupar(msgs: pd.DataFrame, k: int) -> pd.DataFrame:
    texto = msgs["texto"].fillna("").str.lower().map(lambda s: re.sub(r"\s+", " ", s))
    longas = msgs[texto.str.strip().str.len() >= 10].copy()
    vet = TfidfVectorizer(
        stop_words=PARADAS, ngram_range=(1, 2), min_df=4, max_df=0.4, sublinear_tf=True
    )
    x = vet.fit_transform(texto[longas.index])
    km = KMeans(n_clusters=k, n_init=10, random_state=7).fit(x)
    longas["grupo"] = km.labels_
    termos = vet.get_feature_names_out()
    for g in range(k):
        centro = km.cluster_centers_[g].argsort()[::-1][:10]
        membros = longas[longas["grupo"] == g]
        print(f"\n## grupo {g} (n={len(membros)})")
        print("termos:", ", ".join(termos[i] for i in centro))
        for m in membros["texto"].sample(min(4, len(membros)), random_state=1):
            print("  -", re.sub(r"\s+", " ", str(m))[:110])
    return longas


if __name__ == "__main__":
    agrupar(texto_da_conversa(), int(sys.argv[1]) if len(sys.argv) > 1 else 14)
