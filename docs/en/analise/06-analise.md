<!-- traduzido de: 88a63d2b5b8c -->
# Step 6 · The answer: what makes people who tried the assistant come back within 7 days

**Client question:** what makes a person who tried the assistant come back to use it within 7 days? Which factors have the largest effect, how much does each one weigh, and how much of it is cause and not selection?
**Reproduction:** `python -m analise.tabela && python -m analise.efeitos && python -m analise.semana 2023-11-20`.

**Base:** 2,266 people who used the assistant for the 1st time between Apr/2023 and Apr/2024 (Brazil). **18.4% came back** on another day, between the 1st and the 7th day (95% CI: 16.8–20.0). Definitions: [BDR-001](../bdr/BDR-001-definicoes-de-uso-e-retorno.md).

## 1. Effect of each factor, with uncertainty, ordered by size

![Effects](img/09-efeitos.png)

**Method.** Logistic regression with all factors at once and the period (GPT-4 availability regime) as a control; the effect is the **average marginal effect**: how many percentage points the return changes when the factor is present, with everything else equal. 95% CI by the delta method, robust errors (HC1). The model converged (pseudo-R² = 0.059: the 1st experience explains little of the return, which is expected with so little information per person).

| Factor (against the reference) | n | Return | Raw (pp) | **Adjusted (pp) [95% CI]** | Reading |
|---|---:|---:|---:|---:|---|
| 1st conversation **only greets or tests** (vs. general knowledge) | 330 | 6.4% | −14.8 | **−15.6 [−19.6; −11.6]** | Clear effect |
| 1st conversation **asks for an image, video or audio** | 99 | 6.1% | −15.1 | **−14.7 [−18.7; −10.7]** | Clear effect |
| **Phone** (vs. computer) | 723 | 13.6% | −7.1 | **−7.9 [−11.3; −4.4]** | Clear effect |
| Started **at night** (vs. afternoon) | 748 | 22.9% | +6.2 | +6.4 [+2.4; +10.5] | Partly an **effect of the definition**: whoever starts at 11 pm and keeps going after midnight already "came back on another day" |
| 1st conversation about **study** | 387 | 17.6% | −3.6 | −5.4 [−10.4; −0.5] | Small effect, at the limit |
| 1st conversation tries to **get around the rules** | 61 | 11.5% | −9.7 | −6.7 [−15.2; +1.7] | Inconclusive (small n) |
| Long average answer (≥ 1,200 characters) | 1,133 | 22.0% | +7.2 | +3.6 [−0.1; +7.3] | Inconclusive; half of the raw difference was confounding |
| **Refusal or limitation in the 1st answer** | 93 | 14.0% | −4.6 | −3.5 [−11.4; +4.4] | Inconclusive (small n) |
| **1st conversation with GPT-4** | 961 | 18.7% | +0.6 | **−1.1 [−5.8; +3.6]** | **No detectable effect** |
| 1st message with < 10 characters | 461 | 12.1% | −7.8 | +0.1 [−5.0; +5.1] | The raw difference was the "only tests" topic: absorbed |
| Others (language, weekend, other topics) | — | — | — | CI crosses zero | Inconclusive |

**Mediators (outside the main model, because they happen together with the outcome):** people with **5 or more turns on the 1st day** come back 31.2% (+17.1 pp raw); people who use **more than one topic on the 1st day**, 29.9% (+13.2 pp). They describe *how* the return happens (engagement), not *why*: they are not levers the product pulls directly.

**Answer quality (sub-analysis).** Among the 1,149 people who sent more than one message in the 1st conversation, those who corrected, repeated or complained (342) come back 21.9% against 22.2%: **−2.1 pp [−7.2; +3.0]**, inconclusive. The dissatisfaction signal is stable (κ = 0.93 between two runs of the classifier), so the absence of an effect is not measurement noise.

## 2. Cause or selection?

**What may confound.** Whoever chooses GPT-4 may already be more engaged; whoever starts with "hi" may just be curious; whoever uses a computer may be working. The confounders handled:

| Confounder | How it was handled |
|---|---|
| Period (GPT-4 availability goes from 0% to 94% over the year) | Control in the model; IPW without the period when GPT-4 did not exist |
| Intent on arrival (short message, just testing) | Topic of the 1st conversation and length of the 1st message in the model |
| Profile (device, language, time of day, day) | In the model and in the propensity score |
| Engagement | Kept **out** as a mediator: controlling for it would erase exactly the effect of a good 1st experience |

**GPT-4: three estimates agree that the model does not change the return.**

| Estimate | Difference in return (pp) [95% CI] |
|---|---:|
| Raw | +0.6 |
| Adjusted (regression) | −1.1 [−5.8; +3.6] |
| **IPW** (propensity score with period, time of day, day, device, language, length of the 1st message and topic; the largest imbalance between groups drops from 1.48 to 0.21 standard deviations) | +2.9 [−1.7; +7.3] |
| **When the person chose GPT-4** (Apr–Jun/23 and Nov/23) | +1.7 [−3.6; +7.5] |
| **When GPT-4 was the default** (Dec/23–Apr/24, ~90% of conversations) | +1.3 [−8.0; +8.4] |

If choosing GPT-4 were a selection of more engaged people, the effect would be larger when the person chose it than when it was the default; both are equal and compatible with zero. **Conclusion: there is no effect of the model on the return that this data can detect, and no sign of relevant selection.**

**Arrival topics ("only tests", "asks for an image"): part selection, part product.** "Only tests" mainly measures the intent of whoever arrived (the assistant does not choose who arrives curious), but the product's answer to those who arrive like this is a lever. "Asks for an image" is different: the person arrived with a concrete need that a text assistant **does not meet** (20.7% of these conversations have a refusal or stated limitation, against 5.2% in the rest). It is an observable product failure.

**What the analysis proves and what it does not.**
- **Proves (with the uncertainty of the CIs):** whoever arrives just testing or asking for an image comes back much less, even comparing people with the same device, language, time of day and period; and the choice of model does not change the return.
- **Does not prove:** that changing the 1st experience of these people will make them come back. Without an experiment, unobserved confounding is possible (motivation, real need). Causal proof requires an **A/B test** of the proposed change.
- **Does not measure:** whoever came back with toxic conversations (removed from the public dataset: the return is a lower bound) and people who change IP (user = IP).

## 3. The week that changed: 11/20/2023

| | New | Came back | Return |
|---|---:|---:|---:|
| 4 previous weeks (10/23–11/19) | 188 | 43 | 22.9% |
| **Week of 11/20/2023** | 64 | 8 | **12.5%** |
| Difference | | | **−10.4 pp** (p = 0.044) |

**Why this week:** it is the week of the incident in the brief and, in the real data, it is also an atypical week: 64 people arrived, against ~47 per week in the previous ones, right after GPT-4 came back to the assistant.

**Did the profile change, or the rate?** Kitagawa decomposition (Δ = mix + rate):

| Segmentation | Mix (profile of who arrived) | Rate (return within each profile) |
|---|---:|---:|
| Real request × only tests / asks for an image / gets around rules | −0.4 pp | **−10.0 pp** |
| Computer × phone | +0.3 pp | **−10.7 pp** |
| GPT-4 × GPT-3.5 | −0.4 pp | **−10.0 pp** |

**The profile of who arrived practically did not change** (the share of "only tests" went from 19% to 22%, the share of phone from 26% to 22%); **the drop is in the rate**, concentrated in people who arrived with a real request on a computer (from 27% to 14%).

**But the drop is probably chance.** With ~50 people per week, the natural swing is large: the homogeneity test across the 37 weeks with n ≥ 30 **does not reject** that all of them have the same return (χ² = 42.6; 36 df; **p = 0.21**). This week's p = 0.044, alone, does not survive the comparison with 37 weeks (~2 weeks like this would be expected by chance alone). **Decision this supports:** the dashboard should not raise alarms on weekly variation; it shows the range expected by chance and uses a 4-week moving window for the trend.

## 4. Three findings for the client and the decision each one supports

| # | Finding | Decision |
|---|---|---|
| 1 | **1 in every 5 people arrives just testing (14.6%) or asking for an image/video/audio (4.4%), and these people come back ~6%, against ~21% of those who arrive with a real request** (−15 pp, adjusted effect). | Redesign the **1st answer for those who just test** (show 3 concrete uses with clickable examples) and **answer image requests** with a useful alternative (describe, write the prompt, point to the tool) instead of just refusing. Validate with A/B. Potential: closing half of the gap in these groups = **+1.4 pp in the total return**. |
| 2 | **The model (GPT-4 × GPT-3.5) does not change the return**, neither when the person chooses it nor when it is the default. | **Do not use a more expensive model as a retention lever**: invest in the 1st experience, not in the model. |
| 3 | **People who arrive on a phone come back 8 pp less** with the same topic, language, time of day and period. | **Audit the phone experience** (loading, keyboard, format of long answers) and test an optimized version in A/B; until then, treat phone as a risk segment in the monitoring. |

## 5. Suggestions that came from the data

**For the assistant:** treat "just testing" as a discovery intent (onboarding with examples); for image/media requests, a useful answer instead of "I can't"; attention to study topics (−5 pp), where the answer may be less aligned with what the student needs.

**For the dashboard**, indicators thought of only after looking at the data:
- **% of arrivals "just testing" or "asking for media"** per week: the largest factor of not coming back, trackable;
- **return by device** as a fixed segment;
- **range expected by chance** in each weekly cohort, so as not to raise alarms on noise;
- **sensitivity of the definition** visible ("if coming back on the same day counted, it would be 28%").

## 6. What the data allows, what it does not, and what is missing

| Allows | Does not allow | Would be needed to answer better |
|---|---|---|
| Comparing who came back and who did not by the 1st experience | Identifying the person (only the IP; the same person on 2 networks becomes 2) | **User ID** (login or cookie) |
| Measuring associated effects with uncertainty and adjustment for observed confounding | Proving cause without an experiment | **A/B tests** of onboarding and of the answer to image requests |
| Classifying topics and dissatisfaction signals from the text | Knowing whether the person was satisfied | **Rating of the answer by the user** (like or dislike) |
| Seeing the time of each answer | Seeing the time of each question (only the assistant has a time) | Time of the user's messages |
| Measuring the return of those who stayed in the base | Seeing toxic conversations (removed from the public dataset) | The complete dataset |
