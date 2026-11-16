"""Frases automáticas da tela Explorar, por regra (sem LLM), em português, inglês e espanhol.

Travas: com menos de N_MIN pessoas não há conclusão; uma diferença só é chamada de
"confirmada" se passar no teste de duas proporções com 99% de confiança (mais exigente
que 95%, porque quem explora faz muitas comparações). Tudo é comparação simples: o
efeito "comparando pessoas parecidas" fica na tela A resposta.
"""

from math import sqrt
from typing import Any

N_MIN = 30
Z_99 = 2.576
LINGUAS = ("pt", "en", "es")

NOMES = {
    "pt": {
        "idioma": "idioma",
        "dispositivo": "dispositivo",
        "tema": "tema da 1ª conversa",
        "modelo": "modelo",
    },
    "en": {
        "idioma": "language",
        "dispositivo": "device",
        "tema": "topic of the 1st conversation",
        "modelo": "model",
    },
    "es": {
        "idioma": "idioma",
        "dispositivo": "dispositivo",
        "tema": "tema de la 1.ª conversación",
        "modelo": "modelo",
    },
}

ROTULOS_POR_LINGUA = {
    "pt": {
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
    },
    "en": {
        "estudo": "study and academic work",
        "programacao": "programming and technology",
        "reescrita": "rewriting, summaries and translation",
        "marketing": "marketing and professional content",
        "ficcao": "fiction, roleplay and creative writing",
        "conhecimento": "general knowledge and curiosities",
        "vida_pratica": "everyday life and advice",
        "imagem_midia": "asks for an image, video or audio",
        "burlar_regras": "tries to get around the rules",
        "saudacao_teste": "only greets or tests the assistant",
        "outro": "other topic",
        "português": "Portuguese",
        "inglês": "English",
        "celular": "phone",
        "computador": "computer",
    },
    "es": {
        "estudo": "estudio y trabajo académico",
        "programacao": "programación y tecnología",
        "reescrita": "reescritura, resumen y traducción",
        "marketing": "marketing y contenido profesional",
        "ficcao": "ficción, roleplay y creación",
        "conhecimento": "conocimiento general y curiosidades",
        "vida_pratica": "vida práctica y consejos",
        "imagem_midia": "pide imagen, video o audio",
        "burlar_regras": "intenta saltarse las reglas",
        "saudacao_teste": "solo saluda o prueba el asistente",
        "outro": "otro tema",
        "português": "portugués",
        "inglês": "inglés",
        "celular": "celular",
        "computador": "computadora",
    },
}
ROTULOS = ROTULOS_POR_LINGUA["pt"]

TEXTOS = {
    "pt": {
        "pequeno": "Menos de {n_min} pessoas neste recorte: é pouco para tirar conclusão. Amplie o período ou retire algum filtro.",
        "frase": "Neste recorte, {pct} das {n} pessoas voltaram em até 7 dias.",
        "confirmada": " É {rumo} do que no restante da base ({resto}), e a diferença é confirmada.",
        "acaso": " No restante da base são {resto}: a diferença pode ser acaso.",
        "destaque": "Por {dim}: o grupo “{rotulo}” volta {rumo} ({taxa} contra {resto} dos demais).",
        "nenhum": "Nenhum grupo se destaca de forma confirmada neste recorte.",
        "mais": "mais",
        "menos": "menos",
    },
    "en": {
        "pequeno": "Fewer than {n_min} people in this segment: too few to draw a conclusion. Widen the period or remove a filter.",
        "frase": "In this segment, {pct} of the {n} people came back within 7 days.",
        "confirmada": " That is {rumo} than in the rest of the base ({resto}), and the difference is confirmed.",
        "acaso": " In the rest of the base it is {resto}: the difference may be chance.",
        "destaque": "By {dim}: the group “{rotulo}” comes back {rumo} ({taxa} vs. {resto} for the others).",
        "nenhum": "No group stands out in a confirmed way in this segment.",
        "mais": "more",
        "menos": "less",
    },
    "es": {
        "pequeno": "Menos de {n_min} personas en este recorte: es poco para sacar conclusiones. Amplía el período o quita algún filtro.",
        "frase": "En este recorte, el {pct} de las {n} personas volvió en 7 días o menos.",
        "confirmada": " Es {rumo} que en el resto de la base ({resto}), y la diferencia está confirmada.",
        "acaso": " En el resto de la base es {resto}: la diferencia puede ser azar.",
        "destaque": "Por {dim}: el grupo “{rotulo}” vuelve {rumo} ({taxa} frente a {resto} de los demás).",
        "nenhum": "Ningún grupo se destaca de forma confirmada en este recorte.",
        "mais": "más",
        "menos": "menos",
    },
}


OUTRO_IDIOMA = {"pt": "outro idioma", "en": "other language", "es": "otro idioma"}


def rotulo(categoria: str, lingua: str = "pt", dimensao: str = "") -> str:
    if dimensao == "idioma" and categoria == "outro":
        return OUTRO_IDIOMA[lingua]
    return ROTULOS_POR_LINGUA[lingua].get(
        categoria, ROTULOS_POR_LINGUA["pt"].get(categoria, categoria)
    )


def pct(x: float, lingua: str = "pt") -> str:
    texto = f"{100 * x:.1f}%"
    return texto if lingua == "en" else texto.replace(".", ",")


def inteiro(n: int, lingua: str = "pt") -> str:
    texto = f"{n:,}"
    return texto if lingua == "en" else texto.replace(",", ".")


def diferente(k1: int, n1: int, k2: int, n2: int, z: float = Z_99) -> bool:
    """Teste de duas proporções (z, variância combinada). True se a diferença é confirmada."""
    if min(n1, n2) < N_MIN:
        return False
    p = (k1 + k2) / (n1 + n2)
    erro = sqrt(p * (1 - p) * (1 / n1 + 1 / n2))
    return erro > 0 and abs(k1 / n1 - k2 / n2) / erro > z


def resumo(
    recorte: dict[str, int], base: dict[str, int], filtrado: bool, lingua: str = "pt"
) -> str:
    t = TEXTOS[lingua]
    n, k = recorte["n"], recorte["voltaram"]
    if n < N_MIN:
        return t["pequeno"].format(n_min=N_MIN)
    frase = t["frase"].format(pct=pct(k / n, lingua), n=inteiro(n, lingua))
    if not filtrado:
        return frase
    nr, kr = base["n"] - n, base["voltaram"] - k
    if nr < N_MIN:
        return frase
    rumo = t["mais"] if k / n > kr / nr else t["menos"]
    if diferente(k, n, kr, nr):
        return frase + t["confirmada"].format(rumo=rumo, resto=pct(kr / nr, lingua))
    return frase + t["acaso"].format(resto=pct(kr / nr, lingua))


def destaques(
    grupos: dict[str, list[dict[str, Any]]],
    filtros: dict[str, str],
    lingua: str = "pt",
) -> list[str]:
    """Para cada dimensão não filtrada, o grupo que volta mais ou menos que o resto do recorte."""
    t = TEXTOS[lingua]
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
            frases.append(
                t["destaque"].format(
                    dim=NOMES[lingua][dim],
                    rotulo=linha["rotulo"],
                    rumo=t["mais"] if dif > 0 else t["menos"],
                    taxa=pct(taxa, lingua),
                    resto=pct(resto, lingua),
                )
            )
    if not frases:
        frases.append(t["nenhum"])
    return frases
