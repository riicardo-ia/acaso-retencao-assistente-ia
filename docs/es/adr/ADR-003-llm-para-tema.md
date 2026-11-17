<!-- traduzido de: dd2ae03bd2b1 -->
# ADR-003 · Tema de las conversaciones: clasificación cerrada por LLM, cambio entre OpenAI y Bedrock y etiquetas versionadas

**Estado:** aceptado

## Contexto

El tema de la 1.ª conversación es una variable pedida por el PDF. El LLM del dashboard tiene que estar en AWS; en el análisis, la herramienta es libre. Las evaluadoras corren `docker compose up` sin credenciales de ningún proveedor.

## Opciones consideradas

| Opción | Evaluación |
|---|---|
| Heurística por palabras clave | Barata, pero débil para conversaciones largas y mixtas |
| LLM con categorías libres | Categorías inestables entre ejecuciones; difícil de validar |
| SDK nativo de cada proveedor | Ata el código a un proveedor |
| **LangChain con salida estructurada y lista cerrada; proveedor por configuración** | Elegida |

## Decisión

- **Formato híbrido:** temas descubiertos sin LLM (TF-IDF + k-means sobre la conversación entera), lista de 11 temas revisada manualmente; el LLM solo elige una opción (salida estructurada).
- **Proveedor por `.env`:** `LLM_PRIMARY_PROVIDER=openai` en el análisis, `bedrock_converse` en producción; el código no cambia.
- **Modelo:** gpt-5.4, elegido después de la revisión manual de las discrepancias con gpt-5.4-nano.
- **Etiquetas versionadas** en `data/seed/temas.csv` (`conv_id`, tema, proveedor, modelo, versión del prompt), sin contenido. La carga lee el seed y nunca llama a un LLM.

## Consecuencias

- Validación en `analise/validar_temas.py`: estabilidad κ = 0,95, 5 de 5 hipótesis de constructo confirmadas.
- Las etiquetas actuales vienen de OpenAI (análisis). En producción, la clasificación de las conversaciones nuevas corre en **Amazon Bedrock** y tiene que revalidarse con el mismo script, porque el modelo cambia.
