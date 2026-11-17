<!-- traduzido de: 602baf3c0007 -->
# BDR-003 · Qué muestra el dashboard: dos pantallas, cinco filtros, muestra mínima y datos personales

**Decidido por:** Ricardo · **Estado:** aprobado

## Contexto

El público es de negocio, no estadístico, y el dashboard es un BI de autoservicio: las personas van a filtrar y sacar conclusiones solas. Demasiados filtros y frases libres abren espacio para conclusiones falsas; las conversaciones pueden tener datos personales.

## Opciones consideradas

| Tema | Opciones | Elección |
|---|---|---|
| Pantallas | una pantalla con todo filtrable · **La respuesta (fija, abre primero) + Explorar (filtrable)** | Separar exploración de conclusión: el efecto "comparando personas parecidas" viene de un modelo que no debe recalcularse en grupos pequeños |
| Filtros | todas las variables de la 1.ª experiencia · **solo las principales** | Período del 1.er uso, idioma, dispositivo, tema de la 1.ª conversación y modelo. El engagement (turnos, insatisfacción) no es filtro: no es causa e invita a conclusiones equivocadas |
| Frases automáticas | texto libre por LLM · **reglas fijas con traba estadística** | "Confirmada" solo con 30+ personas y una diferencia por encima del margen de error con 99% de confianza |
| Muestra mínima | sin límite · esconder solo en la pantalla · **esconder en la API** | Con menos de 30 personas, la API no devuelve ningún número del grupo; la pantalla muestra "menos de 30" o "pocas personas", sin conclusión |
| Lenguaje | términos estadísticos · **lenguaje simple, con el detalle técnico desplegable** | "margen de error", "comparando personas parecidas", "puede ser azar" |
| Unidad | "de cada 100 personas" · **%** | Retornos en % con un decimal y margen de error; diferencias en puntos porcentuales, con un ejemplo de lectura en la pantalla |
| Organización de la pantalla La respuesta | gráficos por tema · **un bloque por pregunta del cliente** | Cada pregunta es el título de su gráfico, con la respuesta en una frase; las salvedades (comparación simple, causa solo con A/B) quedan en el propio bloque para no inducir a error |

## Qué muestra el dashboard y qué nunca muestra

- **Muestra:** conteos y porcentajes agregados, con margen de error, y efectos del modelo.
- **Nunca muestra:** texto de conversación, IP, user-agent, estado ni el número de un grupo con menos de 30 personas. La API devuelve esos números vacíos (ni el conteo sale), y una prueba lo garantiza. La base analítica no guarda texto, IP ni user-agent; la persona es `sha256(sal + hashed_ip)`.
- **Riesgo residual:** restar dos recortes filtrados podría estimar el tamaño de un grupo pequeño. El riesgo es bajo, porque solo hay conteos de personas seudonimizadas y ningún contenido.

## Consecuencias

- La frase de la pantalla Explorar puede diferir de la pantalla La respuesta (comparación simple × personas parecidas); la pantalla explica la diferencia.
- Los filtros se validan con una prueba de integración (`tests/test_explorar_dados.py`).
