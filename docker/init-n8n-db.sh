#!/bin/sh
# Crea la base de datos de n8n en el mismo Postgres (solo la primera vez)
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -c "CREATE DATABASE n8n OWNER $POSTGRES_USER;"
