<!-- traduzido de: 7333ba6925a5 -->
# Paso 1 · Calidad de los datos (capa bruta, Brasil)

**Fuente:** `allenai/WildChat-1M` (HuggingFace), 14 archivos, 837.989 conversaciones → **11.621 con `country = 'Brazil'`**.
**Reproducción:** `python -m analise.qualidade` (cada número de abajo sale de una consulta con nombre en el script).

## Problemas encontrados y tratamiento

| # | Problema | Evidencia | Impacto si se ignora | Tratamiento |
|---|---|---|---|---|
| Q1 | **Solo el asistente tiene hora.** Los mensajes del usuario no tienen `timestamp` | 26.579 de 26.579 mensajes de usuario sin hora; 0 de 26.579 del asistente | No se sabe la hora exacta de la pregunta | El inicio de la conversación es la hora de la **1.ª respuesta** (`conversation[2].timestamp`). Diferencia con la pregunta: segundos |
| Q2 | **`timestamp` es el último turno**, no el inicio | Duración p90 = 21 min, p99 = 5,8 h | Usar `timestamp` como "primera vez" desplaza la cohorte y puede convertir la propia 1.ª conversación en "retorno" (es una de las fallas del incidente §4.2) | Inicio = Q1; `timestamp` solo como fin |
| Q3 | **Conversaciones reabiertas después**: la persona vuelve a una conversación antigua en lugar de abrir una nueva | 664 conversaciones con pausa > 30 min entre respuestas; 37 duran más de 1 día | Contar el retorno solo por "conversación nueva" pierde a quien volvió en una antigua | Medir el uso por la **hora de cada respuesta**, no solo por el inicio de la conversación (decidido en el Paso 2) |
| Q4 | **`conversation_hash` no es clave** | 11.555 hashes para 11.621 conversaciones; 27 grupos repetidos, todos de IPs distintas, 1.er mensaje mediano de 2 caracteres ("hola") | Deduplicar por hash borraría conversaciones reales de personas distintas | Clave = 1.er `turn_identifier` (único en las 11.621; ningún turno se repite entre filas) |
| Q5 | **Reenvío**: mismo 1.er mensaje, misma IP, en menos de 10 min | 386 casos | Inflaría el "retorno" si cada reenvío contara como volver | Agrupar en **sesión** (pausa mínima entre usos, medida en el Paso 2) |
| Q6 | **La IP cambia dentro de la misma conversación** | 175 conversaciones | `hashed_ip` separa a una misma persona en dos (red móvil, Wi-Fi → 4G); retorno subestimado | Alternativa medida en el Paso 2: unir las IPs que aparecen en la misma conversación |
| Q7 | **IP compartida o automatizada** | La mayor IP tiene 1.557 conversaciones (13,4% del total), 35 user-agents, 28 idiomas, 129 días activos, un solo estado (explica por sí sola que Piauí sea el 3.er estado) | Domina cualquier gráfico por conversación; en la retención pesa como 1 "usuario" que en realidad son varios | EDA por usuario (no por conversación) y sensibilidad con y sin IPs anómalas |
| Q8 | **Idioma poco confiable en mensajes cortos** | 714 primeros mensajes con < 10 caracteres; "Finnish", "Maori", "Sotho", "Nolang" con mensaje mediano de 2 a 5 caracteres | Factor "idioma" con categorías falsas | Idioma en 3 grupos (portugués, inglés, otros) + indicador de mensaje corto |
| Q9 | **Mensaje del usuario vacío** | 273 conversaciones | Tamaño y tema sin sentido en esos casos | Indicador propio; tema = "sin contenido" |
| Q10 | **`toxic` siempre es falso** | 0 de 11.621 | La variable no discrimina nada (la versión pública de WildChat-1M excluye las conversaciones tóxicas) | Fuera del análisis; registrado como dato que falta |
| Q11 | **La oferta de GPT-4 cambia con el tiempo** | % GPT-4 por mes: 13–16% (abr–jun/23), **0% (jul–oct/23)**, 15% (nov/23), **75–94% (dic/23–abr/24)** | Comparar GPT-4 × GPT-3.5 sin controlar el período mezcla el efecto del modelo con el de la época | Comparación siempre **dentro del período** (control de cohorte); el cambio de régimen se investiga en el Paso 6 |
| Q12 | Pocos campos nulos | `state` nulo en 51; `redacted` en 56; ningún user-agent nulo | Bajo | `state` nulo pasa a "no informado" |

## Verificaciones que pasaron

- Toda conversación empieza con un mensaje del usuario, y `len(conversation) = 2 × turn` en todas.
- Ningún inicio después del fin.
- Ninguna semana sin datos entre abr/2023 y abr/2024 (la 1.ª semana es parcial, con 14 conversaciones).
- El 60% de las IPs (1.424 de 2.385) tiene una única conversación.
