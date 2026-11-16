# Passo 1 · Qualidade dos dados (camada bruta, Brasil)

**Fonte:** `allenai/WildChat-1M` (HuggingFace), 14 arquivos, 837.989 conversas → **11.621 com `country = 'Brazil'`**.
**Reprodução:** `python -m analise.qualidade` (cada número abaixo sai de uma consulta nomeada no script).

## Problemas encontrados e tratamento

| # | Problema | Evidência | Impacto se ignorado | Tratamento |
|---|---|---|---|---|
| Q1 | **Só o assistente tem horário.** Mensagens do usuário não têm `timestamp` | 26.579 de 26.579 mensagens de usuário sem horário; 0 de 26.579 do assistente | Não dá para saber a hora exata da pergunta | O início da conversa é o horário da **1ª resposta** (`conversation[2].timestamp`). Diferença para a pergunta: segundos |
| Q2 | **`timestamp` é o último turno**, não o início | Duração p90 = 21 min, p99 = 5,8 h | Usar `timestamp` como "primeira vez" desloca a coorte e pode transformar a própria 1ª conversa em "retorno" (é uma das falhas do incidente §4.2) | Início = Q1; `timestamp` só como fim |
| Q3 | **Conversas reabertas depois**: a pessoa volta a uma conversa antiga em vez de abrir uma nova | 664 conversas com pausa > 30 min entre respostas; 37 duram mais de 1 dia | Contar retorno só por "conversa nova" perde quem voltou numa conversa antiga | Medir uso pelo **horário de cada resposta**, não só pelo início da conversa (a decidir no Passo 2) |
| Q4 | **`conversation_hash` não é chave** | 11.555 hashes para 11.621 conversas; 27 grupos repetidos, todos de IPs diferentes, 1ª mensagem mediana de 2 caracteres ("oi") | Deduplicar por hash apagaria conversas reais de pessoas diferentes | Chave = 1º `turn_identifier` (único nas 11.621; nenhum turno se repete entre linhas) |
| Q5 | **Reenvio**: mesma 1ª mensagem, mesmo IP, em menos de 10 min | 386 casos | Inflaria "retorno" se cada reenvio contasse como volta | Agrupar em **sessão** (pausa mínima entre usos, a medir no Passo 2) |
| Q6 | **O IP muda dentro da mesma conversa** | 175 conversas | `hashed_ip` separa uma mesma pessoa em duas (rede móvel, Wi-Fi → 4G); retorno subestimado | Alternativa a medir no Passo 2: unir IPs que aparecem na mesma conversa |
| Q7 | **IP compartilhado ou automatizado** | O maior IP tem 1.557 conversas (13,4% do total), 35 user-agents, 28 idiomas, 129 dias ativos, um só estado (explica sozinho o Piauí ser o 3º estado) | Domina qualquer gráfico por conversa; na retenção pesa como 1 "usuário" que na verdade são vários | EDA por usuário (não por conversa) e sensibilidade com e sem IPs anômalos |
| Q8 | **Idioma não confiável em mensagens curtas** | 714 primeiras mensagens com < 10 caracteres; "Finnish", "Maori", "Sotho", "Nolang" com mensagem mediana de 2 a 5 caracteres | Fator "idioma" com categorias falsas | Idioma em 3 grupos (português, inglês, outros) + indicador de mensagem curta |
| Q9 | **Mensagem do usuário vazia** | 273 conversas | Tamanho e tema sem sentido nesses casos | Indicador próprio; tema = "sem conteúdo" |
| Q10 | **`toxic` é sempre falso** | 0 de 11.621 | A variável não discrimina nada (a versão pública do WildChat-1M exclui as conversas tóxicas) | Fora da análise; registrado como dado que falta |
| Q11 | **Oferta do GPT-4 muda com o tempo** | % GPT-4 por mês: 13–16% (abr–jun/23), **0% (jul–out/23)**, 15% (nov/23), **75–94% (dez/23–abr/24)** | Comparar GPT-4 × GPT-3.5 sem controlar o período mistura o efeito do modelo com o efeito da época | Comparação sempre **dentro do período** (controle de coorte); a mudança de regime é investigada no Passo 6 |
| Q12 | Poucos campos nulos | `state` nulo em 51; `redacted` em 56; nenhum user-agent nulo | Baixo | `state` nulo vira "não informado" |

## Checagens que passaram

- Toda conversa começa por uma mensagem do usuário, e `len(conversation) = 2 × turn` em todas.
- Nenhum início depois do fim.
- Nenhuma semana sem dados entre abr/2023 e abr/2024 (a 1ª semana é parcial, com 14 conversas).
- 60% dos IPs (1.424 de 2.385) têm uma única conversa.
