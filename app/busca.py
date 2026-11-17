"""Busca nos documentos do dashboard: um índice por seção, montado uma vez e guardado em memória.

Os documentos não mudam enquanto o servidor está no ar; por isso o índice é construído na
primeira busca e reaproveitado. Cada busca só percorre esse índice (sem banco), ignora
acentos e maiúsculas e exige que todas as palavras apareçam na seção.
"""

import re
import unicodedata
from functools import lru_cache
from pathlib import Path

from markdown.extensions.toc import slugify

MAX_RESULTADOS = 8


def normalizar(texto: str) -> str:
    sem_acento = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode()
    return re.sub(r"\s+", " ", sem_acento.lower()).strip()


def _texto_simples(markdown: str) -> str:
    """Tira a marcação para a busca e o trecho exibido (tabelas, código, links, ênfase)."""
    texto = re.sub(r"```.*?```", " ", markdown, flags=re.S)
    texto = re.sub(r"!\[[^\]]*\]\([^)]*\)", " ", texto)
    texto = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", texto)
    texto = re.sub(r"[*_`|#>]", " ", texto)
    return re.sub(r"\s+", " ", texto).strip()


@lru_cache(maxsize=1)
def indice(documentos: tuple[tuple[str, str, Path], ...]) -> list[dict[str, str]]:
    """Uma entrada por seção (título de nível 1 a 3) de cada documento."""
    secoes = []
    for nome, titulo_doc, caminho in documentos:
        # (título, âncora, linhas) de cada seção; a âncora é o mesmo id que o Markdown gera
        partes: list[tuple[str, str, list[str]]] = [(titulo_doc, "", [])]
        for linha in caminho.read_text().splitlines():
            cab = re.match(r"^(#{1,3})\s+(.*)", linha)
            if cab:
                partes.append(
                    (cab[2].strip(), slugify(_texto_simples(cab[2]), "-"), [])
                )
            else:
                partes[-1][2].append(linha)
        for titulo_bruto, ancora, linhas in partes:
            texto = _texto_simples("\n".join(linhas))
            titulo = _texto_simples(titulo_bruto)
            if not texto and not ancora:
                continue
            secoes.append(
                {
                    "documento": nome,
                    "titulo_documento": titulo_doc,
                    "secao": titulo,
                    "ancora": ancora,
                    "texto": texto,
                    "busca_titulo": normalizar(titulo),
                    "busca_texto": normalizar(texto),
                }
            )
    return secoes


def buscar(
    consulta: str, documentos: tuple[tuple[str, str, Path], ...]
) -> list[dict[str, str]]:
    termos = [t for t in normalizar(consulta).split() if len(t) >= 2]
    if not termos:
        return []
    achados = []
    for s in indice(documentos):
        tudo = s["busca_titulo"] + " " + s["busca_texto"]
        if not all(t in tudo for t in termos):
            continue
        nota = sum(
            3 * s["busca_titulo"].count(t) + s["busca_texto"].count(t) for t in termos
        )
        achados.append((nota, s))
    achados.sort(key=lambda a: -a[0])
    return [
        {
            "documento": s["documento"],
            "titulo_documento": s["titulo_documento"],
            "secao": s["secao"],
            "ancora": s["ancora"],
            "trecho": _trecho(s["texto"], termos),
        }
        for _, s in achados[:MAX_RESULTADOS]
    ]


def _trecho(texto: str, termos: list[str], largura: int = 90) -> str:
    """O pedaço do texto em volta da primeira palavra encontrada."""
    alvo = normalizar(texto)
    pos = min((alvo.find(t) for t in termos if alvo.find(t) >= 0), default=0)
    ini = max(0, pos - largura // 2)
    trecho = texto[ini : ini + largura].strip()
    return (
        ("… " if ini > 0 else "")
        + trecho
        + (" …" if ini + largura < len(texto) else "")
    )
