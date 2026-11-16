"""Regras de derivação das variáveis da 1ª experiência."""

import pandas as pd

from analise.variaveis import (
    dispositivo,
    faixa_horaria,
    grupo_idioma,
    periodo_oferta,
    primeira_experiencia,
    tem_recusa,
)


def test_recusa_ou_limitacao_em_pt_e_en() -> None:
    assert tem_recusa("Desculpe, mas não posso ajudar com isso.")
    assert tem_recusa("Como uma IA, não tenho a capacidade de gerar imagens.")
    assert tem_recusa("I'm sorry, but I can't assist with that.")
    assert tem_recusa("As an AI language model, I don't have opinions.")
    assert not tem_recusa("Claro! Aqui está o código que você pediu.")
    assert not tem_recusa(None)


def test_dispositivo_pelo_user_agent() -> None:
    assert dispositivo("Mozilla/5.0 (Linux; Android 13) Mobile Safari") == "celular"
    assert dispositivo("Mozilla/5.0 (iPhone; CPU iPhone OS 16_0)") == "celular"
    assert dispositivo("Mozilla/5.0 (Windows NT 10.0; Win64; x64)") == "computador"


def test_grupo_idioma() -> None:
    assert grupo_idioma("Portuguese") == "português"
    assert grupo_idioma("English") == "inglês"
    assert grupo_idioma("Maori") == "outro"


def test_faixa_horaria() -> None:
    assert [faixa_horaria(h) for h in (3, 9, 15, 21)] == [
        "madrugada",
        "manhã",
        "tarde",
        "noite",
    ]


def test_periodo_de_oferta_do_gpt4() -> None:
    assert periodo_oferta(pd.Timestamp("2023-05-10")) == "1 abr–jun/23 (GPT-4 opcional)"
    assert periodo_oferta(pd.Timestamp("2023-08-10")) == "2 jul–out/23 (sem GPT-4)"
    assert periodo_oferta(pd.Timestamp("2023-11-10")) == "3 nov/23 (GPT-4 opcional)"
    assert (
        periodo_oferta(pd.Timestamp("2024-02-10")) == "4 dez/23–abr/24 (GPT-4 maioria)"
    )


def test_primeira_experiencia_usa_so_conversas_da_1a_sessao() -> None:
    t0 = pd.Timestamp("2023-06-01 12:00", tz="UTC")
    usuarios = pd.DataFrame(
        {
            "usuario": ["a"],
            "inicio": [t0],
            "fim_exp1": [t0 + pd.Timedelta(minutes=20)],
        }
    )
    conv = pd.DataFrame(
        {
            "conv_id": [1, 2, 3],
            "usuario": ["a", "a", "a"],
            "ts_inicio": [t0, t0 + pd.Timedelta(minutes=10), t0 + pd.Timedelta(days=2)],
            "model": ["gpt-4-0314", "gpt-3.5-turbo-0301", "gpt-3.5-turbo-0301"],
            "turn": [2, 3, 9],
            "recusa": [False, True, False],
            "recusa_1a_resposta": [False, True, False],
            "language": ["Portuguese", "Portuguese", "English"],
            "ua": ["Windows", "Windows", "Windows"],
            "redacted": [False, False, False],
            "tam_msg1": [40, 10, 5],
            "tam_resposta_media": [800.0, 200.0, 50.0],
            "msg_vazia": [False, False, False],
        }
    )
    r = primeira_experiencia(usuarios, conv).iloc[0]
    assert r["gpt4"]  # modelo da 1ª conversa
    assert r["turnos_exp1"] == 5  # 2 + 3, sem a conversa de 2 dias depois
    assert r["conversas_exp1"] == 2
    assert r["recusa"]  # alguma recusa no 1º dia
    assert not r["recusa_1a"]  # a 1ª resposta da 1ª conversa não recusou
    assert r["idioma"] == "português"
