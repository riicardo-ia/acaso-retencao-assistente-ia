# BDR-003 · O que o dashboard mostra: duas telas, cinco filtros, amostra mínima e dados pessoais

**Decidido por:** Ricardo · **Status:** aprovado

## Contexto

O público é de negócio, não estatístico, e o dashboard é um self-host BI: as pessoas vão filtrar e tirar conclusões sozinhas. Filtros demais e frases livres abrem espaço para conclusões falsas; as conversas podem ter dados pessoais.

## Opções consideradas

| Tema | Opções | Escolha |
|---|---|---|
| Telas | uma tela com tudo filtrável · **A resposta (fixa, abre primeiro) + Explorar (filtrável)** | Separar exploração de conclusão: o efeito "comparando pessoas parecidas" vem de um modelo que não deve ser recalculado em grupos pequenos |
| Filtros | todas as variáveis da 1ª experiência · **só as principais** | Período do 1º uso, idioma, dispositivo, tema da 1ª conversa e modelo. Engajamento (turnos, insatisfação) não é filtro: não é causa e convida a conclusões erradas |
| Frases automáticas | texto livre por LLM · **regras fixas com trava estatística** | Só "confirmada" com 30+ pessoas e diferença acima da margem de erro com 99% de confiança |
| Amostra mínima | sem limite · esconder só na tela · **esconder na API** | Com menos de 30 pessoas, a API não devolve nenhum número do grupo; a tela mostra "menos de 30" ou "poucas pessoas", sem conclusão |
| Linguagem | termos estatísticos · **linguagem simples, com o detalhe técnico recolhível** | "margem de erro", "comparando pessoas parecidas", "pode ser acaso" |

## O que o dashboard mostra e o que nunca mostra

- **Mostra:** contagens e percentuais agregados, com margem de erro, e efeitos do modelo.
- **Nunca mostra:** texto de conversa, IP, user-agent, estado ou número de grupo com menos de 30 pessoas. A API devolve esses números vazios (nem a contagem sai), e um teste garante isso. A base analítica não guarda texto, IP nem user-agent; a pessoa é `sha256(sal + hashed_ip)`.
- **Risco residual:** subtrair dois recortes filtrados pode estimar o tamanho de um grupo pequeno. O risco é baixo, porque só existem contagens de pessoas pseudonimizadas e nenhum conteúdo.

## Consequências

- A frase da tela Explorar pode divergir da tela A resposta (comparação simples × pessoas parecidas); a tela explica a diferença.
- Os filtros são validados por teste de integração (`tests/test_explorar_dados.py`).
