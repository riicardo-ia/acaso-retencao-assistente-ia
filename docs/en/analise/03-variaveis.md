<!-- traduzido de: a92510798741 -->
# Step 3 · Variables of the 1st experience

**Unit:** one row per eligible user (2,266; BDR-001 rev. 1). The 1st experience is the **1st local day of use**: only the conversations that start on it are included. The **1st conversation** is the one that starts first (time of the 1st answer, Q1); tie: smallest `conv_id`.
**Reproduction:** `python -m analise.tabela` → `data/tmp/usuarios.parquet` · rules in `analise/variaveis.py`, tested in `tests/test_variaveis.py`.

> The "raw return" numbers below (return on another day, D+1 to D+7; average 18.4%) are **only descriptive**, to check volume and distribution. No effect is claimed here: the adjusted effect, with uncertainty and control for confounding, is Step 6.

## Dictionary

| Variable | How it is derived | Values: n (raw return) | Note |
|---|---|---|---|
| `gpt4` | `model` of the **1st conversation** starts with `gpt-4` | yes 961 (18.7%) · no 1,305 (18.1%) | Availability changes over time (Q11) → always with `periodo` |
| `tema` | topic of the **1st conversation** (closed classification with gpt-5.4, Step 5) | 11 topics; from greeting/test 330 (6.4%) and image/media 99 (6.1%) to marketing 330 (26.4%) and rewriting 120 (26.7%) | Topics with n < 30 become "other" in the model |
| `varios_temas` | the 1st experience has conversations of more than one topic | yes 288 (29.9%) · no 1,978 (16.7%) | Caution: engagement (requires more than one conversation on the 1st day) |
| `idioma` | `language` of the 1st conversation in 3 groups | Portuguese 1,547 (18.4%) · English 445 (21.6%) · other 274 (13.1%) | "Other" mixes real languages and failed detection in short messages (Q8) |
| `dispositivo` | user-agent contains mobile/android/iphone/ipad | computer 1,543 (20.6%) · phone 723 (13.6%) | — |
| `recusa_1a` | **the 1st answer** of the 1st conversation has a refusal or stated limitation (PT/EN regex on the first 400 characters) | yes 93 (14.0%) · no 2,173 (18.6%) | Measured on the 1st answer, before any engagement. "Any refusal on the 1st day" was discarded: it rises with the number of answers (whoever chats more gets more refusals) and created a false positive effect |
| `msg_curta` | 1st message with < 10 characters | yes 461 (12.1%) · no 1,805 (19.9%) | Signal of **intent** on arrival → confounder |
| `tam_msg1` | characters of the 1st message | p25 18 · p50 58 · p75 186 · p90 920 | Skewed → log in the model |
| `tam_resposta_media` | average characters of the answers on the 1st day | p25 448 · p50 1,202 · p75 1,990 · p90 2,903 | Proxy for "answer length" |
| `turnos_exp1` | sum of `turn` of the conversations on the 1st day | p25 1 · p50 2 · p75 5 · p90 9 | Caution: **mediator / engagement** |
| `conversas_exp1` | conversations opened on the 1st day | p50 1 · p75 2 · p90 3 | Caution: same care as `turnos_exp1` |
| `faixa_horaria` | local hour of the start | overnight 239 (12.6%) · morning 525 (17.0%) · afternoon 754 (16.7%) · night 748 (22.9%) | Caution: with the return by calendar day, whoever starts at night is a few hours from D+1 (continuing after midnight already counts as "another day"): a **mechanical effect of the definition**, controlled in the model |
| `fim_de_semana` | Saturday or Sunday in local time | yes 577 (18.0%) · no 1,689 (18.5%) | — |
| `periodo` | GPT-4 availability regime (Q11) | Apr–Jun/23 666 (18.2%) · Jul–Oct/23 590 (18.8%) · Nov/23 227 (17.6%) · Dec/23–Apr/24 783 (18.4%) | **Control**, not a product factor |
| `insatisfacao` | dissatisfaction signal in the 1st conversation, chosen by the LLM | assessable in 1,149 (who sent > 1 message): dissatisfied 342 | Sub-analysis in Step 6 (only exists with a 2nd message); stable with gpt-5.4 (κ = 0.93) |
| `redacted` | some conversation on the 1st day with anonymized personal data | yes **17** | n < 30: left out of the model |

## Left out of the analysis

- `toxic`: always false in the public dataset (Q10).
- `state`: the 3rd state (Piauí) is almost all a single IP (Q7); using state would lead to a false conclusion.
