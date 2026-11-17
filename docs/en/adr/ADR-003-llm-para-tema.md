<!-- traduzido de: dd2ae03bd2b1 -->
# ADR-003 · Conversation topic: closed classification by LLM, switch between OpenAI and Bedrock, and versioned labels

**Status:** accepted

## Context

The topic of the 1st conversation is a variable requested by the PDF. The dashboard's LLM has to be on AWS; for the analysis, the tool is free. The evaluators run `docker compose up` without credentials for any provider.

## Options considered

| Option | Assessment |
|---|---|
| Keyword heuristic | Cheap, but weak for long and mixed conversations |
| LLM with free categories | Categories unstable between runs; hard to validate |
| Native SDK of each provider | Ties the code to one provider |
| **LangChain with structured output and a closed list; provider by configuration** | Chosen |

## Decision

- **Hybrid format:** topics discovered without an LLM (TF-IDF + k-means over the whole conversation), a list of 11 topics reviewed by hand; the LLM only picks one option (structured output).
- **Provider by `.env`:** `LLM_PRIMARY_PROVIDER=openai` in the analysis, `bedrock_converse` in production; the code does not change.
- **Model:** gpt-5.4, chosen after the manual review of the disagreements with gpt-5.4-nano.
- **Versioned labels** in `data/seed/temas.csv` (`conv_id`, topic, provider, model, prompt version), with no content. The load reads the seed and never calls an LLM.

## Consequences

- Validation in `analise/validar_temas.py`: stability κ = 0.95, 5 out of 5 construct hypotheses confirmed.
- The current labels come from OpenAI (analysis). In production, the classification of new conversations runs on **Amazon Bedrock** and has to be revalidated with the same script, because the model changes.
