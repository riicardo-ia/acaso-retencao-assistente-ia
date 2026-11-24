<!-- traduzido de: c3afb4ae7063 -->
# BDR-003 · What the dashboard shows: two screens, five filters, minimum sample and personal data

**Decided by:** Ricardo · **Status:** approved

## Context

The audience is business people, not statisticians, and the dashboard is a self-service BI: people will filter and draw conclusions on their own. Too many filters and free-text sentences open room for false conclusions; the conversations may contain personal data.

## Options considered

| Topic | Options | Choice |
|---|---|---|
| Screens | one screen with everything filterable · **The answer (fixed, opens first) + Explore (filterable)** | Separate exploration from conclusion: the effect "comparing similar people" comes from a model that should not be recomputed on small groups |
| Filters | every variable of the 1st experience · **only the main ones** | Period of the 1st use, language, device, topic of the 1st conversation and model. Engagement (turns, dissatisfaction) is not a filter: it is not a cause and invites wrong conclusions |
| Automatic sentences | free text by an LLM · **fixed rules with a statistical lock** | "Confirmed" only with 30+ people and a difference above the margin of error with 99% confidence |
| Minimum sample | no limit · hide only on the screen · **hide in the API** | With fewer than 30 people, the API returns no number for the group; the screen shows "fewer than 30" or "few people", with no conclusion |
| Language | statistical terms · **plain language, with the technical detail collapsible** | "margin of error", "comparing similar people", "may be chance" |
| Unit | "out of every 100 people" · percentage points · **%** | Returns in % with one decimal place and the margin of error at the ends; the weight of each factor also in %, relative to the comparison group ("comes back 74% less"), easier to read than percentage points |
| Layout of The answer screen | charts by subject · **one block per client question** | Each question is the title of its chart, with the answer in one sentence; each row shows only the factor's own data (measured value in the middle, margin of error at the ends), with no comparison group drawn; the detail stays in "How do we calculate it?" |

## What the dashboard shows and what it never shows

- **Shows:** aggregated counts and percentages, with margin of error, and model effects.
- **Never shows:** conversation text, IP, user-agent, state or the number of a group with fewer than 30 people. The API returns these numbers empty (not even the count goes out), and a test guarantees it. The analytical base stores no text, IP or user-agent; the person is `sha256(salt + hashed_ip)`.
- **Residual risk:** subtracting two filtered segments could estimate the size of a small group. The risk is low, because there are only counts of pseudonymized people and no content.

## Consequences

- The sentence on the Explore screen may differ from The answer screen (simple comparison × similar people); the screen explains the difference.
- The filters are validated by an integration test (`tests/test_explorar_dados.py`).
