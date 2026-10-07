# 🛡️ SECURITY MODEL & THREAT MITIGATION — CLÍNICA SAAS
> **Modelo de Seguridad de la Información, Cumplimiento y Protección de Datos Clínicos (PHI/PII)**  
> **Estándar de Referencia:** OWASP ASVS Level 2 + Principios HIPAA de Privacidad y Seguridad.

---

## 1. Principio Fundamental: Defensa en Profundidad

La seguridad de Clínica SaaS no descansa en un solo componente o capa. Se implementa un modelo de **Defensa en Profundidad (Defense in Depth)** donde cada nivel valida y protege de forma autónoma:

```
[Navegador / Cliente]   --> CSP estricta, Headers HSTS, Cookies SameSite, Sanitización XSS
        ↓
[Red / Reverse Proxy]   --> TLS 1.3, Firewall UFW, Rate Limiting (DDoS / Fuerza Bruta)
        ↓
[API / Middleware]      --> JWT Verification, RBAC por Recurso y Verbo, Validación Joi
        ↓
[Capa de Contexto]      --> Thread-local context con AsyncLocalStorage (userId, orgId, role)
        ↓
[Servicio / Dominio]    --> Reglas de negocio de propiedad de datos (Ownership checks)
        ↓
[Motor de Base de Datos] --> PostgreSQL Row Level Security (RLS) intransgredible
```

---

## 2. Aislamiento Multi-Tenant (Tenant Boundary Defense)

### 2.1. Regla Inquebrantable
> **Un usuario de la Organización A jamás podrá leer, crear, modificar, exportar o inferir información de la Organización B bajo ninguna circunstancia.**

### 2.2. Implementación de Doble Barrera
1. **Barrera a nivel de Aplicación (Sequelize):**
   - Todas las consultas transaccionales inyectan el filtro `where: { organizationId: req.user.organizationId }`.
   - Se prohíbe el uso de `organizationId` proveniente del cuerpo (`req.body`) o parámetros de ruta (`req.params`) para entidades sensibles; siempre se extrae del token validado criptográficamente en el middleware de autenticación.
2. **Barrera a nivel de Motor (PostgreSQL RLS):**
   - Cada conexión a base de datos establece la variable de sesión:
     ```sql
     SET LOCAL app.current_organization_id = 'a7615471-735c-4bf4-b80e-ca0c16f540af';
     ```
   - Políticas RLS activas en todas las tablas sensibles:
     ```sql
     CREATE POLICY tenant_isolation_policy ON "Patients"
     FOR ALL
     USING (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::uuid);
     ```
   - Incluso si un error humano en el código ejecuta `SELECT * FROM "Patients"`, PostgreSQL únicamente retornará los pacientes de la organización activa en la sesión.

---

## 3. Modelo de Autenticación, Sesiones y 2FA

### 3.1. Ciclo de Vida de Tokens
- **Access Token:** JWT firmado con clave `JWT_SECRET` de 64+ caracteres aleatorios. Vigencia máxima: **15 minutos**.
- **Refresh Token:** Cadena criptográfica opaca (64 bytes hex) almacenada con hash SHA-256 en la base de datos con expiración de 7 a 30 días.
- **Rotación Estricta:** Al usar un Refresh Token, este es invalidado inmediatamente y reemplazado por uno nuevo. Si se detecta un intento de reutilización de un token revocado, se cancelan **todas las sesiones activas** del usuario (detección de robo de token).

### 3.2. Doble Factor de Autenticación (2FA / TOTP)
- Las claves secretas TOTP **nunca se almacenan en texto plano**.
- Se cifran en base de datos mediante **AES-256-GCM** utilizando un vector de inicialización (IV) único por usuario y una clave maestra `ENCRYPTION_KEY` almacenada en las variables de entorno del servidor.
- Se entregan códigos de rescate (backup codes) cifrados para recuperación en caso de extravío de dispositivo.

### 3.3. Restablecimiento Seguro de Contraseña
- Los tokens de restablecimiento se generan con alta entropía (`crypto.randomBytes(32)`).
- En la base de datos se almacena únicamente el hash `SHA-256(token)`.
- Expiración máxima: **15 minutos**, consumo de un solo uso.
- **Protección contra Enumeración:** La API responde siempre: *"Si el correo existe en el sistema, hemos enviado un enlace de recuperación"* con tiempo de respuesta constante para prevenir análisis de tiempos (*timing attacks*).

---

## 4. Trazabilidad Criptográfica (Tamper-Evident Audit Trail)

### 4.1. Garantía de Inmutabilidad
- La tabla `audit_logs` es de naturaleza estrictamente **Append-Only**.
- Se configuran triggers en PostgreSQL que impiden sentencias `UPDATE` y `DELETE` sobre registros de auditoría.

### 4.2. Cadena de Bloques Criptográfica (Hash Chaining)
Cada evento de auditoría calcula su huella digital integrando el hash del registro inmediatamente anterior:

$$\text{currentHash} = \text{SHA-256}(\text{previousHash} \parallel \text{organizationId} \parallel \text{actorUserId} \parallel \text{action} \parallel \text{entityId} \parallel \text{payload} \parallel \text{timestamp})$$

Cualquier intento directo de alteración manual en la base de datos romperá la continuidad de la cadena criptográfica, siendo detectado de inmediato por el verificador de integridad del sistema.

---

## 5. Protección de Archivos y Documentos Médicos (PHI / PII)

1. **Cero Exposición Pública:** Ningún archivo clínico reside en carpetas expuestas directamente por el servidor web (`/uploads/`).
2. **Descarga Mediante Control de Acceso:**
   - La solicitud de un archivo (`/api/files/:fileId`) verifica:
     1. Autenticación activa del usuario.
     2. Pertenencia del usuario a la organización dueña del archivo.
     3. Permiso específico de rol (ej. solo el médico tratante, paciente titular o personal autorizado).
3. **Firmado de Enlaces:** Para almacenamiento en la nube (S3/MinIO), se emiten URLs firmadas con expiración de 5 minutos.
4. **Sanitización de Subidas:**
   - Verificación de Magic Bytes (MIME type real, no solo la extensión del archivo).
   - Generación de nombres de archivo mediante UUIDv4 aleatorio (prevención de sobrescritura y *path traversal*).
   - Límite estricto de tamaño por archivo (5MB a 10MB).

---

## 6. Cabeceras de Seguridad y Políticas de Red

| Cabecera HTTP | Valor Configurado | Propósito |
|---|---|---|
| `Content-Security-Policy` | `default-src 'self'; script-src 'self'; ...` | Prevención de ataques Cross-Site Scripting (XSS). |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | Fuerza comunicación cifrada por HTTPS (HSTS). |
| `X-Content-Type-Options` | `nosniff` | Impide ejecución de archivos con tipos MIME falseados. |
| `X-Frame-Options` | `DENY` | Prevención total de Clickjacking (sin iframes). |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Evita fuga de identificadores o parámetros en la URL. |
| `Access-Control-Allow-Origin` | Allowlist explícita (`ALLOWED_ORIGINS`) | Rechaza orígenes no autorizados sin usar comodín `*`. |

---

## 7. Higiene de Logs y Confidencialidad de Datos Clínicos

- **Cero PHI/PII en Logs:** Queda terminantemente prohibido registrar en la consola o archivos de logs:
  - Cédulas / DNI / Pasaportes.
  - Nombres de pacientes, diagnósticos o prescripciones.
  - Contraseñas, hashes, tokens JWT o claves de cifrado.
- **Redacción Automática:** El sistema de logging implementa un serializador con máscara automática para los campos sensibles (`password`, `token`, `secret`, `medicalHistory`).

---

## 8. Matriz de Verificación de Amenazas (Security Checklist)

- [x] **Aislamiento Multi-Tenant:** RLS en base de datos + filtrado forzoso en aplicación.
- [x] **Prevención de Inyección SQL:** Consultas parametrizadas con Sequelize / placeholders seguros.
- [x] **Mitigación de XSS:** CSP activada, escape en plantillas Angular y sanitización de payloads.
- [x] **Prevención de Enumeración:** Respuestas genéricas y constantes en Login y Reset de contraseñas.
- [x] **Protección contra Fuerza Bruta:** Rate Limiting por IP y cuenta en endpoints de autenticación.
- [x] **Cifrado de Secretos en Reposo:** Claves 2FA cifradas con AES-256-GCM.
- [x] **Trazabilidad Inmutable:** Auditoría append-only con encadenamiento SHA-256.
- [x] **Archivos Clínicos Seguros:** Acceso restringido con autorización estricta del tenant.
