"""Partes determinísticas do classificador (o LLM em si é validado no Passo 5c)."""

import pytest
from pydantic import ValidationError

from analise.classificar import (
    INSATISFACAO,
    TEMAS,
    Classificacao,
    insatisfacao_avaliavel,
    instrucoes,
    por_regra,
)


def test_onze_temas_aprovados() -> None:
    assert len(TEMAS) == 11


def test_conversa_sem_texto_vira_saudacao_por_regra() -> None:
    assert por_regra("oi") == {
        "tema": "saudacao_teste",
        "insatisfacao": "nao_avaliavel",
    }
    assert por_regra(" | ") == {
        "tema": "saudacao_teste",
        "insatisfacao": "nao_avaliavel",
    }
    assert por_regra("como faço um loop em python?") is None


def test_insatisfacao_so_com_mais_de_uma_mensagem() -> None:
    assert not insatisfacao_avaliavel("faça uma redação")
    assert insatisfacao_avaliavel("faça uma redação | está errado, refaça")


def test_saida_estruturada_rejeita_rotulo_fora_da_lista() -> None:
    Classificacao(tema="estudo", insatisfacao="nenhum")
    with pytest.raises(ValidationError):
        Classificacao(tema="politica", insatisfacao="nenhum")


def test_instrucoes_listam_todas_as_opcoes() -> None:
    texto = instrucoes()
    assert all(k in texto for k in TEMAS) and all(k in texto for k in INSATISFACAO)
