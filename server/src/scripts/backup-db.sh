#!/bin/bash
# ==============================================================================
# Script de Respaldo Automatizado PostgreSQL - Clinica SaaS
# Formato: Custom pg_dump comprimido, Checksum SHA-256 y Cifrado AES-256-CBC
# ==============================================================================

set -euo pipefail

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="${BACKUP_DIR:-/var/backups/clinica-saas}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-clinica_saas_bd}"
DB_USER="${DB_USER:-postgres}"

mkdir -p "${BACKUP_DIR}"

BASE_NAME="${DB_NAME}_backup_${TIMESTAMP}"
DUMP_FILE="${BACKUP_DIR}/${BASE_NAME}.dump"
FINAL_FILE="${DUMP_FILE}"

echo "📦 [$(date -Iseconds)] Iniciando respaldo de PostgreSQL para la base de datos '${DB_NAME}'..."

# 1. Ejecutar pg_dump en formato custom (-Fc) con compresión de nivel 9
export PGPASSWORD="${DB_PASSWORD:-}"
pg_dump -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" \
  -Fc -Z 9 -f "${DUMP_FILE}"

echo "✅ [$(date -Iseconds)] Dump generado exitosamente: ${DUMP_FILE} ($(du -h "${DUMP_FILE}" | cut -f1))"

# 2. Cifrado simétrico opcional si BACKUP_ENCRYPTION_KEY está configurada
if [ -n "${BACKUP_ENCRYPTION_KEY:-}" ]; then
  ENC_FILE="${DUMP_FILE}.enc"
  echo "🔒 [$(date -Iseconds)] Cifrando dump con AES-256-CBC..."
  openssl enc -aes-256-cbc -salt -pbkdf2 \
    -in "${DUMP_FILE}" \
    -out "${ENC_FILE}" \
    -pass env:BACKUP_ENCRYPTION_KEY
  
  rm -f "${DUMP_FILE}"
  FINAL_FILE="${ENC_FILE}"
  echo "🔐 [$(date -Iseconds)] Respaldo cifrado generado: ${FINAL_FILE}"
fi

# 3. Generar Checksum SHA-256 para verificación de integridad criptográfica
echo "🔏 [$(date -Iseconds)] Calculando checksum SHA-256..."
sha256sum "${FINAL_FILE}" > "${FINAL_FILE}.sha256"

# 4. Purgar respaldos antiguos según la política de retención
echo "🧹 [$(date -Iseconds)] Purgando respaldos locales con más de ${RETENTION_DAYS} días de antigüedad..."
find "${BACKUP_DIR}" -type f \( -name "*.dump" -o -name "*.dump.enc" -o -name "*.sha256" \) -mtime +"${RETENTION_DAYS}" -exec rm -f {} +

echo "🎉 [$(date -Iseconds)] Proceso de respaldo completado satisfactoriamente."
