"""Definições de negócio: usuário, primeira experiência e retorno em N dias (BDR-001).

- Evento de uso: cada resposta do assistente (horário da mensagem; ver
  docs/analise/01-qualidade.md, Q1 e Q3).
- Referência (`retorno_por_dia`, BDR-001 rev. 1): a 1ª experiência é o 1º DIA de uso
  (data local); retorno = algum uso em outro dia local, de D+1 a D+N.
- Sensibilidade (`retorno_por_sessao`): sessão = eventos com pausa < `gap_min`;
  1ª experiência = 1ª sessão; retorno = nova sessão até N x 24 h após o início.

As duas funções devolvem as mesmas colunas: usuario, inicio, fim_exp1, retornou.
"""

import pandas as pd


def retorno_por_sessao(
    eventos: pd.DataFrame, gap_min: int = 30, janela_dias: int = 7
) -> pd.DataFrame:
    """`eventos`: colunas `usuario` e `ts` (com fuso). Uma linha por usuário."""
    e = eventos[["usuario", "ts"]].sort_values(["usuario", "ts"]).reset_index(drop=True)
    pausa = e.groupby("usuario")["ts"].diff()
    e["sessao"] = (
        (pausa.isna() | (pausa > pd.Timedelta(minutes=gap_min)))
        .astype(int)
        .groupby(e["usuario"])
        .cumsum()
    )

    primeira = (
        e[e["sessao"] == 1].groupby("usuario")["ts"].agg(inicio="min", fim_exp1="max")
    )
    depois = e[e["sessao"] > 1].merge(primeira, left_on="usuario", right_index=True)
    na_janela = depois[
        depois["ts"] <= depois["inicio"] + pd.Timedelta(days=janela_dias)
    ]

    r = primeira.reset_index()
    r["retornou"] = r["usuario"].isin(na_janela["usuario"])
    r["n_sessoes"] = r["usuario"].map(e.groupby("usuario")["sessao"].max())
    return r


def retorno_por_dia(
    eventos: pd.DataFrame, janela_dias: int = 7, fuso: str = "America/Sao_Paulo"
) -> pd.DataFrame:
    """1ª experiência = 1º dia local de uso; retorno = uso em D+1 ... D+`janela_dias`."""
    e = eventos[["usuario", "ts"]].copy()
    e["dia"] = e["ts"].dt.tz_convert(fuso).dt.tz_localize(None).dt.normalize()
    dia1 = e.groupby("usuario")["dia"].min().rename("dia1")
    e = e.join(dia1, on="usuario")
    distancia = (e["dia"] - e["dia1"]).dt.days

    primeira = (
        e[distancia == 0].groupby("usuario")["ts"].agg(inicio="min", fim_exp1="max")
    )
    voltou = e.loc[(distancia >= 1) & (distancia <= janela_dias), "usuario"].unique()

    r = primeira.reset_index()
    r["retornou"] = r["usuario"].isin(voltou)
    r["dias_ativos"] = r["usuario"].map(e.groupby("usuario")["dia"].nunique())
    return r


def unir_ips(ips_por_conversa: pd.Series) -> dict[str, str]:
    """IPs que aparecem na mesma conversa pertencem à mesma pessoa (union-find).

    Devolve IP -> identificador do grupo (o menor IP do grupo)."""
    pai: dict[str, str] = {}

    def raiz(x: str) -> str:
        pai.setdefault(x, x)
        while pai[x] != x:
            pai[x] = pai[pai[x]]
            x = pai[x]
        return x

    for ips in ips_por_conversa:
        ips = list(ips)
        for ip in ips:
            raiz(ip)
        for outro in ips[1:]:
            a, b = raiz(ips[0]), raiz(outro)
            if a != b:
                pai[max(a, b)] = min(a, b)
    return {ip: raiz(ip) for ip in pai}


def elegiveis(
    usuarios: pd.DataFrame,
    inicio_base: pd.Timestamp,
    fim_base: pd.Timestamp,
    janela_dias: int = 7,
    aquecimento_dias: int = 14,
    fuso: str = "America/Sao_Paulo",
) -> pd.DataFrame:
    """Corta as duas pontas da base e atribui a semana da coorte no fuso local.

    - Início: quem aparece nos primeiros `aquecimento_dias` pode já ser usuário de
      antes da base existir (falso "novo").
    - Fim: quem começou a menos de `janela_dias` + 1 dia do fim da base não teve a
      janela de retorno inteira (falso "não voltou"); o dia extra cobre o último dia
      de calendário da janela.
    """
    u = usuarios[
        (usuarios["inicio"] >= inicio_base + pd.Timedelta(days=aquecimento_dias))
        & (usuarios["inicio"] + pd.Timedelta(days=janela_dias + 1) <= fim_base)
    ].copy()
    local = u["inicio"].dt.tz_convert(fuso).dt.tz_localize(None)
    u["semana"] = (
        (local - pd.to_timedelta(local.dt.weekday, unit="D")).dt.normalize().dt.date
    )
    return u.reset_index(drop=True)
