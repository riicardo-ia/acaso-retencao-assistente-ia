"""Idiomas da tela: toda frase tem inglês e espanhol, com os mesmos valores ({nome}).

A tela usa o português como chave (T("texto")); se alguém escrever uma frase nova e
esquecer a tradução, este teste diz qual é.
"""

import json
import re
from pathlib import Path

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
