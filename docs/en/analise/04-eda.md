<!-- traduzido de: ae4e49cd583e -->
# Step 4 · Exploratory analysis

**Reproduction:** `python -m analise.tabela && python -m analise.eda` (charts in `img/`, numbers printed).
**Question from the brief:** "how **use** is distributed over time, by model, language, topic and conversation length", only with the charts that led to a conclusion. Everything here is **descriptive**; effects adjusted for confounding are Step 6.

Each distribution chart compares two readings of the same use: **% of conversations** (orange) and **% of users**, by each one's 1st conversation (blue). The difference between them is the size of the distortion caused by heavy users.

## 1. Use is concentrated in few people

| Share of IPs | % of conversations |
|---|---:|
| 1% most active | **41.1%** |
| 5% most active | 59.2% |
| 10% most active | 68.9% |

77.5% of the users use the assistant **on a single day** in the whole base.
**Conclusion:** any "per conversation" number describes the heavy users, not the typical person. The return analysis is **per user** (1 row per person).

## 2. Over time: arrivals and model availability change

![Use over time](img/01-uso-no-tempo.png)

- The arrival of new users has two peaks (May/2023 and Mar/2024) and a valley in Dec/2023–Jan/2024.
- GPT-4 disappears from Jul to Oct/2023 and becomes **the majority (75–94%)** from Dec/2023 on.

**Conclusion:** GPT-4 × GPT-3.5 can only be compared **within the period**; the shift of GPT-4 from optional to default helps separate choice from effect (Step 6).

## 3. By topic: the 1st conversation differs from recurring use

![Use by topic](img/05-uso-por-tema.png)

| Topic | % conversations | % users (1st conversation) |
|---|---:|---:|
| Study and academic work | 15.6 | 17.1 |
| Marketing and professional content | 8.9 | 14.6 |
| **Greeting or testing the assistant** | 4.6 | **14.6** |
| General knowledge | 27.5 | 14.4 |
| Programming and technology | 7.5 | 11.8 |
| Fiction, roleplay and creative writing | 15.9 | 8.2 |
| Everyday life and advice | 5.1 | 6.2 |
| Rewriting, summaries and translation | 10.4 | 5.3 |
| **Asks for an image, video or audio** | 2.0 | **4.4** |
| Tries to get around the rules | 1.8 | 2.7 |
| Other / undefined | 0.9 | 0.9 |

**Conclusion:** 1 in every 7 people starts **just testing** the assistant, and 1 in every 23 starts **asking for an image, video or audio**, something a text assistant does not deliver. Fiction and rewriting weigh twice as much in conversations as in first conversations: they are uses of people who stay.

## 4. By language, length and model

![Use by language](img/06-uso-por-idioma.png)
![Use by length](img/07-uso-por-tamanho.png)
![Use by model](img/08-uso-por-modelo.png)

| | % conversations | % users (1st conversation) |
|---|---:|---:|
| Portuguese · English · other | 75.7 · 16.1 · 8.2 | 68.3 · 19.6 · 12.1 |
| 1 turn · 2 · 3–4 · 5–9 · 10+ | 56.2 · 18.7 · 14.2 · 8.4 · 2.4 | 46.5 · 23.9 · 17.0 · 9.4 · 3.2 |

**Conclusions:** use is mostly in Portuguese; **half of the conversations have a single turn**; the model version follows the availability calendar (gpt-3.5-0301 in Apr–Jun/23, 0613 in Jul–Nov/23, gpt-4 preview afterwards), so "model version" is almost a synonym for "period".

## 5. Whoever comes back, comes back soon

![Return curve](img/02-curva-de-retorno.png)

| Calendar days after the 1st day | 1 | 3 | 7 | 14 |
|---|---:|---:|---:|---:|
| % who already came back | 11.1% | 15.9% | **18.4%** | 19.8% |

**Conclusion:** 60% of the 7-day returns happen **on the next day**, and the 14-day window adds only 1.4 pp. What decides the return is in the 1st day and the following morning.

## 6. Whoever chats more on the 1st day comes back more, but that is engagement, not cause

![Return by turns](img/03-retorno-por-turnos.png)

| Turns on the 1st day | 1 | 2 | 3–4 | 5–9 | 10+ |
|---|---:|---:|---:|---:|---:|
| n | 759 | 471 | 465 | 346 | 225 |
| Return (95% CI) | 10.5% (8.6–12.9) | 13.0% (10.2–16.3) | 20.9% (17.4–24.8) | 22.3% (18.2–26.9) | 44.9% (38.5–51.4) |

**Conclusion:** a strong and monotonic relationship, but the same disposition that makes the person chat more makes them come back. Turns enter Step 6 as a **mediator**, separate from the factors the product controls.

## 7. Whoever arrives with "hi" or "test" comes back less

![Return by length of the 1st message](img/04-retorno-por-tamanho-da-1a-mensagem.png)

| Characters of the 1st message | < 10 | 10–49 | 50–199 | 200–999 | 1,000+ |
|---|---:|---:|---:|---:|---:|
| n | 461 | 569 | 694 | 327 | 215 |
| Return (95% CI) | 12.1% (9.5–15.4) | 18.1% (15.2–21.5) | 20.6% (17.8–23.8) | 20.8% (16.7–25.5) | 21.4% (16.4–27.4) |

**Conclusion:** the jump is between "< 10" and the rest; above 50 characters the rate is flat. A short 1st message measures **intent on arrival** (curiosity, testing), a trait of the profile and not of the answer. It enters Step 6 as a **confounder**.

## Discarded charts

Return by language, device, time of day and weekend were looked at (table in Step 3), but without adjustment they do not lead to a conclusion. They go straight into the Step 6 model.
