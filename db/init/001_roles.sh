#!/bin/sh
# Roda só na criação do volume. Dois papéis com privilégio mínimo:
#   bi_etl  dono do schema mart: carrega e recalcula
#   bi_app  só SELECT no mart: o dashboard não tem como ler nada além da base analítica
set -e
psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<SQL
CREATE ROLE bi_etl LOGIN PASSWORD '${BI_ETL_PASSWORD}';
CREATE ROLE bi_app LOGIN PASSWORD '${BI_APP_PASSWORD}';
REVOKE ALL ON SCHEMA public FROM PUBLIC;
CREATE SCHEMA mart AUTHORIZATION bi_etl;
GRANT USAGE ON SCHEMA mart TO bi_app;
ALTER DEFAULT PRIVILEGES FOR ROLE bi_etl IN SCHEMA mart GRANT SELECT ON TABLES TO bi_app;
ALTER ROLE bi_app SET default_transaction_read_only = on;
ALTER ROLE bi_app SET statement_timeout = '5s';
ALTER DATABASE "$POSTGRES_DB" SET timezone TO 'America/Sao_Paulo';
SQL
