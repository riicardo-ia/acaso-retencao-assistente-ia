"""Definições de negócio: sessão, primeira experiência, retorno e elegibilidade da coorte.

Estes testes travam a definição do indicador principal: se alguém mudar a regra de
quem é a pessoa, de sessão ou de janela, um teste quebra.
"""

import pandas as pd

from analise.definicoes import elegiveis, retorno_por_dia, retorno_por_sessao, unir_ips
from etl.carga import pessoas

T0 = pd.Timestamp("2023-06-01 12:00", tz="UTC")


def _eventos(*horas_por_usuario: tuple[str, list[float]]) -> pd.DataFrame:
    linhas = [
        {"usuario": u, "ts": T0 + pd.Timedelta(hours=h)}
        for u, horas in horas_por_usuario
        for h in horas
    ]
    return pd.DataFrame(linhas)


def _retornou(eventos: pd.DataFrame, **kw: int) -> dict[str, bool]:
    r = retorno_por_sessao(eventos, **kw)
    return dict(zip(r["usuario"], r["retornou"]))


def test_uso_unico_nao_e_retorno() -> None:
    assert _retornou(_eventos(("a", [0]))) == {"a": False}


def test_uso_na_mesma_sessao_nao_e_retorno() -> None:
    # 10 min depois: mesma sessão (pausa < 30 min)
    assert _retornou(_eventos(("a", [0, 10 / 60]))) == {"a": False}


def test_nova_sessao_dentro_da_janela_e_retorno() -> None:
    assert _retornou(_eventos(("a", [0, 48]))) == {"a": True}


def test_nova_sessao_fora_da_janela_nao_e_retorno() -> None:
    assert _retornou(_eventos(("a", [0, 8 * 24]))) == {"a": False}


def test_janela_conta_do_inicio_da_primeira_sessao() -> None:
    # sessão longa (eventos a cada 20 min por 3 h) e volta em 6 dias e 23 h após o início
    sessao = [i / 3 for i in range(10)]
    assert _retornou(_eventos(("a", sessao + [6 * 24 + 23]))) == {"a": True}


def test_pausa_de_sessao_e_parametro() -> None:
    eventos = _eventos(("a", [0, 45 / 60]))  # 45 min depois
    assert _retornou(eventos, gap_min=30) == {"a": True}
    assert _retornou(eventos, gap_min=60) == {"a": False}


def test_janela_e_parametro() -> None:
    eventos = _eventos(("a", [0, 4 * 24]))
    assert _retornou(eventos, janela_dias=3) == {"a": False}
    assert _retornou(eventos, janela_dias=7) == {"a": True}


def test_primeira_sessao_e_inicio() -> None:
    r = retorno_por_sessao(_eventos(("a", [0, 0.25, 30])))
    linha = r.iloc[0]
    assert linha["inicio"] == T0
    assert linha["fim_exp1"] == T0 + pd.Timedelta(hours=0.25)


def test_unir_ips_que_aparecem_na_mesma_conversa() -> None:
    ips_por_conversa = pd.Series([["A", "B"], ["B", "C"], ["D"]])
    mapa = unir_ips(ips_por_conversa)
    assert mapa["A"] == mapa["B"] == mapa["C"]
    assert mapa["D"] != mapa["A"]


def test_elegiveis_corta_as_duas_pontas() -> None:
    usuarios = pd.DataFrame(
        {
            "usuario": ["cedo", "meio", "tarde"],
            "inicio": pd.to_datetime(
                ["2023-04-10", "2023-06-01", "2024-04-23"], utc=True
            ),
        }
    )
    r = elegiveis(
        usuarios,
        inicio_base=pd.Timestamp("2023-04-09", tz="UTC"),
        fim_base=pd.Timestamp("2024-04-30", tz="UTC"),
        janela_dias=7,
        aquecimento_dias=14,
    )
    assert list(r["usuario"]) == ["meio"]


def test_semana_da_coorte_no_fuso_local() -> None:
    # domingo 23h em São Paulo = segunda 02h UTC: a semana local é a anterior
    usuarios = pd.DataFrame(
        {"usuario": ["a"], "inicio": [pd.Timestamp("2023-06-12 02:00", tz="UTC")]}
    )
    r = elegiveis(
        usuarios,
        inicio_base=pd.Timestamp("2023-04-09", tz="UTC"),
        fim_base=pd.Timestamp("2024-04-30", tz="UTC"),
        fuso="America/Sao_Paulo",
    )
    assert str(r["semana"].iloc[0]) == "2023-06-05"


# --- referência (BDR-001 rev. 1): retorno em outro dia de calendário local ---

SP = "America/Sao_Paulo"


def _por_dia(*horas_por_usuario: tuple[str, list[float]]) -> dict[str, bool]:
    r = retorno_por_dia(_eventos(*horas_por_usuario))
    return dict(zip(r["usuario"], r["retornou"]))


def test_dia_mesmo_dia_horas_depois_nao_e_retorno() -> None:
    # T0 = 09h em São Paulo; 6 h depois ainda é o mesmo dia local
    assert _por_dia(("a", [0, 6])) == {"a": False}


def test_dia_seguinte_e_retorno_mesmo_com_poucas_horas() -> None:
    # 09h + 16 h = 01h do dia seguinte em São Paulo
    assert _por_dia(("a", [0, 16])) == {"a": True}


def test_dia_d_mais_7_e_retorno_d_mais_8_nao() -> None:
    assert _por_dia(("a", [0, 7 * 24])) == {"a": True}
    assert _por_dia(("b", [0, 8 * 24])) == {"b": False}


def test_dia_depende_do_fuso() -> None:
    # 23h30 em São Paulo e 00h30 do dia seguinte: outro dia local, mas mesmo dia em UTC
    t = pd.Timestamp("2023-06-02 02:30", tz="UTC")
    eventos = pd.DataFrame(
        {"usuario": ["a", "a"], "ts": [t, t + pd.Timedelta(hours=1)]}
    )
    assert bool(retorno_por_dia(eventos, fuso=SP)["retornou"].iloc[0])
    assert not bool(retorno_por_dia(eventos, fuso="UTC")["retornou"].iloc[0])


def test_dia_primeira_experiencia_e_o_primeiro_dia_inteiro() -> None:
    r = retorno_por_dia(_eventos(("a", [0, 5, 30]))).iloc[0]
    assert r["inicio"] == T0
    assert r["fim_exp1"] == T0 + pd.Timedelta(hours=5)
    assert r["dias_ativos"] == 2


def test_mesmo_ip_com_navegadores_diferentes_e_a_mesma_pessoa() -> None:
    """Somar o user-agent à chave dividiria a mesma pessoa em várias (incidente §4.2)."""
    conv = pd.DataFrame(
        {
            "ip": ["ip-a", "ip-a", "ip-a", "ip-b"],
            "ua": ["Chrome 118", "Chrome 119", "Safari iPhone", "Chrome 119"],
        }
    )
    p = pessoas(conv, sal="sal-de-teste")
    assert p.iloc[0] == p.iloc[1] == p.iloc[2]
    assert p.iloc[3] != p.iloc[0]
    assert "ip-a" not in p.iloc[0]  # o pseudônimo não revela o IP
