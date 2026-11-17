<!-- traduzido de: 17b1fbf62df5 -->
# BDR-001 · Definiciones de usuario, uso, sesión y retorno en 7 días

**Decidido por:** Ricardo · **Estado:** aprobado · **Revisión 1:** retorno por día calendario
**Evidencia:** `docs/analise/01-qualidade.md`, `docs/analise/02-definicoes.md` (sensibilidad) · **Código:** `analise/definicoes.py` + `tests/test_definicoes.py`

## Contexto

La base no tiene identificador de usuario (PDF §2.1), y el PDF deja abierto qué cuenta como uso, cómo agrupar en sesiones, el huso horario y el período (§2.3). Las dudas al cliente cerraron el miércoles; estas son **premisas asumidas sin respuesta del cliente**.

## Decisiones

| Concepto | Opciones consideradas | Elección | Si la premisa está equivocada |
|---|---|---|---|
| Usuario | `hashed_ip` · IP + user-agent · IPs unidas por la conversación | **`hashed_ip`**: simple e igual a la clave del informe del equipo de datos | IP + user-agent: 20,2% (+1,8 pp); IPs unidas: 18,1% (−0,3 pp) |
| Evento de uso | inicio de conversación · cada respuesta del asistente | **Cada respuesta** (Q1, Q3) | Solo inicio de conversación: 17,1% (−1,3 pp) |
| Qué es "volver" | nueva sesión (pausa > 15/30/60 min) · uso en otro día calendario | **Rev. 1: uso en otro día local, D+1 a D+7.** El PDF habla de "en qué huso horario cuenta un día"; el 78% de los retornos por sesión eran horas después, el mismo día | Nueva sesión > 30 min: 28,1% (+9,7 pp). Es **la premisa más sensible** y aparece en la pantalla |
| Primera experiencia | 1.ª conversación · 1.ª sesión · 1.er día | **Rev. 1: 1.er día local** (coherente con el retorno) | — |
| Ventana | 3 · 7 · 14 días | **7 días** (la pregunta del PDF) | 3 días: 15,8%; 14 días: 19,8% |
| Período y censura | base entera · cortes en los extremos | **Base entera con cortes**: se excluyen los primeros 14 días (falso "nuevo") y quien empezó a < 8 días del final (ventana incompleta) | Sin cortes: 18,3–18,7% (≤ 0,3 pp) |
| IPs anómalas | excluir · mantener marcadas | **Mantener**, marcadas (≥ 10 user-agents) | Excluir: 18,3% (−0,1 pp) |
| Huso del día | UTC · `America/Sao_Paulo` | **`America/Sao_Paulo`** | UTC: 19,6% (+1,2 pp) |

## Consecuencias

- Retorno en 7 días de referencia: **18,4% (IC 95%: 16,8–20,0)**, 2.266 usuarios elegibles.
- Cada pantalla muestra la definición de "volver" y la franja de sensibilidad (18,4% por día × 28,1% por sesión).
- El retorno medido es un **límite inferior**: la base pública excluye las conversaciones tóxicas (Q10), así que quien volvió con una de ellas no aparece.
- Cambiar cualquier regla rompe `tests/test_definicoes.py`: el cambio tiene que ser deliberado y registrado aquí.
