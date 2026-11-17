<!-- traduzido de: bfc90c682f33 -->
# Retención de un asistente de IA: hallazgos y decisiones

**Pregunta del cliente:** ¿qué hace que una persona que probó el asistente vuelva a usarlo en 7 días o menos? ¿Qué factores tienen el mayor efecto, cuánto pesa cada uno y cuánto de eso es causa y no selección?
**Base:** WildChat-1M, conversaciones con `country = 'Brazil'`: 11.621 conversaciones, 2.266 personas nuevas elegibles (abr/2023–abr/2024).
**Detalle de cada etapa:** [`docs/analise/`](analise/) (calidad, definiciones, variables, EDA, temas, análisis) · decisiones: [`docs/bdr/`](bdr/), [`docs/adr/`](adr/) · incidentes: [`docs/incidente-4.2.md`](incidente-4.2.md) · arquitectura AWS: [`docs/arquitetura-aws.md`](arquitetura-aws.md).

## 1. La respuesta

**El 18,4% vuelve** otro día, entre el 1.er y el 7.º día después del primer uso (IC 95%: 16,8–20,0).

| # | Hallazgo (efecto ajustado, IC 95%) | Decisión que sostiene |
|---|---|---|
| 1 | **1 de cada 5 personas llega solo probando (14,6%) o pidiendo imagen, video o audio (4,4%)** y vuelve ~6%, frente a ~21% de quien llega con un pedido real: **−15,6 pp [−19,6; −11,6]** y **−14,7 pp [−18,7; −10,7]**. | Rediseñar la 1.ª respuesta para quien solo prueba (usos concretos con ejemplos) y responder los pedidos de medios con una alternativa útil en lugar de negarse. Validar con A/B. Cerrar la mitad de la distancia = **+1,4 pp** en el retorno total. |
| 2 | **El modelo no cambia el retorno.** GPT-4: −1,1 pp [−5,8; +3,6] ajustado; +2,9 pp [−1,7; +7,3] por IPW; +1,7 pp cuando la persona lo elegía y +1,3 pp cuando era el predeterminado, ambos cruzando el cero. | No usar un modelo más caro como palanca de retención; invertir en la 1.ª experiencia. |
| 3 | **En el celular, el retorno es 7,9 pp menor** [−11,3; −4,4], con el mismo tema, idioma, horario y época. | Auditar la experiencia móvil y probar una versión optimizada en A/B; seguir el celular como segmento de riesgo. |

**Causa o selección.** La época (GPT-4 pasa del 0% al 94% de las conversaciones a lo largo del año), la intención al llegar y el perfil se controlaron; el engagement del 1.er día quedó fuera, como mediador. En GPT-4, la igualdad entre "elegido" y "predeterminado" indica que no hay selección relevante. **Lo que no está probado:** que cambiar la 1.ª experiencia hará que las personas vuelvan; sin experimento, queda confusión no observada (motivación, necesidad). Por eso cada decisión viene con un A/B.

**La semana del 20/11/2023** cayó 10,4 pp frente a las 4 anteriores. La descomposición muestra que cambió **la tasa dentro de cada perfil** (−10,0 pp), no el perfil de quien llegó (−0,4 pp). Pero con ~50 personas por semana, la prueba entre las 37 semanas no distingue la variación del azar (p = 0,21). El dashboard muestra la incertidumbre de cada semana en lugar de alarmar con una semana aislada.

Los efectos de todos los factores, la calidad de la respuesta y lo que los datos permiten o no medir están en [`analise/06-analise.md`](analise/06-analise.md).

## 2. Premisas (asumidas sin respuesta del cliente) y qué cambia si están equivocadas

| Premisa | Elección | Si está equivocada |
|---|---|---|
| Quién es el usuario | `hashed_ip` (no hay login) | IP + navegador: 20,2%; IPs unidas por la conversación: 18,1% |
| Qué es "volver" | usar en **otro día local**, D+1 a D+7 (el PDF habla de "en qué huso horario cuenta un día") | una nueva sesión el mismo día ya contando: **28,1%**, la premisa que más pesa |
| Qué cuenta como uso | cada respuesta del asistente (solo el asistente tiene hora) | solo conversación nueva: 17,1% |
| Huso | São Paulo para todo Brasil | UTC: 19,6%. Brasil tiene 4 husos: en Amazonas y Acre, el día cambia 1 o 2 horas más tarde que en São Paulo |
| Período | base entera, sin los primeros 14 días (falso "nuevo") y sin los últimos 8 (ventana incompleta) | sin cortes: hasta 18,7% |
| Base | pública, sin las conversaciones tóxicas | el retorno medido es un **límite inferior** |
| Sesión | solo como sensibilidad: pausa de 15, 30 o 60 min | 33,4%, 28,1% o 24,6% si una nueva sesión contara como volver |
| Ventana | 7 días, como en la pregunta | 15,8% con 3 días; 19,8% con 14 |
| Tema | de la 1.ª conversación entera, entre 11 temas fijos | depende del clasificador: estable (κ = 0,95) y confirmado en 5 de 5 hipótesis |
| Engagement del 1.er día | fuera del modelo, como consecuencia (mediador) | controlarlo borraría el efecto de una buena 1.ª experiencia |
| Muestra mínima | 30 personas para mostrar un número; 99% de confianza en las frases | por debajo de eso, el número oscila demasiado por azar |
| País | `country` inferido de la IP | las conversaciones por VPN entran o salen de Brasil; no hay datos para medirlo |

Opciones consideradas en cada una: [`bdr/BDR-001`](bdr/BDR-001-definicoes-de-uso-e-retorno.md).

## 3. El dashboard

Arranca con `docker compose up --build` y abre en `http://localhost:8000`. Es un **BI de autoservicio**: las personas de negocio exploran solas, sin notebook, y verifican cada número. Dos pantallas ([BDR-003](bdr/BDR-003-o-que-o-dashboard-mostra.md)):

| Pantalla | Pregunta | Gráficos y por qué |
|---|---|---|
| **La respuesta** (abre primero; fija, base entera) | Las tres preguntas del cliente, cada una con su propio gráfico | Arriba, tres tarjetas en %: el retorno (18,4%, margen de 16,8% a 20,0%), las personas analizadas y el retorno si volver el mismo día contara (28,1%). Después, un bloque por pregunta, con la pregunta como título y la respuesta en una frase: **1. ¿Qué hace volver?** barras con el retorno de cada grupo en %, con margen de error y el promedio de todos (comparación simple, avisada en la pantalla); **2. ¿Qué factores tienen el mayor efecto?** ranking de los efectos en puntos porcentuales, comparando personas parecidas, con el margen de error (la línea que cruza el cero muestra lo que no hace diferencia); **3. ¿Cuánto pesa cada uno y cuánto es causa y no selección?** dos barras superpuestas por factor: la rayada es la diferencia comparando a todos, la llena es lo que se mantiene comparando personas parecidas; el sobrante rayado es selección, y la pantalla recuerda que la causa solo se prueba con una prueba A/B. Luego, los 3 hallazgos con "qué hacer", GPT-4 por tres formas de medir, la semana del 20/11 (perfil × retorno), el retorno semana a semana con la franja del azar, mediadores, insatisfacción, sensibilidad a las reglas y cómo se clasificaron los temas. Los términos técnicos solo en el detalle desplegable |
| **Explorar** (con filtros: período del 1.er uso, idioma, dispositivo, tema de la 1.ª conversación, modelo) | En este recorte, ¿cuántos vuelven, cómo evolucionó y quién vuelve más? | Números principales; **línea** del retorno mes a mes con el margen de error sombreado (tendencia); **columnas** de personas nuevas por mes (volumen); **barras horizontales** por idioma, dispositivo, modelo y tema (comparar grupos); barras lado a lado "% de las personas × % de las conversaciones" por tema (peso de quien usa mucho). Frases por regla que cambian con el filtro |

**Documentación.** Un tercer enlace arriba abre, dentro del propio dashboard, los documentos del repositorio: este documento, los indicadores, los incidentes, la arquitectura AWS, los BDRs y ADRs y el análisis paso a paso, en el idioma de la pantalla (portugués, inglés o español). Solo se sirven los archivos de una lista cerrada, convertidos de Markdown en el servidor.

**Búsqueda.** Un campo arriba busca en las pantallas (lleva directo al bloque), en los valores de los filtros (abre Explorar ya filtrado) y en todos los documentos, por sección (abre el documento en la sección, con un fragmento). Las pantallas y los filtros se buscan en la propia página; los documentos, en un índice armado una vez en el servidor y guardado en memoria, sin consultar la base de datos. La búsqueda ignora acentos y mayúsculas, espera a que la persona deje de escribir y tarda menos de 1 ms en el servidor.

**Lenguaje.** Retornos en %, con un decimal; diferencias en puntos porcentuales, con un ejemplo de lectura ("pasar de 21% a 6% es −15 p.p."); "margen de error", "aun teniendo en cuenta idioma, dispositivo, horario, tema y época", "puede ser azar", "no hay diferencia comprobada". Cada gráfico tiene "¿Cómo lo calculamos?" con una explicación simple y el detalle técnico desplegable, además de la consulta SQL.

**Frases automáticas (Explorar).** Son reglas fijas, sin LLM (`app/insights.py`, probadas):
- con menos de 30 personas, no concluyen nada;
- una diferencia solo está "confirmada" si pasa la prueba de dos proporciones con 99% de confianza (más exigente, porque quien explora hace muchas comparaciones);
- si no, la frase dice "puede ser azar".

**Indicadores.** Definición, fórmula, denominador, período y la **consulta SQL de cada uno** están en [`indicadores.md`](indicadores.md).

| Indicador | Fórmula | Denominador | Período |
|---|---|---|---|
| Retorno en 7 días | personas con uso en D+1..D+7 ÷ personas nuevas | personas nuevas elegibles | 1.er uso entre el 22/04/2023 y el 21/04/2024, o el período del filtro |
| Retorno por mes, semana o grupo | lo mismo, por mes, semana o grupo del 1.er uso | personas nuevas del mes, semana o grupo | mes, semana o grupo |
| Efecto de un factor | efecto marginal medio de la regresión logística (puntos porcentuales) | las 2.266 personas | base entera |

**Muestra pequeña:** con menos de 30 personas, la API no devuelve ningún número del grupo, ni el conteo. La pantalla muestra "menos de 30" y "amplía el recorte" en el recorte, deja el mes sin punto y escribe "pocas personas" en lugar de la barra.

**Indicadores que solo tuvieron sentido después de mirar los datos**, ya en el dashboard:
- retorno por tema de la 1.ª conversación;
- la fracción de quien llega "solo probando" o "pidiendo imagen";
- retorno por dispositivo;
- "% de las personas × % de las conversaciones";
- la sensibilidad a la forma de medir.

Propuesto para la próxima versión: el seguimiento con una ventana móvil de 4 semanas.

**Qué muestra el dashboard y qué nunca muestra.** Muestra solo agregados y efectos. **Nunca** muestra texto de conversación, IP, user-agent, estado ni el número de un grupo con menos de 30 personas. La API devuelve esos números vacíos, y una prueba lo garantiza. La base analítica ni siquiera guarda texto, IP ni user-agent: el usuario pasa a ser `sha256(sal + hashed_ip)`.

## 4. Arquitectura

![Flujo de la base bruta a la pantalla](img/arquitetura.svg)

| Componente local | En AWS | Por qué |
|---|---|---|
| Volumen `bruto` (parquet) | S3 | base bruta barata y versionable |
| Servicio `etl` | ECS Fargate programado por EventBridge | corre el mismo contenedor, sin un servidor encendido |
| Postgres | RDS PostgreSQL (backup automático) | volumen pequeño; SQL legible para cualquier persona del equipo de datos |
| Servicio `app` | ECS Fargate detrás de un ALB; página en S3 + CloudFront | API delgada y página estática |
| Clasificación de tema | Amazon Bedrock (`LLM_PRIMARY_PROVIDER=bedrock_converse`) | el LLM queda en AWS; el cambio es solo de configuración |
| Contraseñas, sal del seudónimo | Secrets Manager | ningún secreto en el código |
| Logs y métricas | CloudWatch | un solo lugar para la carga y la API |
| Inicio de sesión (fuera del alcance local) | Cognito en el ALB | el cliente ve solo su propio dashboard |

Detalle de cada servicio, de los recorridos de una carga y de una visita, red, seguridad, despliegue, monitoreo y costo: [`arquitetura-aws.md`](arquitetura-aws.md).

**Clasificación portable entre proveedores de LLM.** La clasificación de temas usa LangChain (`init_chat_model`), y el proveedor y el modelo se eligen solo en el `.env` (`LLM_PRIMARY_PROVIDER` y `LLM_PRIMARY_MODEL`), sin cambiar código. Cambiar de proveedor es cambiar dos líneas de configuración y correr de nuevo la validación de los temas (`analise/validar_temas.py`), porque el modelo cambia:

| Proveedor | Configuración | Situación |
|---|---|---|
| OpenAI (clave de API) | `openai` | usado en el análisis |
| Amazon Bedrock (Claude, Llama, Mistral y otros) | `bedrock_converse` | listo; es el camino de la entrega, con el LLM y el costo en AWS |
| Claude por la API de Anthropic | `anthropic` | basta instalar `langchain-anthropic` |
| Otros que LangChain soporta (Google, Azure OpenAI, modelos locales) | el nombre del proveedor | basta instalar el paquete del proveedor |

**Modelo de la base analítica** (schema `mart`, [`etl/sql/`](../etl/sql/)):

| Objeto | Granularidad | Clave | Quién escribe → quién lee |
|---|---|---|---|
| `conversas` | una conversación (sin texto, IP ni user-agent) | `conv_id` | carga → app |
| `eventos` | una respuesta del asistente (hora de uso) | `usuario_id`, `ts` | carga → vistas |
| `perfil_usuario` | una persona: idioma, dispositivo, tema y modelo de la 1.ª conversación | `usuario_id` | carga → app |
| `vw_usuarios` / `mv_usuarios` | una persona elegible: 1.er día, semana, volvió | `usuario_id` | SQL (definición del BDR-001) |
| `vw_explorar` | `mv_usuarios` + `perfil_usuario` | `usuario_id` | app (pantalla Explorar) |
| `mv_coortes_semanais`, `vw_retorno_geral` | semana / total, con IC de Wilson | `semana` | app |
| `efeitos`, `gpt4_selecao`, `semana_decomposicao`, `sensibilidade`, `testes`, `uso_por_categoria` | resultados del análisis estadístico | — | carga → app (La respuesta) |
| `cargas`, `migracoes` | una ejecución / una migración | `id` / `nome` | carga → app (procedencia) |

**Endpoints**

| Endpoint | Entrada | Salida |
|---|---|---|
| `GET /api/explorar` | `inicio`, `fim` (AAAA-MM-DD) e `idioma`, `dispositivo`, `tema`, `modelo` (opcionales; un valor fuera de la lista → 400); `lang` = idioma de la pantalla (`pt`, `en` o `es`, usado en las frases) | recorte y base con margen de error, serie mensual, retorno por grupo en las 4 dimensiones, llegada por tema, frases, opciones de los filtros, procedencia, SQL |
| `GET /api/analise` | — | retorno general y por semana, efectos bruto y ajustado con IC, GPT-4 por tres métodos, descomposición de la semana, sensibilidad, pruebas, procedencia, SQL |
| `GET /api/documentos` | — | índice de la Documentación: nombre, grupo y título de cada documento |
| `GET /api/documentos/{nome}` | nombre de un documento de la lista (fuera de ella → 404) y `lang` (`pt`, `en` o `es`) | título y HTML del documento, con los enlaces internos apuntando a la propia página |
| `GET /api/busca` | `q` (lo que se escribió) y `lang` | hasta 8 secciones de documentos del idioma de la pantalla: documento, sección, ancla y un fragmento |
| `GET /healthz` | — | `{"status": "ok"}` |

Documentación interactiva en `/api/docs`.

**Otros países.**
- **Interfaz: lista.** La pantalla ya está en portugués, inglés y español (selector arriba, o `/?lang=en`). Cada texto pasa por una función de traducción con el portugués como clave; las traducciones están en `app/static/i18n.json`, y `tests/test_traducoes.py` falla si una frase nueva queda sin traducción. Los números y las fechas siguen el formato de cada idioma, y las frases automáticas vienen de la API en el idioma de la pantalla (`lang`). Los documentos también están en los tres idiomas: el original en portugués está en `docs/`, las traducciones en `docs/en` y `docs/es`, y cada traducción guarda la huella del original; si el portugués cambia y la traducción no, `tests/test_traducoes.py` falla.
- **Huso: todavía fijo.** Es el punto crítico, porque el retorno es por día local. Hoy `'America/Sao_Paulo'` está en `vw_usuarios` y en la base de datos. Para otros países, el huso pasa a ser una columna por país (o por estado, para países con varios, como el propio Brasil), usada en `vw_usuarios` en lugar de la constante.
- **Comparación: todavía no existe.** `pais` entra como dimensión en todas las tablas del `mart` y en las rutas (`?pais=`). El modelo de efectos corre por país, y los países se comparan por los efectos con IC, no por las tasas brutas, porque el perfil de llegada cambia entre ellos.
- **Temas:** necesitan revalidación por idioma.

**Rendimiento.**
- **Precalculado:** la definición de "volvió" se materializa una vez por carga, con granularidad de persona (`mv_usuarios`, 2.266 filas con 1.er día, semana y si volvió). Cualquier filtro de la pantalla pasa a ser una lectura de esas filas listas, sin recalcular eventos. Las cohortes quedan en una vista materializada, y los efectos y las pruebas estadísticas, en tablas: el modelo corre en la carga, nunca en la solicitud.
- **Caché:** la API guarda el resultado de cada consulta en memoria, con la **versión de la carga en la clave**. La caché vence exactamente cuando se publica una carga nueva, sin un plazo adivinado. Cada solicitud hace una consulta mínima en `mart.cargas` para conocer la versión.
- **Medición:** cada respuesta trae el encabezado `server-timing` (visible en el navegador) y un log JSON con `request_id`, ruta, parámetros, estado y duración. Medido localmente: de 10 a 85 ms en la 1.ª llamada de cada ruta o recorte (la primera de la API incluye abrir la conexión) y cerca de 3 ms con caché.
- **En producción:** p50 y p95 por ruta en CloudWatch Logs Insights, con alarma; el tiempo en el navegador todavía no se mide (próximo paso).

## 5. Sostenimiento

**Qué se registra en cada capa para investigar un número equivocado:**
- **Carga:** `mart.cargas` con la versión del código, filas en la fuente, en Brasil y cargadas, usuarios, retorno, conciliación y duración.
- **Base de datos:** migraciones numeradas con la decisión comentada al inicio.
- **Backend:** log JSON por solicitud (`request_id`, ruta, estado, duración).
- **Pantalla:** el pie muestra la carga, la versión, si la conciliación pasó y el **código de la solicitud** (`request_id`), el mismo que queda en el log del servidor. Con una captura de pantalla, se llega directo al registro de esa consulta.

**Trazabilidad completa:** diseñada, es uno de los próximos pasos (§7).

**Cómo notar la divergencia antes que el cliente:** la carga compara el retorno por cohorte en SQL y en Python y **no publica** si difieren. En producción, hay además una alarma de CloudWatch para una carga con error o para la razón "usuarios ÷ IPs" fuera de su historial (el síntoma del §4.2).

**Pruebas que impiden que una definición cambie sin que nadie lo note:**
- `tests/test_definicoes.py`: quién es la persona (la misma IP con navegadores distintos es la misma persona), 1.er día, retorno D+1..D+7, huso y cortes;
- `tests/test_estrutura.py`: la **definición del retorno congelada** (el hash de la vista y del margen de error en la base de datos; si cambia, la prueba se rompe y pide la revisión del BDR-001), las migraciones aplicadas nunca editadas y el rol del dashboard solo leyendo el `mart`;
- `tests/test_variaveis.py`, `tests/test_classificar.py` y `tests/test_efeitos.py` (el modelo recupera un efecto plantado en datos sintéticos);
- `tests/test_api.py` y `tests/test_insights.py`: contrato de las rutas, validación de los filtros, ningún número de grupos con menos de 30 personas, las frases automáticas y la búsqueda (encuentra la sección correcta y es rápida);
- `tests/test_traducoes.py`: ninguna frase de la pantalla sin traducción y ningún documento traducido desactualizado respecto del original;
- `tests/test_explorar_dados.py`: integración con la base de datos cargada, que verifica que sin filtro el número es el oficial, que las partes suman el todo y que, en filtros sorteados, el SQL coincide con un cálculo independiente en Python.

Cada push corre en el CI (`.github/workflows/ci.yml`): ruff, formato, mypy y las pruebas, con un Postgres que recibe los roles y las migraciones. La integración con los datos reales corre localmente, con el compose.

**Camino a producción:** ambientes dev → homologación → producción, con el mismo contenedor en todos. La migración nueva la aplica la carga (`mart.migracoes`), siempre un archivo nuevo y nunca editado. El despliegue lo hace el CI con pruebas, build de la imagen, ECR y actualización del servicio ECS. La homologación recibe la carga completa y la conciliación antes del cambio.

## 6. Riesgos y decisiones para llevar al cliente

| Riesgo | Mitigación o decisión |
|---|---|
| **Una IP no es una persona** (red compartida, cambio de red) | La sensibilidad muestra ±2 pp; **pedir al cliente un ID de usuario** (login o cookie) |
| Los efectos son asociaciones ajustadas, no prueba causal | **Decidir con el cliente las pruebas A/B** de los hallazgos 1 y 3 |
| Cohortes semanales pequeñas (~45 personas) | La pantalla muestra la incertidumbre; **acordar** el seguimiento con una ventana de 4 semanas |
| Las etiquetas de tema vienen de un LLM de OpenAI (análisis) | En producción, Bedrock y revalidación; **confirmar** el modelo y el costo en Bedrock |
| Base pública sin conversaciones tóxicas | El retorno es un límite inferior; **pedir** la base completa si el cliente la tiene |
| La definición de "volver" cambia el número en 10 pp | **Validar con el cliente**: otro día (18,4%) o nueva sesión (28,1%) |

## 7. Próximos pasos

Diseñados y dejados fuera de esta entrega por plazo y riesgo: cambian la carga o la base de datos a pocas horas de la entrega.

1. **Trazabilidad completa por claves.** Vincular cada número con su origen por claves. Una tabla `usuarios` como dimensión, con claves foráneas de `conversas`, `perfil_usuario` y `eventos`; cada evento con el `turn_identifier` de la base bruta y el `conv_id` de la conversación; `carga_id` en todas las tablas; la carga que falla registrada en una transacción separada; y la versión igual al commit y el hash de los archivos de origen en `mart.cargas`. La cadena queda: pantalla (`request_id`) → log de la API → `mart.cargas` (commit, origen, conciliación) → fila (`carga_id`) → evento (`turn_identifier`) → base bruta. Hoy el vínculo con la base bruta ya existe por la conversación (`conv_id` = 1.er `turn_identifier`) y por la persona (la misma sal recalcula el seudónimo a partir del `hashed_ip`).
2. **Robustez estadística adicional:** el E-value de los hallazgos (qué tan fuerte tendría que ser un factor no medido para borrar el efecto) y la corrección para varias comparaciones al mismo tiempo.
3. **Otros países:** el huso por país (o por estado, donde haya varios), la columna `pais` en todas las tablas y una pantalla de comparación por los efectos con margen de error.
4. **Tiempo medido en el navegador**, además del tiempo del servidor que ya se mide.
5. **Con el cliente** (§6): identificador de usuario, pruebas A/B de los hallazgos 1 y 3, la base con las conversaciones tóxicas y qué definición de "volver" vale.

## 8. Uso de IA

Usé Claude Code (Anthropic) como par de desarrollo en todas las etapas: discovery, análisis, código de la carga, de la API y de las pantallas, y redacción de los documentos. Usé la API de OpenAI (gpt-5.4 y gpt-5.4-nano, mediante LangChain) solo para clasificar el tema de las conversaciones. Revisé todo lo que generó la IA, del análisis a la pantalla, y corregí lo que no se sostenía. La corrección más importante fue en el tema: la IA clasificaba cada conversación por el primer mensaje, que muchas veces es solo un "hola" antes del pedido real, y pasé a clasificar por la conversación entera. También corregí la definición de retorno (la propuesta de "nueva sesión después de 30 minutos" pasó a ser uso en otro día calendario, como indica el enunciado, y el número pasó de 28,1% a 18,4%), descarté la variable "algún rechazo el 1.er día" (creaba un efecto falso, porque sube con el número de respuestas), cambié el clasificador más pequeño por el más grande después de revisar las discrepancias y definí la clave de la conversación por el primer `turn_identifier`, porque el `conversation_hash` se repite entre personas distintas. En cada carga, el retorno calculado en SQL se compara con el calculado en Python, y la carga no se publica si difieren. Dediqué cerca de 14 horas al desafío.
