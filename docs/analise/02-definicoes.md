# Passo 2 · Definições e sensibilidade do retorno em 7 dias

**Reprodução:** `python -m analise.sensibilidade` · definições em `analise/definicoes.py`, travadas por `tests/test_definicoes.py`.

## Revisão 1: retorno por dia de calendário

Na revisão dos passos, o texto do PDF §2.3 ("em que fuso horário **conta um dia**") mostrou que o retorno deve ser medido em **dias de calendário**: na regra por sessão o fuso não mudava nada. Além disso, 78% dos "retornos" por sessão aconteciam nas primeiras 24 h, em boa parte a mesma pessoa voltando horas depois no mesmo dia. A referência passou a ser **uso em outro dia local (D+1 a D+7)**, e a regra por sessão virou sensibilidade ([BDR-001](../bdr/BDR-001-definicoes-de-uso-e-retorno.md), rev. 1).

## Definições de referência

| Conceito | Definição | Origem da escolha |
|---|---|---|
| Usuário | `hashed_ip` | Não há ID de usuário (PDF §2.1) |
| Evento de uso | cada **resposta do assistente** (horário da mensagem) | Só o assistente tem horário (Q1); captura quem volta a uma conversa antiga (Q3) |
| Primeira experiência | todo o uso no **1º dia local** (`America/Sao_Paulo`) | Coerente com o retorno por dia |
| Retorno em 7 dias | algum uso em **outro dia local, de D+1 a D+7** | "Voltar a usar" = voltar outro dia; PDF §2.3 |
| Coorte | semana (segunda a domingo) do 1º dia, no fuso local | — |
| Elegível | 1º dia ≥ 14 dias após o começo da base e ≥ 8 dias antes do fim | Evita falso "novo" e falso "não voltou" |

## Sensibilidade (cada linha troca UMA escolha)

| Cenário | Usuários | Voltaram | Retorno | IC 95% | Δ vs. referência |
|---|---:|---:|---:|---|---:|
| **Referência: outro dia local, D+1 a D+7** | 2.266 | 416 | **18,4%** | 16,8–20,0 | — |
| Regra anterior: nova sessão (pausa > 30 min) até 7 × 24 h | 2.266 | 637 | 28,1% | 26,3–30,0 | **+9,7 pp** |
| └ sessão com pausa de 15 min | 2.266 | 757 | 33,4% | 31,5–35,4 | +15,0 pp |
| └ sessão com pausa de 60 min | 2.266 | 558 | 24,6% | 22,9–26,4 | +6,2 pp |
| Usuário = IP + user-agent | 2.747 | 554 | 20,2% | 18,7–21,7 | +1,8 pp |
| Usuário = IPs unidos pela conversa (Q6) | 2.197 | 397 | 18,1% | 16,5–19,7 | −0,3 pp |
| Uso = só início de conversa | 2.266 | 387 | 17,1% | 15,6–18,7 | −1,3 pp |
| Janela de 3 dias | 2.292 | 363 | 15,8% | 14,4–17,4 | −2,6 pp |
| Janela de 14 dias | 2.212 | 439 | 19,8% | 18,2–21,6 | +1,4 pp |
| Sem corte das 2 primeiras semanas | 2.330 | 435 | 18,7% | 17,1–20,3 | +0,3 pp |
| Sem corte do fim | 2.311 | 423 | 18,3% | 16,8–19,9 | −0,1 pp |
| Sem IPs anômalos (≥ 10 user-agents) | 2.264 | 414 | 18,3% | 16,7–19,9 | −0,1 pp |
| Dia contado em UTC | 2.266 | 445 | 19,6% | 18,1–21,3 | +1,2 pp |

## Leitura

- **O que conta como "voltar" é a escolha que mais move o número**: 18,4% (outro dia) contra 28,1% (nova sessão no mesmo dia já conta). A tela mostra a definição e essa faixa.
- **O fuso agora importa** (+1,2 pp em UTC): quem usa perto da meia-noite muda de dia.
- **A definição de usuário move pouco** (−0,3 a +1,8 pp). Somar o user-agent *aumenta* o retorno porque divide IPs compartilhados em vários "usuários" muito ativos.
- **Cortes de censura e IPs anômalos quase não mexem no total.**
- **Coortes semanais são pequenas:** 16 de 53 semanas têm menos de 30 novos usuários; o desvio-padrão entre semanas (6,1 pp) é próximo do que o acaso produz com ~43 pessoas por semana (≈ 5,9 pp). Isso condiciona o Passo 6.

## Decisão

Referência original aprovada e depois revista (**revisão 1**: retorno por dia de calendário) → [`BDR-001`](../bdr/BDR-001-definicoes-de-uso-e-retorno.md).
