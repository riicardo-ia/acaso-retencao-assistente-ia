<!-- traduzido de: 9e102781062a -->
# BDR-002 · List of conversation topics

**Decided by:** Ricardo · **Status:** approved
**Evidence:** `docs/analise/05-temas.md` · **Code:** `analise/classificar.py`

## Context

The PDF asks for the topic of the 1st experience as a variable. The dataset has no topic; it has to be assigned from the text, and the list of topics is a business decision: it defines how the client will see the use of the assistant.

## Options considered

| Option | Why not / why |
|---|---|
| Let the LLM create topics freely | Categories change on every run; impossible to track over time |
| Classify by the 1st message | The 1st message is often just "hi" or a test; the real subject comes later |
| **Closed list, discovered in the data and reviewed by hand, applied to the whole conversation** | Chosen |

## Decision

11 topics: study and academic work · programming and technology · rewriting, summaries and translation · marketing and professional content · fiction, roleplay and creative writing · general knowledge and curiosities · everyday life and advice · **asks for an image, video or audio** · **tries to get around the rules** · **only greets or tests the assistant** · other.

- The three in bold are kept separate even though they are small: they measure where the assistant fails or refuses, and the PDF asks "where it fails".
- The **main request** of the conversation is what counts; "only greets or tests" is only for conversations that just test.
- Topics with fewer than 30 people in the 1st conversation become "other" in the model.

## Consequences

- Findings 1 and 3 in `docs/DOCUMENTO.md` depend on this list.
- Changing the list requires reclassifying and revalidating (`analise/validar_temas.py`).
