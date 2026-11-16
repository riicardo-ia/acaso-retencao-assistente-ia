# Passo 5 · Tema das conversas: descoberta, classificação e validação

**Requisitos:** AN-3.1-02 (tema como variável), AN-3.1-03 (como conferiu o resultado da IA), IN-2.2-02/06 (LLM na AWS, troca por configuração).
**Reprodução:** `python -m analise.temas_descoberta` → `python -m analise.classificar` → `python -m analise.validar_temas`.

## Como foi feito (formato híbrido)

1. **Descoberta sem LLM** (`analise/temas_descoberta.py`): agrupamento TF-IDF + k-means das **conversas inteiras** (até 5 mensagens do usuário, 2.000 caracteres) e leitura de amostras aleatórias. A 1ª mensagem sozinha foi descartada como unidade: ela pode ser só um "oi" antes do pedido real.
2. **Lista fechada revisada manualmente:** 11 temas e 4 sinais de insatisfação, cada um com descrição (`analise/classificar.py`).
3. **Classificação:** o LLM lê só as mensagens do usuário e escolhe uma opção de cada lista por **saída estruturada** (não consegue criar categoria). Regra de desempate: vale o **pedido principal**; "saudação/teste" só quando a conversa apenas testa. Sem LLM, por regra: texto do usuário com < 10 caracteres → "saudação/teste"; conversa com 1 só mensagem → insatisfação "não avaliável".
4. **Primeira rodada** com `gpt-5.4-nano` em todas as 11.621 conversas e, de forma independente, com `gpt-5.4` (modelo maior, como revisor) numa amostra aleatória de 600. Os dois discordaram em 111 das 600.
5. **Revisão humana por padrão**: três padrões somam 38 das 111 discordâncias: o nano punha em "conhecimento geral" o que era **ficção** (16: "carreira do Senna *se ainda estivesse vivo*", "Popples *as pokémon*"), **estudo** (15: "o que é prática produtiva", "sobre linfoma") e **vida prática** (7: "diferença entre ovo mexido e frito", "linhas de ônibus"). Na revisão, o gpt-5.4 estava correto nos três e foi mais coerente no geral.
6. **Classificação final com `gpt-5.4`** em todas as 11.621 conversas (0 erros; 4.776 conversas com mais de uma mensagem do usuário). Cada rótulo guarda provedor, modelo e versão do prompt em `data/seed/temas.csv` (sem conteúdo de conversa).

## Validação estatística

| Teste | Pergunta | Resultado | Decisão |
|---|---|---|---|
| **Estabilidade:** gpt-5.4 × gpt-5.4, duas execuções independentes (600 conversas) | A classificação se repete? | **κ = 0,95** (IC 95% bootstrap: 0,93–0,97). H0: κ ≤ 0,6 **rejeitada** | Tema **entra** na análise |
| **Concordância entre modelos:** gpt-5.4 × gpt-5.4-nano (11.621) | Um modelo menor chega ao mesmo tema? | κ = 0,79 (IC 95%: 0,78–0,79) | As discordâncias se concentram em "conhecimento geral" (ver item 5) |
| **Revisão humana por padrão** | Quem está certo quando discordam? | gpt-5.4 correto nos 3 padrões que somam 34% das discordâncias | gpt-5.4 vira o classificador final |
| **Validade de construto:** associações previstas **antes** de rodar (qui-quadrado) | Os temas se comportam como deveriam? | **5 de 5 confirmadas** (abaixo) | — |
| **Insatisfação:** estabilidade gpt-5.4 × gpt-5.4 (245 conversas com > 1 mensagem) | O sinal se repete? | κ = 0,93 (IC 95%: 0,89–0,98). Com o nano era 0,32 | Entra como **subanálise** (só existe com 2ª mensagem) |

| Hipótese registrada antes | % no tema | % no resto | p | Confirma? |
|---|---:|---:|---:|---|
| "Imagem/mídia" tem mais recusa ou limitação declarada | 20,7% | 5,2% | < 0,001 | sim |
| "Burlar regras" tem mais recusa ou limitação declarada | 24,4% | 5,2% | < 0,001 | sim |
| "Programação" tem mais conversas em inglês | 27,8% | 15,1% | < 0,001 | sim |
| "Saudação/teste" tem mais 1ª mensagem com < 10 caracteres | 69,2% | 3,1% | < 0,001 | sim |
| "Reescrita" tem mais 1ª mensagem longa (≥ 500 caracteres) | 22,2% | 17,7% | < 0,001 | sim |

**Limitações declaradas:** não há gabarito humano completo; a acurácia não foi estimada contra rótulos humanos linha a linha. Sustentam o uso do tema a estabilidade (κ = 0,95), a validade de construto (5/5) e a revisão humana dos padrões de discordância.

## Requisito AWS (IN-2.2-02)

A classificação usa LangChain com o provedor definido em `.env` (`LLM_PRIMARY_PROVIDER=openai` no desenvolvimento; `bedrock_converse` na entrega). **Os rótulos atuais vêm da OpenAI**, usada aqui como ferramenta de análise (PDF §2.2: "na análise, use as ferramentas que preferir"). Na implantação, a mesma classificação roda no **Amazon Bedrock** trocando só o `.env`, e precisa ser revalidada com `analise/validar_temas.py` (o modelo muda).
