<!-- traduzido de: 9e102781062a -->
# BDR-002 · Lista de temas de las conversaciones

**Decidido por:** Ricardo · **Estado:** aprobado
**Evidencia:** `docs/analise/05-temas.md` · **Código:** `analise/classificar.py`

## Contexto

El PDF pide el tema de la 1.ª experiencia como variable. La base no tiene tema; hay que asignarlo a partir del texto, y la lista de temas es una decisión de negocio: define cómo el cliente va a ver el uso del asistente.

## Opciones consideradas

| Opción | Por qué no / por qué sí |
|---|---|
| Dejar que el LLM cree temas libremente | Las categorías cambian en cada ejecución; imposible seguirlas en el tiempo |
| Clasificar por el 1.er mensaje | El 1.er mensaje suele ser solo "hola" o una prueba; el asunto real viene después |
| **Lista cerrada, descubierta en los datos y revisada manualmente, aplicada a la conversación entera** | Elegida |

## Decisión

11 temas: estudio y trabajo académico · programación y tecnología · reescritura, resumen y traducción · marketing y contenido profesional · ficción, roleplay y creación · conocimiento general y curiosidades · vida práctica y consejos · **pide imagen, video o audio** · **intenta saltarse las reglas** · **solo saluda o prueba el asistente** · otro.

- Los tres en negrita quedan separados aunque sean pequeños: miden dónde el asistente falla o se niega, y el PDF pide "dónde falla".
- Vale el **pedido principal** de la conversación; "solo saluda o prueba" es solo para conversaciones que apenas prueban.
- Los temas con menos de 30 personas en la 1.ª conversación pasan a "otro" en el modelo.

## Consecuencias

- Los hallazgos 1 y 3 de `docs/DOCUMENTO.md` dependen de esta lista.
- Cambiar la lista exige reclasificar y revalidar (`analise/validar_temas.py`).
