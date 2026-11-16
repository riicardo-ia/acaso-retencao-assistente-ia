# Passo 3 · Variáveis da 1ª experiência

**Unidade:** uma linha por usuário elegível (2.266; BDR-001 rev. 1). A 1ª experiência é o **1º dia local de uso**: só entram as conversas que começam nele. A **1ª conversa** é a que começa primeiro (horário da 1ª resposta, Q1); empate: menor `conv_id`.
**Reprodução:** `python -m analise.tabela` → `data/tmp/usuarios.parquet` · regras em `analise/variaveis.py`, testadas em `tests/test_variaveis.py`.

> Os números de "retorno bruto" abaixo (retorno em outro dia, D+1 a D+7; média 18,4%) são **só descritivos**, para conferir volume e distribuição. Nenhum efeito é afirmado aqui: o efeito ajustado, com incerteza e controle de confusão, é o Passo 6.

## Dicionário

| Variável | Como é derivada | Valores: n (retorno bruto) | Observação |
|---|---|---|---|
| `gpt4` | `model` da **1ª conversa** começa com `gpt-4` | sim 961 (18,7%) · não 1.305 (18,1%) | Oferta muda com a época (Q11) → sempre com `periodo` |
| `tema` | tema da **1ª conversa** (classificação fechada com gpt-5.4, Passo 5) | 11 temas; de saudação/teste 330 (6,4%) e imagem/mídia 99 (6,1%) a marketing 330 (26,4%) e reescrita 120 (26,7%) | Temas com n < 30 viram "outro" no modelo |
| `varios_temas` | a 1ª experiência tem conversas de mais de um tema | sim 288 (29,9%) · não 1.978 (16,7%) | Atenção: Engajamento (exige mais de uma conversa no 1º dia) |
| `idioma` | `language` da 1ª conversa em 3 grupos | português 1.547 (18,4%) · inglês 445 (21,6%) · outro 274 (13,1%) | "Outro" mistura idioma real e detecção falha em mensagem curta (Q8) |
| `dispositivo` | user-agent contém mobile/android/iphone/ipad | computador 1.543 (20,6%) · celular 723 (13,6%) | — |
| `recusa_1a` | **a 1ª resposta** da 1ª conversa tem recusa ou limitação declarada (regex PT/EN nos primeiros 400 caracteres) | sim 93 (14,0%) · não 2.173 (18,6%) | Medida na 1ª resposta, antes de qualquer engajamento. "Alguma recusa no 1º dia" foi descartada: sobe com o nº de respostas (quem conversa mais recebe mais recusas) e criava um efeito positivo falso |
| `msg_curta` | 1ª mensagem com < 10 caracteres | sim 461 (12,1%) · não 1.805 (19,9%) | Sinal de **intenção** ao chegar → confundidor |
| `tam_msg1` | caracteres da 1ª mensagem | p25 18 · p50 58 · p75 186 · p90 920 | Assimétrica → log no modelo |
| `tam_resposta_media` | média de caracteres das respostas do 1º dia | p25 448 · p50 1.202 · p75 1.990 · p90 2.903 | Proxy de "tamanho da resposta" |
| `turnos_exp1` | soma de `turn` das conversas do 1º dia | p25 1 · p50 2 · p75 5 · p90 9 | Atenção: **Mediador / engajamento** |
| `conversas_exp1` | conversas abertas no 1º dia | p50 1 · p75 2 · p90 3 | Atenção: Mesmo cuidado de `turnos_exp1` |
| `faixa_horaria` | hora local do início | madrugada 239 (12,6%) · manhã 525 (17,0%) · tarde 754 (16,7%) · noite 748 (22,9%) | Atenção: Com retorno por dia de calendário, quem começa à noite está a poucas horas de D+1 (continuar depois da meia-noite já conta como "outro dia"): **efeito mecânico da definição**, controlado no modelo |
| `fim_de_semana` | sábado ou domingo no horário local | sim 577 (18,0%) · não 1.689 (18,5%) | — |
| `periodo` | regime de oferta do GPT-4 (Q11) | abr–jun/23 666 (18,2%) · jul–out/23 590 (18,8%) · nov/23 227 (17,6%) · dez/23–abr/24 783 (18,4%) | **Controle**, não fator de produto |
| `insatisfacao` | sinal de insatisfação na 1ª conversa, escolhido pelo LLM | avaliável em 1.149 (quem mandou > 1 mensagem): insatisfeito 342 | Subanálise no Passo 6 (só existe com 2ª mensagem); estável com gpt-5.4 (κ = 0,93) |
| `redacted` | alguma conversa do 1º dia com dado pessoal anonimizado | sim **17** | n < 30: fora do modelo |

## Fora da análise

- `toxic`: sempre falso na base pública (Q10).
- `state`: o 3º estado (Piauí) é quase todo um único IP (Q7); usar estado geraria conclusão falsa.
