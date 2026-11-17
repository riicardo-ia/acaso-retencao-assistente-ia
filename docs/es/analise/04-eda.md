<!-- traduzido de: ae4e49cd583e -->
# Paso 4 · Análisis exploratorio

**Reproducción:** `python -m analise.tabela && python -m analise.eda` (gráficos en `img/`, números impresos).
**Pregunta del enunciado:** "cómo se distribuye el **uso** en el tiempo, por modelo, idioma, tema y tamaño de la conversación", solo con los gráficos que llevaron a una conclusión. Todo aquí es **descriptivo**; los efectos ajustados por confusión son el Paso 6.

Cada gráfico de distribución compara dos lecturas del mismo uso: **% de las conversaciones** (naranja) y **% de los usuarios**, por la 1.ª conversación de cada uno (azul). La diferencia entre ambas es el tamaño de la distorsión causada por los usuarios intensivos.

## 1. El uso se concentra en pocas personas

| Fracción de las IPs | % de las conversaciones |
|---|---:|
| 1% más activas | **41,1%** |
| 5% más activas | 59,2% |
| 10% más activas | 68,9% |

El 77,5% de los usuarios usa el asistente **en un único día** en toda la base.
**Conclusión:** cualquier número "por conversación" describe a los usuarios intensivos, no a la persona típica. El análisis de retorno es **por usuario** (1 fila por persona).

## 2. En el tiempo: la llegada y la oferta del modelo cambian

![Uso en el tiempo](img/01-uso-no-tempo.png)

- La llegada de usuarios nuevos tiene dos picos (may/2023 y mar/2024) y un valle en dic/2023–ene/2024.
- GPT-4 desaparece de jul a oct/2023 y pasa a ser **la mayoría (75–94%)** desde dic/2023.

**Conclusión:** GPT-4 × GPT-3.5 solo se compara **dentro del período**; el paso de GPT-4 de opcional a predeterminado ayuda a separar elección de efecto (Paso 6).

## 3. Por tema: la 1.ª conversación es distinta del uso recurrente

![Uso por tema](img/05-uso-por-tema.png)

| Tema | % conversaciones | % usuarios (1.ª conversación) |
|---|---:|---:|
| Estudio y trabajo académico | 15,6 | 17,1 |
| Marketing y contenido profesional | 8,9 | 14,6 |
| **Saludo o prueba del asistente** | 4,6 | **14,6** |
| Conocimiento general | 27,5 | 14,4 |
| Programación y tecnología | 7,5 | 11,8 |
| Ficción, roleplay y creación | 15,9 | 8,2 |
| Vida práctica y consejos | 5,1 | 6,2 |
| Reescritura, resumen y traducción | 10,4 | 5,3 |
| **Pide imagen, video o audio** | 2,0 | **4,4** |
| Intenta saltarse las reglas | 1,8 | 2,7 |
| Otro / indefinido | 0,9 | 0,9 |

**Conclusión:** 1 de cada 7 personas empieza **solo probando** el asistente, y 1 de cada 23 empieza **pidiendo imagen, video o audio**, algo que un asistente de texto no entrega. Ficción y reescritura pesan el doble en las conversaciones que en las primeras conversaciones: son usos de quien se queda.

## 4. Por idioma, tamaño y modelo

![Uso por idioma](img/06-uso-por-idioma.png)
![Uso por tamaño](img/07-uso-por-tamanho.png)
![Uso por modelo](img/08-uso-por-modelo.png)

| | % conversaciones | % usuarios (1.ª conversación) |
|---|---:|---:|
| Portugués · inglés · otro | 75,7 · 16,1 · 8,2 | 68,3 · 19,6 · 12,1 |
| 1 turno · 2 · 3–4 · 5–9 · 10+ | 56,2 · 18,7 · 14,2 · 8,4 · 2,4 | 46,5 · 23,9 · 17,0 · 9,4 · 3,2 |

**Conclusiones:** el uso es mayoritariamente en portugués; **la mitad de las conversaciones tiene un solo turno**; la versión del modelo sigue el calendario de oferta (gpt-3.5-0301 en abr–jun/23, 0613 en jul–nov/23, gpt-4 preview después), así que "versión del modelo" es casi sinónimo de "época".

## 5. Quien vuelve, vuelve pronto

![Curva de retorno](img/02-curva-de-retorno.png)

| Días calendario después del 1.er día | 1 | 3 | 7 | 14 |
|---|---:|---:|---:|---:|
| % que ya volvió | 11,1% | 15,9% | **18,4%** | 19,8% |

**Conclusión:** el 60% de los retornos en 7 días ocurre **al día siguiente**, y la ventana de 14 días agrega solo 1,4 pp. Lo que decide el retorno está en el 1.er día y la mañana siguiente.

## 6. Quien conversa más el 1.er día vuelve más, pero es engagement, no causa

![Retorno por turnos](img/03-retorno-por-turnos.png)

| Turnos el 1.er día | 1 | 2 | 3–4 | 5–9 | 10+ |
|---|---:|---:|---:|---:|---:|
| n | 759 | 471 | 465 | 346 | 225 |
| Retorno (IC 95%) | 10,5% (8,6–12,9) | 13,0% (10,2–16,3) | 20,9% (17,4–24,8) | 22,3% (18,2–26,9) | 44,9% (38,5–51,4) |

**Conclusión:** relación fuerte y monótona, pero la misma disposición que hace que la persona converse más la hace volver. Los turnos entran en el Paso 6 como **mediador**, separado de los factores que el producto controla.

## 7. Quien llega con "hola" o "prueba" vuelve menos

![Retorno por tamaño del 1.er mensaje](img/04-retorno-por-tamanho-da-1a-mensagem.png)

| Caracteres del 1.er mensaje | < 10 | 10–49 | 50–199 | 200–999 | 1.000+ |
|---|---:|---:|---:|---:|---:|
| n | 461 | 569 | 694 | 327 | 215 |
| Retorno (IC 95%) | 12,1% (9,5–15,4) | 18,1% (15,2–21,5) | 20,6% (17,8–23,8) | 20,8% (16,7–25,5) | 21,4% (16,4–27,4) |

**Conclusión:** el salto está entre "< 10" y el resto; por encima de 50 caracteres la tasa es plana. El 1.er mensaje corto mide la **intención al llegar** (curiosidad, prueba), un rasgo del perfil y no de la respuesta. Entra en el Paso 6 como **confusor**.

## Gráficos descartados

El retorno por idioma, dispositivo, franja horaria y fin de semana se revisó (tabla en el Paso 3), pero sin ajuste no lleva a una conclusión. Va directo al modelo del Paso 6.
