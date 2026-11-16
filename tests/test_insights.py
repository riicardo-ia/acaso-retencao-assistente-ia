"""Regras das frases automáticas: nunca afirmam o que os dados não sustentam."""

from app.insights import destaques, diferente, resumo

BASE = {"n": 2266, "voltaram": 416}


def test_recorte_pequeno_nao_conclui() -> None:
    frase = resumo({"n": 18, "voltaram": 1}, BASE, filtrado=True)
    assert "pouco para tirar conclusão" in frase and "%" not in frase
    assert "18" not in frase  # a frase não revela o tamanho do grupo pequeno


def test_sem_filtro_so_descreve() -> None:
    assert (
        resumo(BASE, BASE, filtrado=False)
        == "Neste recorte, 18,4% das 2.266 pessoas voltaram em até 7 dias."
    )


def test_diferenca_grande_e_confirmada() -> None:
    frase = resumo({"n": 330, "voltaram": 21}, BASE, filtrado=True)
    assert "menos do que no restante" in frase and "confirmada" in frase


def test_diferenca_pequena_pode_ser_acaso() -> None:
    frase = resumo({"n": 445, "voltaram": 90}, BASE, filtrado=True)
    assert "pode ser acaso" in frase


def test_teste_exige_amostra_minima() -> None:
    assert not diferente(0, 10, 400, 2000)


def test_destaque_so_com_diferenca_confirmada() -> None:
    grupos = {
        "dispositivo": [
            {"categoria": "celular", "rotulo": "celular", "n": 723, "voltaram": 98},
            {
                "categoria": "computador",
                "rotulo": "computador",
                "n": 1543,
                "voltaram": 318,
            },
        ],
        "idioma": [
            {
                "categoria": "português",
                "rotulo": "português",
                "n": 1000,
                "voltaram": 180,
            },
            {"categoria": "inglês", "rotulo": "inglês", "n": 1000, "voltaram": 185},
        ],
    }
    frases = destaques(grupos, filtros={})
    assert any("dispositivo" in f for f in frases)
    assert not any("idioma" in f for f in frases)


def test_dimensao_filtrada_nao_gera_destaque() -> None:
    grupos = {
        "dispositivo": [
            {"categoria": "celular", "rotulo": "celular", "n": 723, "voltaram": 98}
        ]
    }
    assert destaques(grupos, filtros={"dispositivo": "celular"}) == [
        "Nenhum grupo se destaca de forma confirmada neste recorte."
    ]
