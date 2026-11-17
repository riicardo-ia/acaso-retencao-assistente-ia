<!-- traduzido de: fe682c380fc7 -->
# Arquitectura AWS

Cómo corre el dashboard en AWS: los mismos contenedores del `docker compose`, en servicios administrados. El diseño sigue la regla del proyecto: el dashboard nunca lee la base bruta, el número se calcula en la base de datos y la pantalla solo lo muestra.

![Arquitectura en AWS](img/arquitetura-aws.svg)

## Componentes

| Servicio | Función | Por qué |
|---|---|---|
| **S3** (bucket privado) | base bruta (parquet de Brasil) y etiquetas de tema versionadas | barato, versionable; solo la carga tiene permiso de lectura |
| **ECS Fargate: carga** | la misma imagen del servicio `etl`, corriendo una vez al día | no hay un servidor encendido sin necesidad: la tarea arranca, carga, verifica y termina |
| **EventBridge** | programa la carga (por ejemplo, todos los días a las 3h) y la reclasificación de los temas, cuando hace falta | programación administrada, sin cron en una máquina propia |
| **Bedrock** | LLM de la clasificación de temas | el modelo y el costo quedan en AWS; cambiar de modelo es solo configuración (LangChain, ver DOCUMENTO §4) |
| **RDS PostgreSQL** | base analítica (schema `mart`) | volumen pequeño; backup automático; SQL legible para cualquier persona del equipo de datos |
| **ECS Fargate: API** | la misma imagen del servicio `app` (FastAPI), siempre encendida | API delgada, solo lectura, con caché por versión de la carga |
| **ALB** | entrada HTTPS de la API, con certificado | distribuye entre las tareas de la API y verifica su salud (`/healthz`) |
| **Cognito** | inicio de sesión del cliente, integrado al ALB | cada cliente ve solo su propio dashboard |
| **CloudFront + S3** | entrega la página (HTML, JS, CSS) | rápido y barato; la página es estática |
| **Secrets Manager** | contraseñas de la base de datos y la sal del seudónimo | ningún secreto en el código ni en la imagen |
| **CloudWatch** | logs JSON, métricas y alarmas de la carga y de la API | un solo lugar para investigar |
| **ECR** | guarda las imágenes generadas por el CI | el despliegue usa exactamente la imagen probada |

## Dos recorridos

**Una carga.** EventBridge dispara la tarea de carga, que lee la base bruta y las etiquetas de tema en S3, aplica las definiciones, corre el análisis estadístico y escribe en RDS en una sola transacción. Antes de publicar, compara el retorno calculado en SQL con el calculado en Python; si difieren, no se publica nada y se dispara una alarma. La carga nunca llama al LLM: la clasificación de los temas es una tarea separada, que corre solo cuando hay que rehacer los temas, y guarda las etiquetas versionadas en S3.

**Una visita.** La persona abre la dirección del dashboard: la página viene de CloudFront. El inicio de sesión pasa por Cognito. La página llama a la API por el ALB; la API consulta RDS con el rol `bi_app`, que solo lee el schema `mart`, y guarda la respuesta en memoria hasta la próxima carga.

## Red y seguridad

- **Red:** solo el ALB y CloudFront quedan expuestos a internet. La API, la carga y la base de datos están en subredes privadas; RDS no tiene acceso público.
- **Quién habla con quién:** la API y la carga llegan a la base de datos por el puerto 5432, abierto solo para ellas. El acceso a S3, Bedrock y Secrets Manager usa endpoints privados de la VPC, sin pasar por internet.
- **Permisos por servicio (IAM):** la carga lee el bucket de la base bruta, llama a Bedrock y lee sus secretos; la API lee solo el secreto del rol `bi_app`. Nadie más que la carga lee la base bruta.
- **Cifrado:** en reposo en S3 y en RDS (claves de KMS) y en tránsito (HTTPS y TLS en la base de datos).
- **Datos personales:** la base bruta tiene texto de conversaciones y queda en el bucket privado. La base analítica no guarda texto, IP ni navegador, y la API no devuelve números de grupos con menos de 30 personas.

## Ambientes y despliegue

- **Ambientes:** desarrollo, homologación y producción, separados (cuentas o VPCs distintas), todos con la misma imagen.
- **Infraestructura como código:** CDK o Terraform, para recrear cualquier ambiente igual.
- **Despliegue:** en cada cambio, el CI corre lint, tipado y pruebas; genera la imagen; la guarda en ECR; actualiza la homologación. La homologación recibe la carga completa y la conciliación; recién después la misma imagen va a producción (reemplazo gradual de las tareas, con vuelta atrás automática si la salud falla).
- **Base de datos:** las migraciones son archivos nuevos, nunca editados, aplicados por la carga y registrados en `mart.migracoes`.

## Monitoreo y alarmas

| Qué se mide | Dónde | Alarma |
|---|---|---|
| Carga: duración, filas leídas, conciliación | logs y métricas de la tarea; `mart.cargas` | carga con error, conciliación fallida o carga que no corrió en el día |
| Número de personas: razón "personas ÷ IPs" por semana | métrica de la carga | razón fuera de su historial (el síntoma del incidente) |
| API: tiempo por ruta (p50, p95), errores | logs JSON con `request_id` | p95 alto o errores 5xx por encima de lo normal |
| Base de datos: conexiones, CPU, espacio | métricas de RDS | uso cerca del límite |

## Costo

Entran en la cuenta: las horas de las tareas Fargate (la API siempre encendida y la carga algunos minutos al día), la instancia pequeña de RDS, el almacenamiento en S3, el tráfico de CloudFront, los tokens de Bedrock (solo cuando se reclasifican los temas) y los logs de CloudWatch. Los mayores ítems son RDS y la API siempre encendida; la carga y el LLM pesan poco. El valor se estima con la calculadora de precios de AWS, con la región y el volumen de accesos del cliente.

## Si el uso crece

1. **Más visitas:** CloudFront pasa a guardar también las respuestas de la API, con la versión de la carga en la dirección, y el ALB distribuye entre más tareas de la API.
2. **Caché compartida:** con muchas tareas de la API, un Redis administrado (ElastiCache) evita que cada una rehaga las mismas consultas.
3. **Más lectura en la base de datos:** una réplica de lectura de RDS.
4. **Muchos más datos** (varios países, años de historial): la base analítica migra a un almacén columnar (Redshift o Athena sobre S3), manteniendo las mismas definiciones y pruebas.
