<!-- traduzido de: 88a63d2b5b8c -->
# Paso 6 · La respuesta: qué hace que quien probó el asistente vuelva en 7 días o menos

**Pregunta del cliente:** ¿qué hace que una persona que probó el asistente vuelva a usarlo en 7 días o menos? ¿Qué factores tienen el mayor efecto, cuánto pesa cada uno y cuánto de eso es causa y no selección?
**Reproducción:** `python -m analise.tabela && python -m analise.efeitos && python -m analise.semana 2023-11-20`.

**Base:** 2.266 personas que usaron el asistente por 1.ª vez entre abr/2023 y abr/2024 (Brasil). **El 18,4% volvió** otro día, entre el 1.er y el 7.º día (IC 95%: 16,8–20,0). Definiciones: [BDR-001](../bdr/BDR-001-definicoes-de-uso-e-retorno.md).

## 1. Efecto de cada factor, con incertidumbre, ordenado por tamaño

![Efectos](img/09-efeitos.png)

**Método.** Regresión logística con todos los factores a la vez y la época (régimen de oferta de GPT-4) como control; el efecto es el **efecto marginal medio**: cuántos puntos porcentuales cambia el retorno cuando el factor está presente, con todo lo demás igual. IC 95% por el método delta, errores robustos (HC1). El modelo convergió (pseudo-R² = 0,059: la 1.ª experiencia explica poco del retorno, lo esperado con tan poca información por persona).

| Factor (frente a la referencia) | n | Retorno | Bruto (pp) | **Ajustado (pp) [IC 95%]** | Lectura |
|---|---:|---:|---:|---:|---|
| 1.ª conversación **solo saluda o prueba** (vs. conocimiento general) | 330 | 6,4% | −14,8 | **−15,6 [−19,6; −11,6]** | Efecto claro |
| 1.ª conversación **pide imagen, video o audio** | 99 | 6,1% | −15,1 | **−14,7 [−18,7; −10,7]** | Efecto claro |
| **Celular** (vs. computadora) | 723 | 13,6% | −7,1 | **−7,9 [−11,3; −4,4]** | Efecto claro |
| Empezó **de noche** (vs. tarde) | 748 | 22,9% | +6,2 | +6,4 [+2,4; +10,5] | En parte **efecto de la definición**: quien empieza a las 23h y sigue después de la medianoche ya "volvió otro día" |
| 1.ª conversación de **estudio** | 387 | 17,6% | −3,6 | −5,4 [−10,4; −0,5] | Efecto pequeño, en el límite |
| 1.ª conversación intenta **saltarse las reglas** | 61 | 11,5% | −9,7 | −6,7 [−15,2; +1,7] | No concluyente (n pequeño) |
| Respuesta media larga (≥ 1.200 caracteres) | 1.133 | 22,0% | +7,2 | +3,6 [−0,1; +7,3] | No concluyente; la mitad de lo bruto era confusión |
| **Rechazo o limitación en la 1.ª respuesta** | 93 | 14,0% | −4,6 | −3,5 [−11,4; +4,4] | No concluyente (n pequeño) |
| **1.ª conversación con GPT-4** | 961 | 18,7% | +0,6 | **−1,1 [−5,8; +3,6]** | **Sin efecto detectable** |
| 1.er mensaje con < 10 caracteres | 461 | 12,1% | −7,8 | +0,1 [−5,0; +5,1] | Lo bruto era el tema "solo prueba": absorbido |
| Demás (idioma, fin de semana, otros temas) | — | — | — | El IC cruza el cero | No concluyente |

**Mediadores (fuera del modelo principal, porque ocurren junto con el resultado):** quien tiene **5 o más turnos el 1.er día** vuelve el 31,2% (+17,1 pp bruto); quien usa **más de un tema el 1.er día**, el 29,9% (+13,2 pp). Describen *cómo* ocurre el retorno (engagement), no *por qué*: no son palancas que el producto mueva directamente.

**Calidad de la respuesta (subanálisis).** Entre las 1.149 personas que mandaron más de un mensaje en la 1.ª conversación, las que corrigieron, repitieron o se quejaron (342) vuelven el 21,9% frente al 22,2%: **−2,1 pp [−7,2; +3,0]**, no concluyente. La señal de insatisfacción es estable (κ = 0,93 entre dos ejecuciones del clasificador), así que la ausencia de efecto no es ruido de medición.

## 2. ¿Causa o selección?

**Qué puede confundir.** Quien elige GPT-4 puede estar ya más comprometido; quien empieza con "hola" puede estar solo curioso; quien usa computadora puede estar trabajando. Los confusores tratados:

| Confusor | Cómo se trató |
|---|---|
| Época (la oferta de GPT-4 pasa de 0% a 94% a lo largo del año) | Control en el modelo; IPW sin el período en que GPT-4 no existía |
| Intención al llegar (mensaje corto, solo probar) | Tema de la 1.ª conversación y tamaño del 1.er mensaje en el modelo |
| Perfil (dispositivo, idioma, horario, día) | En el modelo y en el puntaje de propensión |
| Engagement | Mantenido **fuera** como mediador: controlar por él borraría justamente el efecto de una buena 1.ª experiencia |

**GPT-4: tres estimaciones coinciden en que el modelo no cambia el retorno.**

| Estimación | Diferencia en el retorno (pp) [IC 95%] |
|---|---:|
| Bruta | +0,6 |
| Ajustada (regresión) | −1,1 [−5,8; +3,6] |
| **IPW** (puntaje de propensión con época, horario, día, dispositivo, idioma, tamaño del 1.er mensaje y tema; el mayor desequilibrio entre grupos baja de 1,48 a 0,21 desviaciones estándar) | +2,9 [−1,7; +7,3] |
| **Cuando la persona elegía GPT-4** (abr–jun/23 y nov/23) | +1,7 [−3,6; +7,5] |
| **Cuando GPT-4 era el predeterminado** (dic/23–abr/24, ~90% de las conversaciones) | +1,3 [−8,0; +8,4] |

Si elegir GPT-4 fuera selección de gente más comprometida, el efecto sería mayor cuando la persona lo elegía que cuando era el predeterminado; los dos son iguales y compatibles con cero. **Conclusión: no hay un efecto del modelo sobre el retorno que estos datos logren detectar, ni señal de selección relevante.**

**Temas de llegada ("solo prueba", "pide imagen"): parte es selección, parte es producto.** "Solo prueba" mide sobre todo la intención de quien llegó (el asistente no elige quién llega curioso), pero la respuesta del producto a quien llega así es una palanca. "Pide imagen" es distinto: la persona llegó con una necesidad concreta que un asistente de texto **no atiende** (el 20,7% de esas conversaciones tiene rechazo o limitación declarada, frente al 5,2% en el resto). Es una falla de producto observable.

**Qué prueba el análisis y qué no prueba.**
- **Prueba (con la incertidumbre de los IC):** quien llega solo probando o pidiendo imagen vuelve mucho menos, aun comparando personas con el mismo dispositivo, idioma, horario y época; y la elección del modelo no cambia el retorno.
- **No prueba:** que cambiar la 1.ª experiencia de esas personas hará que vuelvan. Sin experimento, es posible una confusión no observada (motivación, necesidad real). La prueba causal exige una **prueba A/B** del cambio propuesto.
- **No mide:** a quien volvió con conversaciones tóxicas (retiradas de la base pública: el retorno es un límite inferior) ni a las personas que cambian de IP (usuario = IP).

## 3. La semana que cambió: 20/11/2023

| | Nuevos | Volvieron | Retorno |
|---|---:|---:|---:|
| 4 semanas anteriores (23/10–19/11) | 188 | 43 | 22,9% |
| **Semana del 20/11/2023** | 64 | 8 | **12,5%** |
| Diferencia | | | **−10,4 pp** (p = 0,044) |

**Por qué esta semana:** es la semana del incidente del enunciado y, en la base real, también es una semana atípica: llegaron 64 personas, frente a ~47 por semana en las anteriores, justo después de la vuelta de GPT-4 al asistente.

**¿Cambió el perfil o la tasa?** Descomposición de Kitagawa (Δ = mezcla + tasa):

| Segmentación | Mezcla (perfil de quien llegó) | Tasa (retorno dentro de cada perfil) |
|---|---:|---:|
| Pedido real × solo prueba / pide imagen / se salta reglas | −0,4 pp | **−10,0 pp** |
| Computadora × celular | +0,3 pp | **−10,7 pp** |
| GPT-4 × GPT-3.5 | −0,4 pp | **−10,0 pp** |

**El perfil de quien llegó prácticamente no cambió** (la fracción de "solo prueba" pasó del 19% al 22%, la de celular del 26% al 22%); **la caída está en la tasa**, concentrada en quien llegó con un pedido real desde la computadora (del 27% al 14%).

**Pero la caída probablemente es azar.** Con ~50 personas por semana, la oscilación natural es grande: la prueba de homogeneidad entre las 37 semanas con n ≥ 30 **no rechaza** que todas tengan el mismo retorno (χ² = 42,6; 36 gl; **p = 0,21**). El p = 0,044 de esta semana, aislado, no sobrevive a la comparación con 37 semanas (se esperarían ~2 semanas así solo por azar). **Decisión que esto sostiene:** el dashboard no debe alarmar con la variación semanal; muestra la franja esperada por el azar y usa una ventana móvil de 4 semanas para la tendencia.

## 4. Tres hallazgos para el cliente y la decisión que sostiene cada uno

| # | Hallazgo | Decisión |
|---|---|---|
| 1 | **1 de cada 5 personas llega solo probando (14,6%) o pidiendo imagen/video/audio (4,4%), y esas personas vuelven ~6%, frente a ~21% de quien llega con un pedido real** (−15 pp, efecto ajustado). | Rediseñar la **1.ª respuesta para quien solo prueba** (mostrar 3 usos concretos con ejemplos clicables) y **responder los pedidos de imagen** con una alternativa útil (describir, escribir el prompt, indicar la herramienta) en lugar de solo negarse. Validar con A/B. Potencial: cerrar la mitad de la distancia en esos grupos = **+1,4 pp en el retorno total**. |
| 2 | **El modelo (GPT-4 × GPT-3.5) no cambia el retorno**, ni cuando la persona lo elige ni cuando es el predeterminado. | **No usar un modelo más caro como palanca de retención**: invertir en la 1.ª experiencia, no en el modelo. |
| 3 | **Quien llega por el celular vuelve 8 pp menos** con el mismo tema, idioma, horario y época. | **Auditar la experiencia en el celular** (carga, teclado, formato de las respuestas largas) y probar una versión optimizada en A/B; mientras tanto, tratar el celular como segmento de riesgo en el seguimiento. |

## 5. Sugerencias que salieron de los datos

**Para el asistente:** tratar "solo probando" como una intención de descubrimiento (onboarding con ejemplos); para pedidos de imagen/medios, una respuesta útil en lugar de "no puedo"; atención a los temas de estudio (−5 pp), en los que la respuesta puede estar menos ajustada a lo que necesita el estudiante.

**Para el dashboard**, indicadores pensados solo después de mirar los datos:
- **% de llegadas "solo probando" o "pidiendo medios"** por semana: el mayor factor de no retorno, que se puede seguir;
- **retorno por dispositivo** como segmento fijo;
- **franja esperada por el azar** en cada cohorte semanal, para no alarmar con ruido;
- **sensibilidad de la definición** visible ("si volver el mismo día contara, sería 28%").

## 6. Qué permiten los datos, qué no permiten y qué falta

| Permiten | No permiten | Haría falta para responder mejor |
|---|---|---|
| Comparar a quien volvió y a quien no por la 1.ª experiencia | Identificar a la persona (solo la IP; la misma persona en 2 redes pasa a ser 2) | **ID de usuario** (login o cookie) |
| Medir efectos asociados con incertidumbre y ajuste por la confusión observada | Probar la causa sin experimento | **Pruebas A/B** de onboarding y de la respuesta a pedidos de imagen |
| Clasificar temas y señales de insatisfacción a partir del texto | Saber si la persona quedó satisfecha | **Evaluación de la respuesta por el usuario** (me gusta o no me gusta) |
| Ver la hora de cada respuesta | Ver la hora de cada pregunta (solo el asistente tiene hora) | Hora de los mensajes del usuario |
| Medir el retorno de quien quedó en la base | Ver conversaciones tóxicas (retiradas de la base pública) | La base completa |
