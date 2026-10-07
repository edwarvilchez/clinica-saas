# 🔍 PRODUCTION AUDIT — CLÍNICA SAAS (FASE 0)
> **Fecha:** Octubre 2026 | **Versión Base:** v4.3.13  
> **Auditoría Técnica Integral:** Seguridad, Multi-tenancy, Datos Clínicos, Arquitectura y Operaciones.

---

## 1. Resumen Ejecutivo de la Auditoría

Esta auditoría técnica ha evaluado el estado real del monorepo de **Clínica SaaS** (`server` Express + Sequelize, `client` Angular 21, base de datos PostgreSQL 16). La aplicación cuenta con una amplia funcionalidad de negocio (gestión clínica, agendas, laboratorio, farmacia, triage, videoconsultas, caja y facturación), pero presenta vulnerabilidades arquitectónicas, brechas de seguridad críticas y falta de abstracciones indispensables para operar de forma segura en un entorno SaaS multi-tenant en producción.

---

## 2. Clasificación General de Hallazgos

| Nivel de Severidad | Cantidad | Descripción del Impacto |
|---|:---:|---|
| **CRITICAL** | 6 | Compromiso directo de aislamiento multi-tenant, fuga o exposición de credenciales/PHI, denegación o corrupción de datos. |
| **HIGH** | 7 | Brechas de autorización, ausencia de RLS, tokens en texto plano, CORS permisivo, CSP desactivada. |
| **MEDIUM** | 8 | Pruebas unitarias rotas por dependencias de sincronización de BD, logs no estructurados con fuga de metadata, falta de refresh tokens. |
| **LOW** | 5 | Inconsistencias en nombres de servicios, dependencias desactualizadas en Docker, scripts de healthcheck genéricos. |
| **IMPROVEMENT** | 6 | Oportunidades de modularización por dominios, desacoplamiento de proveedores y preparación para eventos de dominio. |

---

## 3. Matriz Detallada de Hallazgos Críticos y Altos

### [AUD-01] [CRITICAL] Ausencia de Row Level Security (RLS) en PostgreSQL
- **Ubicación:** `server/src/models/`, `server/src/migrations/`, `server/src/controllers/`
- **Evidencia:** El filtrado multi-tenant depende al 100% de que cada programador recuerde incluir `{ where: { organizationId } }` en las consultas de Sequelize. No existe ninguna directiva `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` ni políticas `CREATE POLICY ... ON ...` en PostgreSQL.
- **Riesgo:** Si un endpoint nuevo, una consulta raw SQL o una asociación compleja omite el filtro `organizationId`, un usuario de la Organización A leerá o modificará datos clínicos privados de la Organización B.
- **Solución Recomendada:** Implementar Row Level Security a nivel PostgreSQL activado mediante `SET LOCAL app.current_organization_id = '...'` en cada transacción/sesión de base de datos desde el middleware de contexto.

---

### [AUD-02] [CRITICAL] Modelo `AuditLog` Inconsistente y Carente de Aislamiento Multi-Tenant
- **Ubicación:** `server/src/models/auditLog.js`
- **Evidencia:**
  - `id`, `entityId` y `userId` están tipados como `INTEGER` auto-incrementable, mientras que `User`, `Organization`, `Patient` y demás entidades usan `UUID`.
  - No existe columna `organizationId` en la tabla `audit_logs`.
  - No existe mecanismo de detección de manipulación (`tamper evidence` con `previousHash` y `currentHash`).
- **Riesgo:** Imposibilidad de almacenar trazas de auditoría de usuarios reales (falla por incompatibilidad de tipos UUID vs INTEGER), mezcla total de eventos de auditoría entre clínicas y vulnerabilidad a manipulación no detectada de registros médicos (incumplimiento normativo HIPAA/GDPR).
- **Solución Recomendada:** Rediseñar la tabla `audit_logs` con `id UUID`, `organizationId UUID`, `actorUserId UUID`, `action`, `entityType`, `entityId VARCHAR(255)`, `oldValues JSONB`, `newValues JSONB`, `changes JSONB`, `ip`, `userAgent`, `previousHash`, `currentHash`, garantizando diseño *append-only*.

---

### [AUD-03] [CRITICAL] Secretos de 2FA y Tokens de Reset Almacenados en Texto Plano
- **Ubicación:** `server/src/models/User.js` (Líneas 50-55 y 88-91)
- **Evidencia:**
  - `resetToken: DataTypes.STRING` se guarda directamente en texto plano.
  - `twoFactorSecret: DataTypes.STRING` almacena el secreto TOTP directamente sin encriptación.
- **Riesgo:** En caso de filtración de una copia de seguridad o acceso no autorizado a la base de datos, un atacante obtiene inmediatamente los secretos TOTP de todos los médicos/administradores y los tokens activos de restablecimiento de contraseña.
- **Solución Recomendada:**
  - Almacenar los tokens de reseteo como un hash criptográfico `SHA-256`.
  - Cifrar los secretos TOTP (`twoFactorSecret`) utilizando `AES-256-GCM` con una clave maestra protegida (`ENCRYPTION_KEY`) fuera de la base de datos.

---

### [AUD-04] [HIGH] Fuga de Información y Enumeración de Cuentas en Login
- **Ubicación:** `server/src/controllers/auth.controller.js` (Líneas 284-300)
- **Evidencia:**
  - `res.status(401).json({ message: 'Credenciales inválidas (Usuario no encontrado)' })`
  - `res.status(401).json({ message: 'Credenciales inválidas (Contraseña incorrecta)' })`
  - Logs en consola con detalles sensibles: `[LOGIN DEBUG] Longitud Hash: 60, Empieza por: $2b$`, `Password mismatch para: email`.
- **Riesgo:** Permite a un atacante automatizado determinar qué correos electrónicos de médicos o pacientes existen en la base de datos del sistema. Además, los logs exponen metadata de los hashes.
- **Solución Recomendada:** Unificar todas las respuestas fallidas de autenticación a un mensaje estándar genérico: `Credenciales inválidas`. Eliminar logs diagnósticos que expongan detalles de contraseña o hash.

---

### [AUD-05] [HIGH] Política CORS Excesivamente Abierta con Credenciales Habilitadas
- **Ubicación:** `server/src/index.js` (Líneas 11-17)
- **Evidencia:**
  ```javascript
  const corsOptions = {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    ...
  };
  ```
- **Riesgo:** Configurar `origin: true` con `credentials: true` permite a cualquier sitio web malicioso en el navegador de un usuario autenticado hacer solicitudes con credenciales cruzadas (CSRF/CORS bypass).
- **Solución Recomendada:** Implementar una allowlist estricta (`ALLOWED_ORIGINS`) leída desde el entorno, validando origen por origen de forma determinista.

---

### [AUD-06] [HIGH] Content Security Policy (CSP) Deshabilitada en Producción
- **Ubicación:** `server/src/index.js` (Líneas 136-139)
- **Evidencia:**
  ```javascript
  app.use(helmet({ 
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false // Deshabilitado temporalmente en producción
  }));
  ```
- **Riesgo:** La desactivación total de CSP elimina la primera línea de defensa del navegador contra inyecciones XSS y secuestro de sesiones.
- **Solución Recomendada:** Definir directivas CSP precisas (`default-src 'self'`, `script-src 'self'`, `connect-src 'self' ...`) sin deshabilitar la protección global de Helmet.

---

### [AUD-07] [HIGH] Falta de Abstracción para Almacenamiento Seguro de Archivos Médicos
- **Ubicación:** `server/src/middlewares/upload.middleware.js`, `server/src/controllers/payment.controller.js`
- **Evidencia:** Los archivos se suben directamente a la carpeta local `uploads/` y las URLs se guardan como `/uploads/nombre_archivo.ext`. No existe un `FileStorageService` que controle permisos de acceso por paciente u organización ni genere signed URLs.
- **Riesgo:** Documentos médicos, recetas e informes clínicos quedan vulnerables a accesos directos o path traversal, acoplando el código al disco local e impidiendo el uso transparente de MinIO/S3.
- **Solución Recomendada:** Crear la interfaz `FileStorageService` con soporte inicial para almacenamiento local protegido y preparado para S3/MinIO/R2, sirviendo archivos únicamente a través de rutas protegidas con validación de permisos del tenant.

---

### [AUD-08] [HIGH] Ausencia de Refresh Tokens y Rotación de Sesiones
- **Ubicación:** `server/src/controllers/auth.controller.js`
- **Evidencia:** Se emite únicamente un JWT con vigencia de 8 horas (`expiresIn: '8h'`). No existe modelo `RefreshToken`, no hay rotación de tokens, ni lista de revocación para cierre forzado de sesión en todos los dispositivos.
- **Riesgo:** Si un token JWT es interceptado, el atacante tiene acceso total durante 8 horas sin posibilidad de revocación inmediata por parte del usuario o del administrador.
- **Solución Recomendada:** Implementar tokens de corta duración (~15 min) respaldados por una tabla `RefreshToken` con rotación estricta, hash del token y revocación por dispositivo.

---

### [AUD-09] [HIGH] Health Check Superficial y Sin Validación de Dependencias
- **Ubicación:** `server/src/index.js` (Líneas 42-48)
- **Evidencia:** `/api/health` únicamente retorna `{ status: 'ok', env: ..., time: ... }` sin consultar PostgreSQL, Redis ni el sistema de almacenamiento.
- **Riesgo:** Los orquestadores o balanceadores creerán que el contenedor o servicio está saludable aun cuando la base de datos esté caída, enviando tráfico a una instancia en fallo (black hole).
- **Solución Recomendada:** Separar en `/health/live` (liveness) y `/health/ready` (readiness con prueba activa a PostgreSQL, almacenamiento y servicios críticos).

---

### [AUD-10] [MEDIUM] Fallo en Suite de Pruebas Automatizadas por `sequelize.sync()`
- **Ubicación:** `server/src/__tests__/unit/` (`labTraceability.test.js`, `feeReconciliation.test.js`, `patientAdmission.test.js`)
- **Evidencia:** 3 suites de pruebas fallan (13 tests fallidos) debido a llamadas descontroladas a `sequelize.sync()` dentro de los hooks `beforeAll`, bloqueadas por referencias circulares en los modelos.
- **Riesgo:** En CI/CD no se puede ejecutar la suite completa de pruebas sin errores falsos positivos, lo que forzó a restringir los tests a solo 4 archivos en el workflow.
- **Solución Recomendada:** Aislar la inicialización de modelos para tests y crear un entorno de pruebas reproducible sin depender de `sync()` destructivo.

---

### [AUD-11] [MEDIUM] Dockerfile Desactualizado y Healthcheck Roto
- **Ubicación:** `Dockerfile`
- **Evidencia:** Usa `node:18-alpine` cuando el monorepo corre en Node 20 LTS. El healthcheck apunta a `http://localhost:5000/` que responde 404 al no existir esa ruta raíz en Express.
- **Riesgo:** Contenedores marcados como `unhealthy` por Docker daemon y posibles inconsistencias de versión de runtime.
- **Solución Recomendada:** Actualizar base image a `node:20-alpine`, usar multi-stage build y apuntar el healthcheck a `/health/live`.

---

## 4. Estado de los Módulos del Monolito y Preparación para Futura Extracción

```
[Núcleo Clínico / Monolito Modular]
├── Identity & Access        --> Requiere Refresh Tokens + Hash de Reseteo + 2FA cifrado
├── Multi-tenancy & Orgs     --> Requiere RLS en PostgreSQL + Contexto por hilo
├── Patients & Clinical      --> Fuerte en Sequelize, requiere Timeline unificado
├── Appointments & Agenda    --> Requiere eventos de dominio para No-Show y Waitlist
├── Billing, Quotes & Claims --> Estable, requiere desacople de eventos contables
└── Lab & Pharmacy           --> Lógica de lotes FEFO implementada, requiere eventos

[Candidatos para Abstracción de Servicios y Futura Extracción]
├── NotificationService      --> Abstraer Email/SMS/WhatsApp (sin acoplar a proveedores)
├── AIService                --> Abstraer asistentes clínicos (Doctor in the loop)
├── FileStorageService       --> Abstraer almacenamiento privado (Local / S3 / MinIO)
├── TelemedicineService      --> Abstraer WebRTC Signaling y salas
├── AuditService             --> Abstraer AuditLog con SHA-256 tamper-evidence
└── AnalyticsService         --> Abstraer métricas financieras y operativas
```

---

## 5. Conclusión de la Auditoría

El sistema cuenta con una base sólida de modelos y reglas de negocio médico, pero requiere la ejecución metódica del plan de endurecimiento para cumplir con estándares de grado de producción, alta seguridad y trazabilidad. El plan detallado de implementación se especifica en [`IMPLEMENTATION_PLAN.md`](file:///D:/projects/clinica-saas/IMPLEMENTATION_PLAN.md).
