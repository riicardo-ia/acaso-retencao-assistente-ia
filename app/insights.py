"""Frases automáticas da tela Explorar, por regra (sem LLM).

Travas: com menos de N_MIN pessoas não há conclusão; uma diferença só é chamada de
"confirmada" se passar no teste de duas proporções com 99% de confiança (mais exigente
que 95%, porque quem explora faz muitas comparações). Tudo é comparação simples: o
efeito "comparando pessoas parecidas" fica na tela Análise completa.
"""

from math import sqrt
from typing import Any

N_MIN = 30
Z_99 = 2.576

NOMES = {
    "idioma": "idioma",
    "dispositivo": "dispositivo",
    "tema": "tema da 1ª conversa",
    "modelo": "modelo",
}


ROTULOS = {
    "estudo": "estudo e trabalho acadêmico",
    "programacao": "programação e tecnologia",
    "reescrita": "reescrita, resumo e tradução",
    "marketing": "marketing e conteúdo profissional",
    "ficcao": "ficção, roleplay e criação",
    "conhecimento": "conhecimento geral e curiosidades",
    "vida_pratica": "vida prática e conselhos",
    "imagem_midia": "pedido de imagem, vídeo ou áudio",
    "burlar_regras": "tentativa de burlar regras",
    "saudacao_teste": "só cumprimenta ou testa o assistente",
    "outro": "outro tema",
}


def rotulo(categoria: str) -> str:
    return ROTULOS.get(categoria, categoria)


def pct(x: float) -> str:
    return f"{100 * x:.1f}%".replace(".", ",")


def diferente(k1: int, n1: int, k2: int, n2: int, z: float = Z_99) -> bool:
    """Teste de duas proporções (z, variância combinada). True se a diferença é confirmada."""
    if min(n1, n2) < N_MIN:
        return False
    p = (k1 + k2) / (n1 + n2)
    erro = sqrt(p * (1 - p) * (1 / n1 + 1 / n2))
    return erro > 0 and abs(k1 / n1 - k2 / n2) / erro > z


def resumo(recorte: dict[str, int], base: dict[str, int], filtrado: bool) -> str:
    n, k = recorte["n"], recorte["voltaram"]
    if n < N_MIN:
        return (
            f"Menos de {N_MIN} pessoas neste recorte: é pouco para tirar conclusão. "
            "Amplie o período ou retire algum filtro."
        )
    frase = f"Neste recorte, {pct(k / n)} das {n:_} pessoas voltaram em até 7 dias.".replace(
        "_", "."
    )
    if not filtrado:
        return frase
    nr, kr = base["n"] - n, base["voltaram"] - k
    if nr < N_MIN:
        return frase
    comparacao = "mais" if k / n > kr / nr else "menos"
    if diferente(k, n, kr, nr):
        return (
            frase
            + f" É {comparacao} do que no restante da base ({pct(kr / nr)}), e a diferença é confirmada."
        )
    return (
        frase + f" No restante da base são {pct(kr / nr)}: a diferença pode ser acaso."
    )


def destaques(
    grupos: dict[str, list[dict[str, Any]]], filtros: dict[str, str]
) -> list[str]:
    """Para cada dimensão não filtrada, o grupo que volta mais ou menos que o resto do recorte."""
    frases = []
    for dim, linhas in grupos.items():
        if filtros.get(dim):
            continue
        n_total = sum(linha["n"] for linha in linhas)
        k_total = sum(linha["voltaram"] for linha in linhas)
        confirmados = []
        for linha in linhas:
            n, k = linha["n"], linha["voltaram"]
            if diferente(k, n, k_total - k, n_total - n):
                confirmados.append(
                    (
                        k / n - (k_total - k) / (n_total - n),
                        linha,
                        k / n,
                        (k_total - k) / (n_total - n),
                    )
                )
        if confirmados:
            dif, linha, taxa, resto = max(confirmados, key=lambda c: abs(c[0]))
            rumo = "mais" if dif > 0 else "menos"
            frases.append(
                f"Por {NOMES[dim]}: o grupo “{linha['rotulo']}” volta {rumo} ({pct(taxa)} contra {pct(resto)} dos demais)."
            )
    if not frases:
        frases.append("Nenhum grupo se destaca de forma confirmada neste recorte.")
    return frases
