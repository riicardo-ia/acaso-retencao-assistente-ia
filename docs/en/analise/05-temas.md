<!-- traduzido de: f597dc629c13 -->
# Step 5 · Conversation topics: discovery, classification and validation

**Reproduction:** `python -m analise.temas_descoberta` → `python -m analise.classificar` → `python -m analise.validar_temas`.

## How it was done (hybrid format)

1. **Discovery without an LLM** (`analise/temas_descoberta.py`): TF-IDF + k-means clustering of the **whole conversations** (up to 5 user messages, 2,000 characters) and reading of random samples. The 1st message alone was discarded as the unit: it can be just a "hi" before the real request.
2. **Closed list reviewed by hand:** 11 topics and 4 dissatisfaction signals, each with a description (`analise/classificar.py`).
3. **Classification:** the LLM reads only the user's messages and picks one option from each list through **structured output** (it cannot create a category). Tie-break rule: the **main request** counts; "greeting/test" only when the conversation just tests. Without an LLM, by rule: user text with < 10 characters → "greeting/test"; a conversation with a single message → dissatisfaction "not assessable".
4. **First round** with `gpt-5.4-nano` on all 11,621 conversations and, independently, with `gpt-5.4` (larger model, as a reviewer) on a random sample of 600. The two disagreed on 111 of the 600.
5. **Human review by pattern**: three patterns add up to 38 of the 111 disagreements: the nano put into "general knowledge" what was **fiction** (16: hypothetical questions about real people and characters in other universes), **study** (15: definitions of concepts and explanations of technical topics) and **everyday life** (7: cooking and transportation questions). In the review, gpt-5.4 was right in all three and more consistent overall.
6. **Final classification with `gpt-5.4`** on all 11,621 conversations (0 errors; 4,776 conversations with more than one user message). Each label keeps the provider, model and prompt version in `data/seed/temas.csv` (no conversation content).

## Statistical validation

| Test | Question | Result | Decision |
|---|---|---|---|
| **Stability:** gpt-5.4 × gpt-5.4, two independent runs (600 conversations) | Does the classification repeat? | **κ = 0.95** (95% bootstrap CI: 0.93–0.97). H0: κ ≤ 0.6 **rejected** | Topic **enters** the analysis |
| **Agreement between models:** gpt-5.4 × gpt-5.4-nano (11,621) | Does a smaller model reach the same topic? | κ = 0.79 (95% CI: 0.78–0.79) | The disagreements concentrate on "general knowledge" (see item 5) |
| **Human review by pattern** | Who is right when they disagree? | gpt-5.4 right in the 3 patterns that make up 34% of the disagreements | gpt-5.4 becomes the final classifier |
| **Construct validity:** associations predicted **before** running (chi-square) | Do the topics behave as they should? | **5 out of 5 confirmed** (below) | — |
| **Dissatisfaction:** stability gpt-5.4 × gpt-5.4 (245 conversations with > 1 message) | Does the signal repeat? | κ = 0.93 (95% CI: 0.89–0.98). With the nano it was 0.32 | Enters as a **sub-analysis** (only exists with a 2nd message) |

| Hypothesis recorded beforehand | % in the topic | % in the rest | p | Confirmed? |
|---|---:|---:|---:|---|
| "Image/media" has more refusals or stated limitations | 20.7% | 5.2% | < 0.001 | yes |
| "Get around the rules" has more refusals or stated limitations | 24.4% | 5.2% | < 0.001 | yes |
| "Programming" has more conversations in English | 27.8% | 15.1% | < 0.001 | yes |
| "Greeting/test" has more 1st messages with < 10 characters | 69.2% | 3.1% | < 0.001 | yes |
| "Rewriting" has more long 1st messages (≥ 500 characters) | 22.2% | 17.7% | < 0.001 | yes |

**Stated limitations:** there is no complete human gold standard; accuracy was not estimated against human labels row by row. The use of the topic is supported by stability (κ = 0.95), construct validity (5/5) and the human review of the disagreement patterns.

## On AWS

The classification uses LangChain with the provider set in `.env` (`LLM_PRIMARY_PROVIDER=openai` in development; `bedrock_converse` in the delivery). **The current labels come from OpenAI**, used here as an analysis tool (PDF §2.2: "for the analysis, use the tools you prefer"). In deployment, the same classification runs on **Amazon Bedrock** by changing only the `.env`, and it has to be revalidated with `analise/validar_temas.py` (the model changes).
