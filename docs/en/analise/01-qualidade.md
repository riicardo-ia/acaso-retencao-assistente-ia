<!-- traduzido de: 7333ba6925a5 -->
# Step 1 · Data quality (raw layer, Brazil)

**Source:** `allenai/WildChat-1M` (HuggingFace), 14 files, 837,989 conversations → **11,621 with `country = 'Brazil'`**.
**Reproduction:** `python -m analise.qualidade` (each number below comes from a named query in the script).

## Problems found and how each was handled

| # | Problem | Evidence | Impact if ignored | Handling |
|---|---|---|---|---|
| Q1 | **Only the assistant has a time.** User messages have no `timestamp` | 26,579 of 26,579 user messages with no time; 0 of 26,579 from the assistant | The exact time of the question is unknown | The start of the conversation is the time of the **1st answer** (`conversation[2].timestamp`). Difference from the question: seconds |
| Q2 | **`timestamp` is the last turn**, not the start | Duration p90 = 21 min, p99 = 5.8 h | Using `timestamp` as the "first time" shifts the cohort and can turn the 1st conversation itself into a "return" (one of the flaws in the §4.2 incident) | Start = Q1; `timestamp` only as the end |
| Q3 | **Conversations reopened later**: the person goes back to an old conversation instead of opening a new one | 664 conversations with a pause > 30 min between answers; 37 last more than 1 day | Counting a return only by "new conversation" misses whoever came back in an old one | Measure use by the **time of each answer**, not only by the start of the conversation (decided in Step 2) |
| Q4 | **`conversation_hash` is not a key** | 11,555 hashes for 11,621 conversations; 27 repeated groups, all from different IPs, median 1st message of 2 characters ("hi") | Deduplicating by hash would delete real conversations of different people | Key = 1st `turn_identifier` (unique in all 11,621; no turn repeats across rows) |
| Q5 | **Resend**: same 1st message, same IP, in less than 10 min | 386 cases | Would inflate the "return" if each resend counted as coming back | Group into a **session** (minimum pause between uses, measured in Step 2) |
| Q6 | **The IP changes within the same conversation** | 175 conversations | `hashed_ip` splits the same person in two (mobile network, Wi-Fi → 4G); return underestimated | Alternative measured in Step 2: join IPs that appear in the same conversation |
| Q7 | **Shared or automated IP** | The largest IP has 1,557 conversations (13.4% of the total), 35 user-agents, 28 languages, 129 active days, a single state (it alone explains Piauí being the 3rd state) | Dominates any chart by conversation; in retention it weighs as 1 "user" that is actually several | EDA by user (not by conversation) and sensitivity with and without anomalous IPs |
| Q8 | **Language unreliable in short messages** | 714 first messages with < 10 characters; "Finnish", "Maori", "Sotho", "Nolang" with a median message of 2 to 5 characters | "Language" factor with false categories | Language in 3 groups (Portuguese, English, other) + a short-message indicator |
| Q9 | **Empty user message** | 273 conversations | Length and topic meaningless in these cases | Its own indicator; topic = "no content" |
| Q10 | **`toxic` is always false** | 0 of 11,621 | The variable discriminates nothing (the public version of WildChat-1M excludes toxic conversations) | Left out of the analysis; recorded as missing data |
| Q11 | **GPT-4 availability changes over time** | % GPT-4 per month: 13–16% (Apr–Jun/23), **0% (Jul–Oct/23)**, 15% (Nov/23), **75–94% (Dec/23–Apr/24)** | Comparing GPT-4 × GPT-3.5 without controlling for the period mixes the effect of the model with the effect of the period | Comparison always **within the period** (cohort control); the change of regime is investigated in Step 6 |
| Q12 | Few null fields | `state` null in 51; `redacted` in 56; no null user-agent | Low | Null `state` becomes "not informed" |

## Checks that passed

- Every conversation starts with a user message, and `len(conversation) = 2 × turn` in all of them.
- No start after the end.
- No week without data between Apr/2023 and Apr/2024 (the 1st week is partial, with 14 conversations).
- 60% of the IPs (1,424 of 2,385) have a single conversation.
