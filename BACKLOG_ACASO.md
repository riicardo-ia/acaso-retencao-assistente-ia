# Backlog do desafio Acaso: retenção de um assistente de IA

**Fonte dos requisitos:** o [enunciado do desafio](<Desafio Técnico Acaso Análise e Dashboard de Retenção de um Assistente de IA.pdf>) (8 páginas). Cada item abaixo é um requisito do enunciado, com a seção de origem. O desafio só está concluído quando todos estiverem feitos.

**Prioridade do trabalho:** responder a pergunta de negócio. A infraestrutura é meio; o dashboard reflete a análise e permite que quem lê confira cada número (método, n, margem de erro, definição e SQL). Se infraestrutura e análise competirem por tempo, a análise vence.

**Status:** `feito` · `em andamento` · `a fazer`
**Prioridade:** `P0` sem isso não há resposta ou entrega · `P1` exigido pelo enunciado · `P2` reforça a avaliação
**Etapa:** etapa do plano (seção F) que entrega o item. Itens marcados com *(extra)* foram incluídos além do enunciado.

---

## A · Analytics: a resposta ao negócio

### A1 · §1 Contexto e objetivo

| ID | Requisito | Evidência | Prior. | Etapa | Status |
|---|---|---|---|---|---|
| AN-1-01 | Responder o que faz quem experimentou voltar em até 7 dias | Resposta no documento, sustentada pela análise | P0 | E3 | feito · `docs/analise/06-analise.md` §4 |
| AN-1-02 | Quais fatores têm o maior efeito e quanto pesa cada um | Efeitos com intervalo de confiança, ordenados | P0 | E3 | feito · 06 §1 |
| AN-1-03 | Quanto disso é causa e não seleção | Bruto × ajustado, tratamento de confusão e limites declarados | P0 | E3 | feito · 06 §2 (regressão, IPW, regime de oferta) |
| AN-1-04 | Análise estatística, não só descritiva: efeito de cada fator com sua incerteza | Todo efeito com intervalo de confiança | P0 | E3 | feito |
| AN-1-05 | Recomendar o que mudar ao cliente | Recomendações ligadas aos achados | P0 | E3/E7 | feito · 06 §4 e tela A resposta |

### A2 · §2 Base de dados

| ID | Requisito | Evidência | Prior. | Etapa | Status |
|---|---|---|---|---|---|
| AN-2-01 | Usar o WildChat-1M com `country = 'Brazil'` | Filtro na extração e contagem registrada | P0 | E1 | feito · 837.989 → 11.621 conversas |
| AN-2-02 | Não há ID de usuário: decidir e justificar como duas conversas são da mesma pessoa | BDR de usuário e sensibilidade a chaves alternativas | P0 | E2 | feito · BDR-001 |

### A3 · §3.1 Discovery e análise exploratória

| ID | Requisito | Evidência | Prior. | Etapa | Status |
|---|---|---|---|---|---|
| AN-3.1-01 | Definir usuário, sessão, primeira experiência e retorno, e quanto o resultado muda se a definição mudar | BDR e tabela de sensibilidade | P0 | E2 | feito · BDR-001 rev. 1, 13 cenários |
| AN-3.1-02 | Variáveis da 1ª experiência (modelo, tema, tamanho e qualidade da resposta, recusas, turnos, horário, idioma) e como cada uma é derivada | Dicionário de variáveis | P0 | E2/E4 | feito · `03-variaveis.md` |
| AN-3.1-03 | Se usar IA para classificar conversas, dizer como conferiu o resultado | Estabilidade, revisão manual e validade de construto | P1 | E4 | feito · `05-temas.md` |
| AN-3.1-04 | Problemas de qualidade encontrados e como tratou cada um | Tabela problema, impacto e tratamento | P0 | E2 | feito · `01-qualidade.md` |
| AN-3.1-05 | Uso no tempo, por modelo, idioma, tema e tamanho; padrões, concentrações e anomalias; só os gráficos que levaram a uma conclusão | Gráficos com a conclusão escrita | P1 | E2 | feito · `04-eda.md` |
| AN-3.1-06 | O que os dados permitem medir, o que não permitem e quais dados faltam | Seção no documento | P1 | E2/E7 | feito · 06 §6 |
| AN-3.1-07 | Sugestões para o assistente: onde falha, que temas ou respostas afastam | Lista ligada aos números | P1 | E3 | feito · 06 §5 |
| AN-3.1-08 | Sugestões para o dashboard, pensadas depois de olhar os dados | Lista no documento | P2 | E3/E7 | feito · DOCUMENTO §3 |

### A4 · §3.2 Análise

| ID | Requisito | Evidência | Prior. | Etapa | Status |
|---|---|---|---|---|---|
| AN-3.2-01 | Efeito de cada fator no retorno em 7 dias, com intervalo de confiança, ordenado pelo tamanho | Tabela `efeitos` e gráfico | P0 | E3 | feito · 06 §1 |
| AN-3.2-02 | Fatores de confusão, como foram tratados e o que a análise prova e não prova | Ajuste, IPW, balanceamento e seção "prova / não prova" | P0 | E3 | feito · 06 §2 |
| AN-3.2-03 | Uma semana em que o retorno caiu ou subiu: mudou o perfil de quem chegou ou a taxa dentro de cada perfil? | Decomposição perfil × taxa | P0 | E3 | feito · 06 §3 (20/11/2023) |
| AN-3.2-04 | Três achados para o cliente e a decisão que cada um sustenta | Três pares achado e decisão | P0 | E3 | feito · 06 §4 |

### A5 · §2.3 Premissas

| ID | Requisito | Evidência | Prior. | Etapa | Status |
|---|---|---|---|---|---|
| AN-2.3-01 | Registrar cada premissa (uso, sessões, fuso, período) | Lista de premissas | P0 | E2 | feito · DOCUMENTO §2 e BDR-001 |
| AN-2.3-02 | Para cada premissa, o que mudaria se estiver errada | Impacto em número, quando possível | P0 | E2 | feito · DOCUMENTO §2 |
| AN-2.3-03 | Dúvidas sem resposta do cliente viram premissa registrada | Premissas marcadas como assumidas | P1 | E2 | feito · BDR-001 |

---

## B · Infraestrutura e engenharia: o que sustenta e expõe a resposta

### B1 · §2.2 Restrições técnicas e de custo

| ID | Requisito | Evidência | Prior. | Etapa | Status |
|---|---|---|---|---|---|
| IN-2.2-01 | O dashboard não lê a base bruta; base analítica desenhada e populada por nós | Papel do app só lê o `mart`; o container do app não monta a base bruta | P0 | E5 | feito · testado no banco |
| IN-2.2-02 | Toda infra e todo custo do dashboard na AWS, inclusive o LLM | Mapa de componentes AWS; LLM por Bedrock | P0 | E4/E7 | feito · DOCUMENTO §4, ADR-003 |
| IN-2.2-03 | Na análise, ferramentas livres | OpenAI usada na análise, declarada | P1 | E4 | feito · `05-temas.md` |
| IN-2.2-04 | Rodar localmente e descrever como seria a implantação | Seção de implantação | P1 | E7 | feito · DOCUMENTO §4 |
| IN-2.2-05 | Dados pessoais: o que o dashboard mostra e o que nunca mostra | Seção e regra no código | P0 | E5/E7 | feito · DOCUMENTO §3, BDR-003 |
| IN-2.2-06 | *(extra)* Troca de provedor de LLM por configuração (OpenAI ou Bedrock) | `LLM_PRIMARY_PROVIDER` e `LLM_PRIMARY_MODEL` | P1 | E4 | feito · ADR-003 |

### B2 · §3 O que entregar

| ID | Requisito | Evidência | Prior. | Etapa | Status |
|---|---|---|---|---|---|
| IN-3-01 | Sobe do zero com um comando (`docker compose up`) | Teste em clone limpo | P0 | E8 | feito |
| IN-3-02 | Carrega a base analítica a partir da base bruta | Serviço `etl` no compose | P0 | E1/E5 | feito · com reconciliação SQL × Python |
| IN-3-03 | Pelo menos duas telas com dados reais | Telas no ar | P0 | E6 | feito · A resposta e Explorar |
| IN-3-04 | Repositório com instruções | README | P0 | E7 | feito |
| IN-3-05 | Decisões técnicas (ADRs) e de negócio (BDRs): contexto, opções e escolha | `docs/adr/`, `docs/bdr/` | P0 | contínuo | feito · 3 ADRs e 3 BDRs |
| IN-3-06 | Premissas registradas quando faltar informação | Ver AN-2.3-01 | P0 | E2 | feito |

### B3 · §3.3 Dashboard

| ID | Requisito | Evidência | Prior. | Etapa | Status |
|---|---|---|---|---|---|
| IN-3.3-01 | A pergunta de cada tela, os gráficos usados e por que esse tipo | Seção por tela e texto na própria tela | P0 | E6/E7 | feito · DOCUMENTO §3 |
| IN-3.3-02 | Indicadores: definição, fórmula, denominador, período e consulta SQL de cada um | `docs/indicadores.md` e "Como calculamos?" | P0 | E5/E6 | feito |
| IN-3.3-03 | O que a tela mostra quando a base é pequena demais | Regra de amostra mínima aplicada e testada | P0 | E6 | feito · menos de 30 pessoas, sem número próprio |
| IN-3.3-04 | Fluxo da base bruta até a tela, com diagrama | Diagrama no documento | P1 | E7 | feito · DOCUMENTO §4 |
| IN-3.3-05 | Componentes AWS e stack de frontend e backend, com o porquê | ADR de stack e tabela AWS | P1 | E7 | feito · ADR-001 |
| IN-3.3-06 | Modelo da base analítica | Objetos, grão e chaves | P1 | E5/E7 | feito · DOCUMENTO §4 e `etl/sql/` |
| IN-3.3-07 | Principais endpoints: nome, entrada e saída | Tabela no documento e `/api/docs` | P1 | E6/E7 | feito |
| IN-3.3-08 | Outros países: idioma da interface, fuso de cada país e comparação | Seção de desenho | P1 | E7 | feito · DOCUMENTO §4 |
| IN-3.3-09 | Desempenho: o que é pré-calculado, o que vai para cache, quando expira e como mede o tempo de resposta | Seção e medição real | P1 | E6/E7 | feito · 25–40 ms sem cache, 2–3 ms com cache |
| IN-3.3-10 | *(extra)* Quem lê consegue conferir: n, margem de erro, método, SQL, sensibilidade, bruto × ajustado | Recursos nas telas | P0 | E6 | feito |
| IN-3.3-11 | *(extra)* Duas telas: A resposta (fixa, abre primeiro) e Explorar (5 filtros principais, frases por regra) | BDR-003 e telas | P0 | E6 | feito · filtros validados contra o banco |
| IN-3.3-12 | *(extra)* Layout responsivo, identidade visual da Acaso, gráficos comuns e linguagem simples | Telas | P1 | E6 | feito |

### B4 · §1 Usuário final

| ID | Requisito | Evidência | Prior. | Etapa | Status |
|---|---|---|---|---|---|
| IN-1-01 | Resultados chegam por dashboard, não por notebook | Telas com os resultados | P0 | E6 | feito |
| IN-1-02 | Cada tela se explica sozinha para quem é de negócio | Pergunta e leitura em cada tela | P0 | E6 | feito |
| IN-1-03 | Cada número com definição e fonte | Rodapé, dicas e "Como calculamos?" | P0 | E6 | feito |
| IN-1-04 | Cada efeito com sua incerteza | Faixa provável em todo efeito | P0 | E6 | feito |

---

## C · Sustentação e investigação de falhas

### C1 · §4.1 Monitoramento

| ID | Requisito | Evidência | Prior. | Etapa | Status |
|---|---|---|---|---|---|
| SU-4.1-01 | O que registrar em cada camada para investigar um número errado | `mart.cargas` e log com `request_id` | P1 | E5/E7 | feito · DOCUMENTO §5 |
| SU-4.1-02 | Como perceber que um número divergiu antes do cliente | Reconciliação que bloqueia a publicação | P1 | E5/E7 | feito |
| SU-4.1-03 | Testes que impedem a definição de um indicador de mudar sem ninguém perceber | Testes de definição, API e integração | P0 | E3/E5 | feito · 45 testes e 6 de integração |
| SU-4.1-04 | Como uma mudança chega à produção: ambientes, migrações e deploy | Seção no documento | P1 | E7 | feito · DOCUMENTO §5 |

### C2 · §4.2 Investigação de um incidente

| ID | Requisito | Evidência | Prior. | Etapa | Status |
|---|---|---|---|---|---|
| SU-4.2-01 | Por onde começaria e por quê | Resposta 1 | P1 | E7 | feito · `docs/incidente-4.2.md` |
| SU-4.2-02 | Camada da falha, evidências e consulta de confirmação | Resposta 2 e SQL | P1 | E7 | feito |
| SU-4.2-03 | Trecho que causa o problema e a correção escrita | Resposta 3 e código | P1 | E7 | feito |
| SU-4.2-04 | O que fazer além do código e como evitar que volte | Resposta 4 | P1 | E7 | feito |
| SU-4.2-05 | O que dizer à gerente de produto durante e depois | Resposta 5 | P1 | E7 | feito |

### C3 · §4.3 Riscos e decisões em aberto

| ID | Requisito | Evidência | Prior. | Etapa | Status |
|---|---|---|---|---|---|
| SU-4.3-01 | Principais riscos da solução | Lista no documento | P1 | E7 | feito · DOCUMENTO §6 |
| SU-4.3-02 | Decisões a levar ao time ou ao cliente antes de implementar | Lista no documento | P1 | E7 | feito · DOCUMENTO §6 |

---

## D · Documentação, uso de IA e entrega

### D1 · §5 Uso de IA

| ID | Requisito | Evidência | Prior. | Etapa | Status |
|---|---|---|---|---|---|
| DO-5-01 | Quais ferramentas de IA foram usadas e para quê | Parágrafo no documento | P1 | E7 | feito · DOCUMENTO §7 |
| DO-5-02 | O que foi conferido, corrigido ou descartado | Parágrafo no documento | P1 | E7 | feito · DOCUMENTO §7 |
| DO-5-03 | Horas dedicadas | Parágrafo no documento | P1 | E7 | em andamento |

### D2 · Forma da entrega

| ID | Requisito | Evidência | Prior. | Etapa | Status |
|---|---|---|---|---|---|
| DO-0-01 | Análise executada, dashboard funcionando e documento curto | Os três presentes | P0 | E8 | em andamento · falta o envio |
| DO-0-02 | Decisões claras e justificadas, não documento longo | Documento curto com links para o detalhe | P1 | E7 | feito |
| DO-0-03 | Envio no prazo do enunciado, para os dois e-mails indicados | E-mail com o link do repositório | P0 | E8 | a fazer |
| DO-0-04 | Apresentação: 20 min de construção e 40 min de entrevista | Roteiro, depois da entrega | P2 | depois | a fazer |

---

## E · §6 Critérios de avaliação: conferência final

| Critério | O que observam | IDs que respondem | Situação |
|---|---|---|---|
| Análise | efeitos com incerteza; causa × seleção; o movimento se sustenta nos dados | AN-1-0x, AN-3.2-01..03 | atendido |
| Discovery e EDA | padrões e problemas relevantes; definições defensáveis; sugestões que saem dos dados | AN-2-02, AN-3.1-01..08 | atendido |
| Investigação e sustentação | segue o dado até a origem; causa no código; correção que evita a volta | SU-4.2-01..05, SU-4.1-0x | atendido |
| Dashboard | quem não é técnico entende sem ajuda; efeito com incerteza e fonte | IN-1-0x, IN-3.3-01..03, IN-3.3-10 | atendido |
| Construção e código | sobe do zero; código legível e testado; decisões registradas | IN-3-01..05, SU-4.1-03 | atendido |
| Clareza e premissas | documento objetivo; premissas, riscos e escalonamentos explícitos | AN-2.3-0x, SU-4.3-0x, DO-0-02 | atendido |
| Apresentação | explicar as decisões em 20 min e defender na entrevista | DO-0-04 | depois da entrega |
| Uso de IA | uso com critério e resultado conferido | DO-5-0x, AN-3.1-03 | atendido |

---

## F · Plano de execução

| Etapa | Conteúdo | Tempo | IDs principais |
|---|---|---|---|
| E1 | Extração: download, filtro Brasil, camada bruta e contagens | 40 min | AN-2-01, IN-3-02 |
| E2 | Discovery: qualidade, definições, sensibilidade, premissas e EDA | 1h30 | AN-2-02, AN-3.1-01/02/04/05/06, AN-2.3-0x |
| E3 | Análise: efeitos com incerteza, causa × seleção, semana, 3 achados e sugestões | 2h30 | AN-1-0x, AN-3.2-0x, AN-3.1-07/08 |
| E4 | Tema das conversas: classificação e validação | 1h | AN-3.1-02/03, IN-2.2-02/06 |
| E5 | Base analítica e carga, com reconciliação e testes de definição | 45 min | IN-2.2-01, IN-3.3-06, SU-4.1-0x |
| E6 | API e telas | 2h | IN-1-0x, IN-3-03, IN-3.3-01..03/07/09..12 |
| E7 | Documento, ADRs, BDRs, implantação, incidente, monitoramento, riscos e uso de IA | 1h30 | IN-3.3-04..08, SU-4.x, DO-5-0x |
| E8 | Teste do zero em clone limpo, conferência final e envio | 20 min | IN-3-01, DO-0-01/03 |

**Regra de corte:** se faltar tempo, corta-se acabamento de tela, nunca um item P0 de Analytics.

---

## G · Decisões tomadas

| Tema | Decisão | Registro |
|---|---|---|
| Usuário, uso, retorno, fuso e período | Pessoa = IP com hash; retorno = uso em outro dia local, de D+1 a D+7; fuso de São Paulo; cortes nas duas pontas da base | BDR-001 |
| Temas das conversas | 11 temas fixos, descobertos nos dados e revisados manualmente; classificação da conversa inteira | BDR-002 |
| O que o dashboard mostra | Duas telas, 5 filtros principais, frases por regra, amostra mínima de 30 pessoas, sem dados pessoais | BDR-003 |
| Stack | FastAPI, página estática sem dependências e Postgres | ADR-001 |
| Base analítica | Schema `mart`, papel do app somente leitura, carga idempotente com reconciliação | ADR-002 |
| LLM | gpt-5.4 com saída estruturada; OpenAI na análise, Bedrock por configuração; rótulos versionados | ADR-003 |
| Validação da classificação | Estabilidade entre duas execuções, revisão manual das discordâncias entre dois modelos e testes de validade de construto | `05-temas.md` |

