<!-- traduzido de: f597dc629c13 -->
# Paso 5 · Tema de las conversaciones: descubrimiento, clasificación y validación

**Reproducción:** `python -m analise.temas_descoberta` → `python -m analise.classificar` → `python -m analise.validar_temas`.

## Cómo se hizo (formato híbrido)

1. **Descubrimiento sin LLM** (`analise/temas_descoberta.py`): agrupamiento TF-IDF + k-means de las **conversaciones enteras** (hasta 5 mensajes del usuario, 2.000 caracteres) y lectura de muestras aleatorias. El 1.er mensaje solo se descartó como unidad: puede ser apenas un "hola" antes del pedido real.
2. **Lista cerrada revisada manualmente:** 11 temas y 4 señales de insatisfacción, cada uno con descripción (`analise/classificar.py`).
3. **Clasificación:** el LLM lee solo los mensajes del usuario y elige una opción de cada lista mediante **salida estructurada** (no puede crear categorías). Regla de desempate: vale el **pedido principal**; "saludo/prueba" solo cuando la conversación apenas prueba. Sin LLM, por regla: texto del usuario con < 10 caracteres → "saludo/prueba"; conversación con un solo mensaje → insatisfacción "no evaluable".
4. **Primera ronda** con `gpt-5.4-nano` en las 11.621 conversaciones y, de forma independiente, con `gpt-5.4` (modelo mayor, como revisor) en una muestra aleatoria de 600. Los dos discreparon en 111 de las 600.
5. **Revisión humana por patrón**: tres patrones suman 38 de las 111 discrepancias: el nano ponía en "conocimiento general" lo que era **ficción** (16: preguntas hipotéticas sobre personas reales y personajes en otros universos), **estudio** (15: definiciones de conceptos y explicaciones de temas técnicos) y **vida práctica** (7: dudas de cocina y de transporte). En la revisión, gpt-5.4 acertaba en los tres y fue más coherente en general.
6. **Clasificación final con `gpt-5.4`** en las 11.621 conversaciones (0 errores; 4.776 conversaciones con más de un mensaje del usuario). Cada etiqueta guarda proveedor, modelo y versión del prompt en `data/seed/temas.csv` (sin contenido de conversación).

## Validación estadística

| Prueba | Pregunta | Resultado | Decisión |
|---|---|---|---|
| **Estabilidad:** gpt-5.4 × gpt-5.4, dos ejecuciones independientes (600 conversaciones) | ¿La clasificación se repite? | **κ = 0,95** (IC 95% bootstrap: 0,93–0,97). H0: κ ≤ 0,6 **rechazada** | El tema **entra** en el análisis |
| **Concordancia entre modelos:** gpt-5.4 × gpt-5.4-nano (11.621) | ¿Un modelo más pequeño llega al mismo tema? | κ = 0,79 (IC 95%: 0,78–0,79) | Las discrepancias se concentran en "conocimiento general" (ver ítem 5) |
| **Revisión humana por patrón** | ¿Quién acierta cuando discrepan? | gpt-5.4 acierta en los 3 patrones que suman el 34% de las discrepancias | gpt-5.4 pasa a ser el clasificador final |
| **Validez de constructo:** asociaciones previstas **antes** de correr (chi-cuadrado) | ¿Los temas se comportan como deberían? | **5 de 5 confirmadas** (abajo) | — |
| **Insatisfacción:** estabilidad gpt-5.4 × gpt-5.4 (245 conversaciones con > 1 mensaje) | ¿La señal se repite? | κ = 0,93 (IC 95%: 0,89–0,98). Con el nano era 0,32 | Entra como **subanálisis** (solo existe con un 2.º mensaje) |

| Hipótesis registrada antes | % en el tema | % en el resto | p | ¿Confirma? |
|---|---:|---:|---:|---|
| "Imagen/medios" tiene más rechazos o limitaciones declaradas | 20,7% | 5,2% | < 0,001 | sí |
| "Saltarse las reglas" tiene más rechazos o limitaciones declaradas | 24,4% | 5,2% | < 0,001 | sí |
| "Programación" tiene más conversaciones en inglés | 27,8% | 15,1% | < 0,001 | sí |
| "Saludo/prueba" tiene más 1.er mensaje con < 10 caracteres | 69,2% | 3,1% | < 0,001 | sí |
| "Reescritura" tiene más 1.er mensaje largo (≥ 500 caracteres) | 22,2% | 17,7% | < 0,001 | sí |

**Limitaciones declaradas:** no hay un patrón humano completo; la precisión no se estimó contra etiquetas humanas fila por fila. Sostienen el uso del tema la estabilidad (κ = 0,95), la validez de constructo (5/5) y la revisión humana de los patrones de discrepancia.

## En AWS

La clasificación usa LangChain con el proveedor definido en `.env` (`LLM_PRIMARY_PROVIDER=openai` en desarrollo; `bedrock_converse` en la entrega). **Las etiquetas actuales vienen de OpenAI**, usada aquí como herramienta de análisis (PDF §2.2: "en el análisis, use las herramientas que prefiera"). En la implantación, la misma clasificación corre en **Amazon Bedrock** cambiando solo el `.env`, y tiene que revalidarse con `analise/validar_temas.py` (el modelo cambia).
