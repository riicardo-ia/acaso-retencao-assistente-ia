<!-- traduzido de: aa75a964cbd5 -->
# Paso 2 · Definiciones y sensibilidad del retorno en 7 días

**Reproducción:** `python -m analise.sensibilidade` · definiciones en `analise/definicoes.py`, trabadas por `tests/test_definicoes.py`.

## Revisión 1: retorno por día calendario

En la revisión de los pasos, el texto del PDF §2.3 ("en qué huso horario **cuenta un día**") mostró que el retorno debe medirse en **días calendario**: en la regla por sesión el huso no cambiaba nada. Además, el 78% de los "retornos" por sesión ocurrían en las primeras 24 h, en buena parte la misma persona volviendo horas después el mismo día. La referencia pasó a ser **uso en otro día local (D+1 a D+7)**, y la regla por sesión pasó a ser sensibilidad ([BDR-001](../bdr/BDR-001-definicoes-de-uso-e-retorno.md), rev. 1).

## Definiciones de referencia

| Concepto | Definición | Origen de la elección |
|---|---|---|
| Usuario | `hashed_ip` | No hay ID de usuario (PDF §2.1) |
| Evento de uso | cada **respuesta del asistente** (hora del mensaje) | Solo el asistente tiene hora (Q1); captura a quien vuelve a una conversación antigua (Q3) |
| Primera experiencia | todo el uso del **1.er día local** (`America/Sao_Paulo`) | Coherente con el retorno por día |
| Retorno en 7 días | algún uso en **otro día local, de D+1 a D+7** | "Volver a usar" = volver otro día; PDF §2.3 |
| Cohorte | semana (lunes a domingo) del 1.er día, en el huso local | — |
| Elegible | 1.er día ≥ 14 días después del inicio de la base y ≥ 8 días antes del fin | Evita un falso "nuevo" y un falso "no volvió" |

## Sensibilidad (cada fila cambia UNA elección)

| Escenario | Usuarios | Volvieron | Retorno | IC 95% | Δ vs. referencia |
|---|---:|---:|---:|---|---:|
| **Referencia: otro día local, D+1 a D+7** | 2.266 | 416 | **18,4%** | 16,8–20,0 | — |
| Regla anterior: nueva sesión (pausa > 30 min) hasta 7 × 24 h | 2.266 | 637 | 28,1% | 26,3–30,0 | **+9,7 pp** |
| └ sesión con pausa de 15 min | 2.266 | 757 | 33,4% | 31,5–35,4 | +15,0 pp |
| └ sesión con pausa de 60 min | 2.266 | 558 | 24,6% | 22,9–26,4 | +6,2 pp |
| Usuario = IP + user-agent | 2.747 | 554 | 20,2% | 18,7–21,7 | +1,8 pp |
| Usuario = IPs unidas por la conversación (Q6) | 2.197 | 397 | 18,1% | 16,5–19,7 | −0,3 pp |
| Uso = solo inicio de conversación | 2.266 | 387 | 17,1% | 15,6–18,7 | −1,3 pp |
| Ventana de 3 días | 2.292 | 363 | 15,8% | 14,4–17,4 | −2,6 pp |
| Ventana de 14 días | 2.212 | 439 | 19,8% | 18,2–21,6 | +1,4 pp |
| Sin cortar las 2 primeras semanas | 2.330 | 435 | 18,7% | 17,1–20,3 | +0,3 pp |
| Sin cortar el fin | 2.311 | 423 | 18,3% | 16,8–19,9 | −0,1 pp |
| Sin IPs anómalas (≥ 10 user-agents) | 2.264 | 414 | 18,3% | 16,7–19,9 | −0,1 pp |
| Día contado en UTC | 2.266 | 445 | 19,6% | 18,1–21,3 | +1,2 pp |

## Lectura

- **Lo que cuenta como "volver" es la elección que más mueve el número**: 18,4% (otro día) frente a 28,1% (una nueva sesión el mismo día ya cuenta). La pantalla muestra la definición y esa franja.
- **El huso ahora importa** (+1,2 pp en UTC): quien usa cerca de la medianoche cambia de día.
- **La definición de usuario mueve poco** (−0,3 a +1,8 pp). Sumar el user-agent *aumenta* el retorno porque divide las IPs compartidas en varios "usuarios" muy activos.
- **Los cortes de censura y las IPs anómalas casi no mueven el total.**
- **Las cohortes semanales son pequeñas:** 16 de 53 semanas tienen menos de 30 usuarios nuevos; la desviación estándar entre semanas (6,1 pp) es cercana a lo que produce el azar con ~43 personas por semana (≈ 5,9 pp). Esto condiciona el Paso 6.

## Decisión

Referencia original aprobada y después revisada (**revisión 1**: retorno por día calendario) → [`BDR-001`](../bdr/BDR-001-definicoes-de-uso-e-retorno.md).
