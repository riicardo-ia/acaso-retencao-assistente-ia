<!-- traduzido de: aa75a964cbd5 -->
# Step 2 · Definitions and sensitivity of the 7-day return

**Reproduction:** `python -m analise.sensibilidade` · definitions in `analise/definicoes.py`, locked by `tests/test_definicoes.py`.

## Revision 1: return by calendar day

During the review of the steps, the text of PDF §2.3 ("in which time zone **a day counts**") showed that the return must be measured in **calendar days**: in the session rule, the time zone changed nothing. Besides, 78% of the session-based "returns" happened in the first 24 h, largely the same person coming back a few hours later on the same day. The reference became **use on another local day (D+1 to D+7)**, and the session rule became a sensitivity check ([BDR-001](../bdr/BDR-001-definicoes-de-uso-e-retorno.md), rev. 1).

## Reference definitions

| Concept | Definition | Origin of the choice |
|---|---|---|
| User | `hashed_ip` | There is no user ID (PDF §2.1) |
| Use event | each **assistant answer** (time of the message) | Only the assistant has a time (Q1); it captures whoever comes back to an old conversation (Q3) |
| First experience | all use on the **1st local day** (`America/Sao_Paulo`) | Consistent with the return by day |
| 7-day return | some use on **another local day, from D+1 to D+7** | "Using it again" = coming back on another day; PDF §2.3 |
| Cohort | week (Monday to Sunday) of the 1st day, in the local time zone | — |
| Eligible | 1st day ≥ 14 days after the start of the base and ≥ 8 days before the end | Avoids a false "new" and a false "did not come back" |

## Sensitivity (each row changes ONE choice)

| Scenario | Users | Came back | Return | 95% CI | Δ vs. reference |
|---|---:|---:|---:|---|---:|
| **Reference: another local day, D+1 to D+7** | 2,266 | 416 | **18.4%** | 16.8–20.0 | — |
| Previous rule: new session (pause > 30 min) within 7 × 24 h | 2,266 | 637 | 28.1% | 26.3–30.0 | **+9.7 pp** |
| └ session with a 15-min pause | 2,266 | 757 | 33.4% | 31.5–35.4 | +15.0 pp |
| └ session with a 60-min pause | 2,266 | 558 | 24.6% | 22.9–26.4 | +6.2 pp |
| User = IP + user-agent | 2,747 | 554 | 20.2% | 18.7–21.7 | +1.8 pp |
| User = IPs joined by conversation (Q6) | 2,197 | 397 | 18.1% | 16.5–19.7 | −0.3 pp |
| Use = only the start of a conversation | 2,266 | 387 | 17.1% | 15.6–18.7 | −1.3 pp |
| 3-day window | 2,292 | 363 | 15.8% | 14.4–17.4 | −2.6 pp |
| 14-day window | 2,212 | 439 | 19.8% | 18.2–21.6 | +1.4 pp |
| Without cutting the first 2 weeks | 2,330 | 435 | 18.7% | 17.1–20.3 | +0.3 pp |
| Without cutting the end | 2,311 | 423 | 18.3% | 16.8–19.9 | −0.1 pp |
| Without anomalous IPs (≥ 10 user-agents) | 2,264 | 414 | 18.3% | 16.7–19.9 | −0.1 pp |
| Day counted in UTC | 2,266 | 445 | 19.6% | 18.1–21.3 | +1.2 pp |

## Reading

- **What counts as "coming back" is the choice that moves the number the most**: 18.4% (another day) against 28.1% (a new session on the same day already counts). The screen shows the definition and this range.
- **The time zone now matters** (+1.2 pp in UTC): whoever uses it near midnight changes day.
- **The definition of user moves little** (−0.3 to +1.8 pp). Adding the user-agent *raises* the return because it splits shared IPs into several very active "users".
- **Censoring cuts and anomalous IPs barely move the total.**
- **Weekly cohorts are small:** 16 of 53 weeks have fewer than 30 new users; the standard deviation between weeks (6.1 pp) is close to what chance produces with ~43 people per week (≈ 5.9 pp). This conditions Step 6.

## Decision

Original reference approved and later revised (**revision 1**: return by calendar day) → [`BDR-001`](../bdr/BDR-001-definicoes-de-uso-e-retorno.md).
