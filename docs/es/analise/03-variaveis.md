<!-- traduzido de: a92510798741 -->
# Paso 3 · Variables de la 1.ª experiencia

**Unidad:** una fila por usuario elegible (2.266; BDR-001 rev. 1). La 1.ª experiencia es el **1.er día local de uso**: solo entran las conversaciones que empiezan en él. La **1.ª conversación** es la que empieza primero (hora de la 1.ª respuesta, Q1); empate: menor `conv_id`.
**Reproducción:** `python -m analise.tabela` → `data/tmp/usuarios.parquet` · reglas en `analise/variaveis.py`, probadas en `tests/test_variaveis.py`.

> Los números de "retorno bruto" de abajo (retorno en otro día, D+1 a D+7; promedio 18,4%) son **solo descriptivos**, para verificar volumen y distribución. Aquí no se afirma ningún efecto: el efecto ajustado, con incertidumbre y control de confusión, es el Paso 6.

## Diccionario

| Variable | Cómo se deriva | Valores: n (retorno bruto) | Observación |
|---|---|---|---|
| `gpt4` | `model` de la **1.ª conversación** empieza con `gpt-4` | sí 961 (18,7%) · no 1.305 (18,1%) | La oferta cambia con la época (Q11) → siempre con `periodo` |
| `tema` | tema de la **1.ª conversación** (clasificación cerrada con gpt-5.4, Paso 5) | 11 temas; de saludo/prueba 330 (6,4%) e imagen/medios 99 (6,1%) a marketing 330 (26,4%) y reescritura 120 (26,7%) | Los temas con n < 30 pasan a "otro" en el modelo |
| `varios_temas` | la 1.ª experiencia tiene conversaciones de más de un tema | sí 288 (29,9%) · no 1.978 (16,7%) | Atención: engagement (exige más de una conversación el 1.er día) |
| `idioma` | `language` de la 1.ª conversación en 3 grupos | portugués 1.547 (18,4%) · inglés 445 (21,6%) · otro 274 (13,1%) | "Otro" mezcla idiomas reales y detección fallida en mensajes cortos (Q8) |
| `dispositivo` | el user-agent contiene mobile/android/iphone/ipad | computadora 1.543 (20,6%) · celular 723 (13,6%) | — |
| `recusa_1a` | **la 1.ª respuesta** de la 1.ª conversación tiene rechazo o limitación declarada (regex PT/EN en los primeros 400 caracteres) | sí 93 (14,0%) · no 2.173 (18,6%) | Medida en la 1.ª respuesta, antes de cualquier engagement. "Algún rechazo el 1.er día" se descartó: sube con el n.º de respuestas (quien conversa más recibe más rechazos) y creaba un efecto positivo falso |
| `msg_curta` | 1.er mensaje con < 10 caracteres | sí 461 (12,1%) · no 1.805 (19,9%) | Señal de **intención** al llegar → confusor |
| `tam_msg1` | caracteres del 1.er mensaje | p25 18 · p50 58 · p75 186 · p90 920 | Asimétrica → log en el modelo |
| `tam_resposta_media` | promedio de caracteres de las respuestas del 1.er día | p25 448 · p50 1.202 · p75 1.990 · p90 2.903 | Aproximación del "tamaño de la respuesta" |
| `turnos_exp1` | suma de `turn` de las conversaciones del 1.er día | p25 1 · p50 2 · p75 5 · p90 9 | Atención: **mediador / engagement** |
| `conversas_exp1` | conversaciones abiertas el 1.er día | p50 1 · p75 2 · p90 3 | Atención: el mismo cuidado que `turnos_exp1` |
| `faixa_horaria` | hora local del inicio | madrugada 239 (12,6%) · mañana 525 (17,0%) · tarde 754 (16,7%) · noche 748 (22,9%) | Atención: con el retorno por día calendario, quien empieza de noche está a pocas horas de D+1 (seguir después de la medianoche ya cuenta como "otro día"): **efecto mecánico de la definición**, controlado en el modelo |
| `fim_de_semana` | sábado o domingo en hora local | sí 577 (18,0%) · no 1.689 (18,5%) | — |
| `periodo` | régimen de oferta de GPT-4 (Q11) | abr–jun/23 666 (18,2%) · jul–oct/23 590 (18,8%) · nov/23 227 (17,6%) · dic/23–abr/24 783 (18,4%) | **Control**, no factor de producto |
| `insatisfacao` | señal de insatisfacción en la 1.ª conversación, elegida por el LLM | evaluable en 1.149 (quien mandó > 1 mensaje): insatisfecho 342 | Subanálisis en el Paso 6 (solo existe con un 2.º mensaje); estable con gpt-5.4 (κ = 0,93) |
| `redacted` | alguna conversación del 1.er día con dato personal anonimizado | sí **17** | n < 30: fuera del modelo |

## Fuera del análisis

- `toxic`: siempre falso en la base pública (Q10).
- `state`: el 3.er estado (Piauí) es casi todo una única IP (Q7); usar el estado llevaría a una conclusión falsa.
