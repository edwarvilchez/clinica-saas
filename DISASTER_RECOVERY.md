# 🚨 Plan de Recuperación ante Desastres (Disaster Recovery Plan - DRP)
## Plataforma Médica Multi-Tenant Clinica SaaS

> **Clasificación:** Confidencial / Runbook Operativo de Emergencia  
> **Versión:** 1.0.0  
> **Objetivo:** Procedimientos reproducibles paso a paso para restaurar los servicios ante incidentes catastróficos (corrupción de datos, fallos de infraestructura, ransomware o pérdida de centro de datos).

---

### 1. Niveles de Severidad y Disparadores de Activación

| Severidad | Escenario Típico | RTO Esperado | RPO Máximo | Responsable |
| :--- | :--- | :--- | :--- | :--- |
| **SEV-1 (Catastrófico)** | Caída total de base de datos principal, corrupción física de disco o fallo mayor del proveedor de nube. | ≤ 2 Horas | ≤ 1 Hora | Tech Lead / DevOps Lead |
| **SEV-2 (Grave)** | Corrupción lógica o eliminación accidental de tablas/registros clave en un tenant o base de datos. | ≤ 1 Hora | Inmediato | DBA / Backend Lead |
| **SEV-3 (Medio)** | Indisponibilidad del servicio de almacenamiento de archivos médicos o réplica de lectura degradada. | ≤ 4 Horas | N/A | DevOps Engineer |

---

### 2. Equipos de Respuesta y Cadena de Comunicación

1. **Incidente detectado:** Alertado automáticamente por monitoreo o el probe `/health/ready` retornando HTTP 503 por más de 3 minutos consecutivos.
2. **Declaración de Emergencia:** El Tech Lead declara el incidente en el canal de incidentes y asigna el Incident Commander.
3. **Página de Estado:** Se actualiza el banner público y la página de status comunicando modo de mantenimiento planificado a los centros médicos.

---

### 3. Procedimiento de Restauración Paso a Paso (Runbook de Emergencia)

#### Paso 1: Poner la Aplicación en Modo Mantenimiento
Para evitar escrituras inconsistentes y que los clientes intenten transaccionar durante la recuperación:
```bash
# Redirigir tráfico o escalar pods web a réplicas en modo espera
kubectl scale deployment clinica-saas-api --replicas=0
# O en docker-compose:
docker compose stop api
```

#### Paso 2: Localizar y Verificar Criptográficamente el Respaldo Más Reciente
Identifique el respaldo más reciente en el almacenamiento local o en el bucket seguro S3/GCS:
```bash
# Listar respaldos disponibles ordenados por fecha
ls -lht /var/backups/clinica-saas/*.dump.enc
```
Verifique la integridad del checksum antes de cualquier operación:
```bash
sha256sum -c clinica_saas_backup_2026-10-08_020000.dump.enc.sha256
```
> [!CAUTION]
> Si la comprobación de suma de verificación falla, **NO PROCEDA** con ese archivo. Localice el archivo previo inmediato o verifique la copia off-site en la nube.

#### Paso 3: Descifrar el Respaldo Seguro
Utilice la clave de cifrado de respaldo de emergencia (`BACKUP_ENCRYPTION_KEY`):
```bash
node server/src/scripts/restore-db.js --decrypt \
  --input /var/backups/clinica-saas/clinica_saas_backup_2026-10-08_020000.dump.enc \
  --output /tmp/restore_clean.dump
```
*(O de forma manual vía OpenSSL)*:
```bash
openssl enc -d -aes-256-cbc -pbkdf2 \
  -in clinica_saas_backup_2026-10-08_020000.dump.enc \
  -out /tmp/restore_clean.dump \
  -pass env:BACKUP_ENCRYPTION_KEY
```

#### Paso 4: Aprovisionar Base de Datos Limpia de Destino
Nunca restaure sobre una base de datos en estado corrupto desconocido sin renombrar la anterior:
```sql
-- Conectado como postgres superuser
ALTER DATABASE clinica_saas_bd RENAME TO clinica_saas_bd_corrupted_archive;
CREATE DATABASE clinica_saas_bd OWNER clinica_app_user;
```

#### Paso 5: Ejecutar Restauración con `pg_restore`
Restaure el dump preservando esquemas, roles, políticas RLS y privilegios:
```bash
pg_restore -h $DB_HOST -p $DB_PORT -U $DB_USER -d clinica_saas_bd \
  --clean --if-exists --no-owner --role=clinica_app_user \
  /tmp/restore_clean.dump
```
O de forma desatendida mediante el script de recuperación de la plataforma:
```bash
node server/src/scripts/restore-db.js \
  --file /tmp/restore_clean.dump \
  --database clinica_saas_bd
```

#### Paso 6: Verificación de Integridad Post-Restauración
Ejecute el script de verificación automatizado para confirmar que la base de datos está sana:
1. **Verificación de Conectividad y Tablas:**
   - Comprobar conteo básico de organizaciones, usuarios y pacientes.
2. **Verificación de Cadenas Criptográficas de Auditoría:**
   - Validar que los hashes de `audit_logs` no estén corrompidos.
3. **Verificación de Probes:**
   - Iniciar una instancia del servidor en modo staging y consultar `GET /health/ready`. Debe responder HTTP 200 con `status: "UP"`.

#### Paso 7: Restablecer Servicio Operativo
```bash
# Reactivar aplicación
docker compose up -d api
# O en Kubernetes
kubectl scale deployment clinica-saas-api --replicas=3
```

---

### 4. Matriz de Pruebas de Simulacro (DR Drills)

Para cumplir con estándares hospitalarios, se deben realizar simulacros programados:
* **Frecuencia:** Semestral (cada 6 meses).
* **Alcance:** Restauración en ambiente de Staging de un backup de producción enmascarado/anonimizado.
* **Criterio de Aprobación:** Tiempo de restauración < 45 minutos y 100% de tests de sanidad en verde.
* **Reporte Post-Mortem:** Toda prueba genera un acta firmada por el Oficial de Seguridad de la Información (CISO).
