<!-- traduzido de: 17b1fbf62df5 -->
# BDR-001 · Definitions of user, use, session and 7-day return

**Decided by:** Ricardo · **Status:** approved · **Revision 1:** return by calendar day
**Evidence:** `docs/analise/01-qualidade.md`, `docs/analise/02-definicoes.md` (sensitivity) · **Code:** `analise/definicoes.py` + `tests/test_definicoes.py`

## Context

The dataset has no user identifier (PDF §2.1), and the PDF leaves open what counts as use, how to group into sessions, the time zone and the period (§2.3). Questions to the client closed on Wednesday; these are **assumptions made without an answer from the client**.

## Decisions

| Concept | Options considered | Choice | If the assumption is wrong |
|---|---|---|---|
| User | `hashed_ip` · IP + user-agent · IPs joined by conversation | **`hashed_ip`**: simple and the same key as the data team's report | IP + user-agent: 20.2% (+1.8 pp); joined IPs: 18.1% (−0.3 pp) |
| Use event | start of a conversation · each assistant answer | **Each answer** (Q1, Q3) | Only the start of a conversation: 17.1% (−1.3 pp) |
| What "coming back" is | new session (pause > 15/30/60 min) · use on another calendar day | **Rev. 1: use on another local day, D+1 to D+7.** The PDF talks about "in which time zone a day counts"; 78% of the session-based returns were hours later, on the same day | New session > 30 min: 28.1% (+9.7 pp). It is **the most sensitive assumption** and it appears on the screen |
| First experience | 1st conversation · 1st session · 1st day | **Rev. 1: 1st local day** (consistent with the return) | — |
| Window | 3 · 7 · 14 days | **7 days** (the PDF's question) | 3 days: 15.8%; 14 days: 19.8% |
| Period and censoring | whole base · cuts at the ends | **Whole base with cuts**: the first 14 days are excluded (false "new") and so is anyone who started < 8 days before the end (incomplete window) | No cuts: 18.3–18.7% (≤ 0.3 pp) |
| Anomalous IPs | exclude · keep flagged | **Keep**, flagged (≥ 10 user-agents) | Exclude: 18.3% (−0.1 pp) |
| Time zone of the day | UTC · `America/Sao_Paulo` | **`America/Sao_Paulo`** | UTC: 19.6% (+1.2 pp) |

## Consequences

- Reference 7-day return: **18.4% (95% CI: 16.8–20.0)**, 2,266 eligible users.
- Every screen shows the definition of "coming back" and the sensitivity range (18.4% by day × 28.1% by session).
- The measured return is a **lower bound**: the public dataset excludes toxic conversations (Q10), so whoever came back with one of them does not appear.
- Changing any rule breaks `tests/test_definicoes.py`: the change has to be deliberate and recorded here.
