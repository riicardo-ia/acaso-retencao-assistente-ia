"""Idiomas da tela: toda frase tem inglês e espanhol, com os mesmos valores ({nome}).

A tela usa o português como chave (T("texto")); se alguém escrever uma frase nova e
esquecer a tradução, este teste diz qual é.
"""

import hashlib
import json
import re
from pathlib import Path

import pytest

from app.main import DOCUMENTOS

ESTATICO = Path(__file__).parents[1] / "app" / "static"
TRADUCOES = json.loads((ESTATICO / "i18n.json").read_text())


def _frases_da_tela() -> set[str]:
    js = (ESTATICO / "app.js").read_text()
    frases = {json.loads(f'"{m}"') for m in re.findall(r'\bT\("((?:[^"\\]|\\.)*)"', js)}
    html = (ESTATICO / "index.html").read_text()
    frases |= set(re.findall(r'data-t(?:-aria|-placeholder)?="([^"]+)"', html))
    for grupo, titulo, _ in DOCUMENTOS.values():  # nomes que a API manda para o índice
        frases |= {grupo, titulo}
    return frases


def _valores(texto: str) -> list[str]:
    return sorted(re.findall(r"\{\w+\}", texto))


def test_toda_frase_da_tela_tem_traducao() -> None:
    faltando = sorted(_frases_da_tela() - set(TRADUCOES))
    assert not faltando, f"sem tradução em app/static/i18n.json: {faltando[:5]}"


def test_traducao_sem_frase_orfa() -> None:
    sobrando = sorted(set(TRADUCOES) - _frases_da_tela())
    assert not sobrando, f"tradução de frase que a tela não usa mais: {sobrando[:5]}"


def test_traducao_tem_os_mesmos_valores() -> None:
    for pt, linguas in TRADUCOES.items():
        assert set(linguas) == {"en", "es"}, pt
        for lingua in ("en", "es"):
            assert _valores(linguas[lingua]) == _valores(pt), (pt, lingua)


# Documentos: a tradução existe, guarda a impressão digital do original em português e tem
# a mesma estrutura (títulos e alvos dos links e imagens). Se o português mudar e a tradução
# não, o teste aponta qual arquivo atualizar.

DOCS = Path(__file__).parents[1] / "docs"
ORIGEM = re.compile(r"<!-- traduzido de: ([0-9a-f]{12}) -->")


def _impressao(texto: str) -> str:
    return hashlib.sha256(texto.encode()).hexdigest()[:12]


@pytest.mark.parametrize("lingua", ["en", "es"])
@pytest.mark.parametrize("arquivo", [a for _, _, a in DOCUMENTOS.values()])
def test_documento_traduzido_e_em_dia(lingua: str, arquivo: str) -> None:
    original = (DOCS / arquivo).read_text()
    traducao = DOCS / lingua / arquivo
    assert traducao.exists(), f"falta a tradução {traducao.relative_to(DOCS.parent)}"
    texto = traducao.read_text()
    marca = ORIGEM.search(texto)
    assert marca and marca[1] == _impressao(
        original
    ), f"docs/{arquivo} mudou em português: atualize docs/{lingua}/{arquivo}"
    titulos = re.compile(r"^#{1,3} ", re.M)
    assert len(titulos.findall(texto)) == len(titulos.findall(original))
    alvos = re.compile(r"\]\(([^)]+)\)")
    assert sorted(alvos.findall(texto)) == sorted(alvos.findall(original))
