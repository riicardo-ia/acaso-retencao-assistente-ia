# ADR-003 · Tema das conversas: classificação fechada por LLM, troca OpenAI ↔ Bedrock e rótulos versionados

**Status:** aceito

## Contexto

O tema da 1ª conversa é uma variável pedida pelo PDF. O LLM do dashboard precisa estar na AWS; na análise, a ferramenta é livre. A banca roda `docker compose up` sem credenciais de nenhum provedor.

## Opções consideradas

| Opção | Avaliação |
|---|---|
| Heurística por palavras-chave | Barata, mas fraca para conversas longas e mistas |
| LLM com categorias livres | Categorias instáveis entre execuções; difícil de validar |
| SDK nativo de cada provedor | Prende o código a um provedor |
| **LangChain com saída estruturada e lista fechada; provedor por configuração** | Escolhida |

## Decisão

- **Formato híbrido:** temas descobertos sem LLM (TF-IDF + k-means sobre a conversa inteira), lista de 11 temas revisada manualmente; o LLM só escolhe uma opção (saída estruturada).
- **Provedor por `.env`:** `LLM_PRIMARY_PROVIDER=openai` na análise, `bedrock_converse` em produção; o código não muda.
- **Modelo:** gpt-5.4, escolhido depois da revisão manual das discordâncias com o gpt-5.4-nano.
- **Rótulos versionados** em `data/seed/temas.csv` (`conv_id`, tema, provedor, modelo, versão do prompt), sem conteúdo. A carga lê o seed e nunca chama LLM.

## Consequências

- Validação em `analise/validar_temas.py`: estabilidade κ = 0,95, 5 de 5 hipóteses de construto confirmadas.
- Os rótulos atuais vêm da OpenAI (análise). Em produção, a classificação das conversas novas roda no **Amazon Bedrock** e precisa ser revalidada com o mesmo script, porque o modelo muda.
