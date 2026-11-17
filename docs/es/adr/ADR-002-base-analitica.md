<!-- traduzido de: b3b93aac6a2c -->
# ADR-002 · Base analítica: schema `mart` en Postgres, rol de lectura y carga con conciliación

**Estado:** aceptado

## Contexto

El PDF exige que el dashboard **no lea la base bruta** y que los datos pasen por una base analítica diseñada por nosotros. Las conversaciones pueden tener datos personales. El incidente del §4.2 muestra lo que pasa cuando la carga cambia la definición sin que nadie lo note.

## Opciones consideradas

| Opción | Evaluación |
|---|---|
| DuckDB en archivo | Simple, pero el dashboard y la carga compartirían el archivo; sin roles de acceso |
| Redshift / Athena | Escala que el volumen (11,6 mil conversaciones) no pide |
| **Postgres con schema `mart` y dos roles** | Elegida |

## Decisión

- **Base bruta** = parquet de Brasil (en S3 en producción), montada **solo** en el contenedor de la carga.
- **`mart`** guarda conversaciones y eventos **sin texto, IP ni user-agent** (usuario = `sha256(sal + hashed_ip)`), las vistas que definen el retorno, la vista materializada de las cohortes y las tablas de resultados del análisis.
- **Roles:** `bi_etl` es dueño del `mart`; `bi_app` solo tiene `SELECT` y sesión de solo lectura (`default_transaction_read_only`), con `statement_timeout` de 5 s.
- **Carga idempotente:** borra y recarga todo en la misma transacción; migraciones numeradas en `etl/sql/`.
- **Conciliación:** el retorno por cohorte calculado en SQL (`mart.vw_usuarios`) se compara con el calculado en Python (`analise/definicoes.py`); si difieren, la transacción no se publica y la carga termina con error. Cada ejecución registra su procedencia en `mart.cargas`.

## Consecuencias

- Un error como el del §4.2 (clave de usuario distinta de la definición) rompe la carga antes de llegar a la pantalla.
- El IC 95% de cada cohorte se calcula en la base de datos (`mart.wilson`), no en JavaScript.
- En producción: RDS Postgres con backup automático; la carga en ECS programada (EventBridge), con reprocesamiento por ventana de fechas.
