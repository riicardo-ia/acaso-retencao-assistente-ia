# BDR-001 · Definições de usuário, uso, sessão e retorno em 7 dias

**Decidido por:** Ricardo · **Status:** aprovado · **Revisão 1:** retorno por dia de calendário
**Evidência:** `docs/analise/01-qualidade.md`, `docs/analise/02-definicoes.md` (sensibilidade) · **Código:** `analise/definicoes.py` + `tests/test_definicoes.py`

## Contexto

A base não tem identificador de usuário (PDF §2.1) e o PDF deixa em aberto o que conta como uso, como agrupar em sessões, o fuso e o período (§2.3). As dúvidas ao cliente fecharam na quarta-feira; estas são **premissas assumidas sem resposta do cliente**.

## Decisões

| Conceito | Opções consideradas | Escolha | Se a premissa estiver errada |
|---|---|---|---|
| Usuário | `hashed_ip` · IP + user-agent · IPs unidos pela conversa | **`hashed_ip`**: simples e igual à chave do relatório do time de dados | IP + user-agent: 20,2% (+1,8 pp); IPs unidos: 18,1% (−0,3 pp) |
| Evento de uso | início de conversa · cada resposta do assistente | **Cada resposta** (Q1, Q3) | Só início de conversa: 17,1% (−1,3 pp) |
| O que é "voltar" | nova sessão (pausa > 15/30/60 min) · uso em outro dia de calendário | **Rev. 1: uso em outro dia local, D+1 a D+7.** O PDF fala em "em que fuso horário conta um dia"; 78% dos retornos por sessão eram horas depois, no mesmo dia | Nova sessão > 30 min: 28,1% (+9,7 pp). É **a premissa mais sensível** e aparece na tela |
| Primeira experiência | 1ª conversa · 1ª sessão · 1º dia | **Rev. 1: 1º dia local** (coerente com o retorno) | — |
| Janela | 3 · 7 · 14 dias | **7 dias** (pergunta do PDF) | 3 dias: 15,8%; 14 dias: 19,8% |
| Período e censura | base inteira · cortes nas pontas | **Base inteira com cortes**: excluídos os primeiros 14 dias (falso "novo") e quem começou a < 8 dias do fim (janela incompleta) | Sem cortes: 18,3–18,7% (≤ 0,3 pp) |
| IPs anômalos | excluir · manter marcados | **Manter**, marcados (≥ 10 user-agents) | Excluir: 18,3% (−0,1 pp) |
| Fuso do dia | UTC · `America/Sao_Paulo` | **`America/Sao_Paulo`** | UTC: 19,6% (+1,2 pp) |

## Consequências

- Retorno em 7 dias de referência: **18,4% (IC 95%: 16,8–20,0)**, 2.266 usuários elegíveis.
- Toda tela mostra a definição de "voltar" e a faixa de sensibilidade (18,4% por dia × 28,1% por sessão).
- O retorno medido é um **limite inferior**: a base pública exclui as conversas tóxicas (Q10), então quem voltou com uma delas não aparece.
- Mudar qualquer regra quebra `tests/test_definicoes.py`: a mudança precisa ser deliberada e registrada aqui.
