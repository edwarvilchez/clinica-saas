# 🛡️ Estrategia de Respaldo y Recuperación (Backup Strategy)
## Plataforma Médica Multi-Tenant Clinica SaaS

> **Clasificación de Seguridad:** Confidencial / Cumplimiento Normativo (HIPAA / GDPR / Regulaciones Sanitarias)  
> **Versión del Documento:** 1.0.0  
> **Última Revisión:** 2026-10-08  
> **Ámbito de Aplicación:** Servidores de Base de Datos PostgreSQL, Almacenamiento de Archivos Clínicos y Secretos de Producción.

---

### 1. Objetivos del Servicio y Métricas RPO / RTO

Para garantizar la continuidad operativa hospitalaria y la integridad inmutable de las Historias Médicas Digitales (PHI), se definen los siguientes acuerdos de nivel de servicio:

| Métrica | Objetivo | Justificación Técnica |
| :--- | :--- | :--- |
| **RPO (Recovery Point Objective)** | **≤ 1 Hora** | En caso de desastre mayor, la pérdida máxima de datos transaccionales tolerada es de 1 hora mediante snapshots y backups automatizados programados. |
| **RTO (Recovery Time Objective)** | **≤ 2 Horas** | Tiempo máximo admitido para restaurar completamente la base de datos y levantar la plataforma operativa en infraestructura primaria o secundaria. |
| **Retención de Auditoría** | **10 Años** | Los registros forenses y tamper-evident (`audit_logs`) deben preservarse inmutables según requerimientos legales sanitarios. |

---

### 2. Clasificación de Datos y Alcance de los Respaldos

1. **Base de Datos Relacional PostgreSQL (`clinica_saas_prod`):**
   - Pacientes, Médicos, Historias Médicas, Recetas, Pagos, Honorarios Médicos, Admisiones y Trazas de Auditoría con cadenas SHA-256.
   - Esquemas, tablas, índices compuestos, políticas de Row-Level Security (RLS) y roles de base de datos.
2. **Almacenamiento de Archivos Médicos Privados (`/storage` o S3/GCS):**
   - Recibos de pago firmados, resultados de laboratorio en PDF, documentos de consentimiento informado y recetas médicas firmadas digitalmente.
3. **Secretos y Configuración de Infraestructura:**
   - Variables de entorno críticas (`JWT_SECRET`, `ENCRYPTION_KEY`, `DB_PASSWORD`), certificados SSL/TLS y llaves privadas de firma.

---

### 3. Niveles y Frecuencia de Respaldo (Regla 3-2-1)

Se adopta de forma obligatoria la estrategia **3-2-1**:
* **3 Copias:** 1 copia primaria en producción + 2 copias de respaldo independientes.
* **2 Medios Distintos:** Almacenamiento en bloque local cifrado (SSD/NVMe) + Almacenamiento de objetos en la nube (S3 Glacier / Google Cloud Storage Coldline).
* **1 Copia Fuera de Sitio (Off-site / Cross-Region):** Ubicada geográficamente en una región de nube distinta a la instancia principal de producción.

#### Matriz de Programación de Respaldos:

| Nivel | Frecuencia | Formato | Retención | Almacenamiento |
| :--- | :--- | :--- | :--- | :--- |
| **Completo Diario** | Cada día a las `02:00 UTC` | `pg_dump -Fc` (Formato Custom comprimido) + Cifrado `AES-256-CBC` | 30 días | Local + S3/GCS Bucket |
| **Semanal Consolidado** | Cada domingo a las `03:00 UTC` | Snapshot completo con checksum SHA-256 | 90 días | Cold Storage Cloud |
| **Mensual de Archivo** | Primer día de cada mes | Snapshot inmutable con Write Once Read Many (WORM) | 7 a 10 Años | Archival Vault (S3 Glacier / GCP Archive) |

---

### 4. Requisitos de Seguridad Criptográfica

> [!IMPORTANT]
> **Cero Respaldos en Texto Plano en Producción:** Todo archivo de respaldo que contenga PHI debe ser cifrado inmediatamente antes de ser transmitido o persistido fuera de memoria.

1. **Cifrado en Reposo:**
   - Los dumps de base de datos se comprimen con gzip y se cifran simétricamente utilizando `OpenSSL` con algoritmo `AES-256-CBC` o `AES-256-GCM` empleando una clave de respaldo dedicada (`BACKUP_ENCRYPTION_KEY`), independiente de la base de datos.
2. **Verificación Criptográfica de Integridad:**
   - Todo archivo `.dump` o `.enc` generado debe acompañarse de un archivo de huella digital `.sha256`.
   - Antes de iniciar cualquier proceso de restauración, el script verifica obligatoriamente que `sha256sum -c` coincida. Si la firma discrepa, el proceso falla de inmediato para evitar inyección de datos alterados.
3. **Aislamiento Multi-Tenant durante el Respaldo:**
   - Los respaldos globales respetan y preservan íntegramente las políticas RLS y la estructura de `organizationId` sin mezclar contextos.

---

### 5. Procedimientos de Respaldo Automatizado

La plataforma provee dos scripts ejecutables auditables:

1. **`server/src/scripts/backup-db.js` (Script Universal Node.js / CLI):**
   - Ejecutable en cualquier entorno (Windows / Linux / Docker).
   - Genera el dump PostgreSQL vía `pg_dump` con streaming comprimido.
   - Genera el hash `SHA-256` del artefacto.
   - Aplica cifrado opcional con `BACKUP_ENCRYPTION_KEY`.
   - Purga automáticamente los respaldos que excedan la ventana de retención (por defecto 30 días).
   - Emite registros estructurados en formato JSON compatibles con Pino.

2. **`backup-db.sh` (Script Shell para Cron / Kubernetes CronJob):**
   - Preparado para orquestación en contenedores y servidores Linux.

---

### 6. Protocolo de Simulacro y Verificación Periódica

Tener respaldos no garantiza que sean restaurables. Por ende, la política exige:
* **Prueba de Restauración Automatizada Mensual:** Un contenedor efímero aislado restaura el último backup semanal, ejecuta las suites de pruebas de sanidad (`npm test`) y verifica que los conteos de registros y hashes SHA-256 de `audit_logs` sean consistentes.
* **Auditoría de Logs de Respaldo:** Monitoreo activo de alertas si un job de respaldo diario falla o excede el umbral de duración de 15 minutos.
