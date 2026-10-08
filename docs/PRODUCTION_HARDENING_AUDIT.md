# 🛡️ Auditoría Inicial de Endurecimiento para Producción (Fase 0)
## Clinica SaaS — Production Hardening & Go-Live Readiness Gate

**Fecha:** 2026-10-08  
**Versión Base:** 4.7.0  
**Clasificación de Hallazgos:**
- **P0 (Bloquea Producción):** Vulnerabilidad crítica o arquitectura insegura que impide el despliegue a producción.
- **P1 (Debe corregirse antes de Go-Live):** Riesgo de seguridad, inconsistencia o debilidad que debe subsanarse previo al paso a producción.
- **P2 (Mejora post-despliegue):** Optimización o tarea diferible que no compromete la integridad del sistema.

---

## 1. Matriz de Hallazgos y Clasificación

| ID | Área / Componente | Descripción del Hallazgo | Nivel | Estado |
| :--- | :--- | :--- | :---: | :---: |
| **SEC-01** | **Docker & Network** | PostgreSQL expone el puerto `5432:5432` en el host en `docker-compose.yml`, y la red interna no está marcada como `internal: true`. | **P0** | **PENDIENTE** |
| **SEC-02** | **Docker & Secrets** | `docker-compose.yml` contiene secretos con valores por defecto peligrosos (`${JWT_SECRET:-default}`) en vez de sintaxis fail-fast `${JWT_SECRET:?JWT_SECRET is required}`. | **P0** | **PENDIENTE** |
| **SEC-03** | **PostgreSQL RLS & Pooling** | El contexto de sesión `app.current_organization_id` en `context.middleware.js` se asigna a nivel de conexión sin protección transaccional estricta, lo que podría ocasionar fugas de contexto en connection pools reusados. Además, `withTenantTransaction` contiene un error de sintaxis en el parámetro `options`. | **P0** | **PENDIENTE** |
| **SEC-04** | **PostgreSQL RLS Audit** | La verificación de RLS en `productionCheck.js` reporta tablas sin RLS como `WARN` en lugar de `FAIL`, y no todas las tablas accesorias multi-tenant tienen RLS forzado. | **P0** | **PENDIENTE** |
| **SEC-05** | **Archivos Médicos Privados** | Aunque `/uploads` está bloqueado en Express y Nginx, se debe auditar exhaustivamente que ningún controlador almacene o descargue archivos fuera de `FileStorageService` ni acepte rutas arbitrarias. | **P0** | **PENDIENTE** |
| **SEC-06** | **CORS & Preflight** | Revisar compatibilidad y cobertura en preflight OPTIONS para todos los endpoints bajo la nueva configuración estricta de orígenes. | **P0** | **VERIFICADO** |
| **SEC-07** | **CSP (Content Security Policy)** | Validar que la directiva CSP activa en `securityHeaders.middleware.js` permita sin fricciones las conexiones WebRTC (STUN/TURN), WebSockets (Socket.IO) y Angular SPA en producción. | **P0** | **VERIFICADO** |
| **SEC-08** | **Production Check Strict** | `scripts/productionCheck.js` no es estricto por defecto (`--strict` es opcional). Debe ser estricto por defecto y fallar ante cualquier condición P0 o advertencia de seguridad crítica. | **P0** | **PENDIENTE** |
| **SEC-09** | **Multi-Tenant Attack Test** | Se requiere una suite de prueba de ataque multi-tenant dedicada (`multiTenantIsolation`) que valide ataques cruzados de lectura, escritura, eliminación, manipulación de `organizationId` en cuerpo y consultas Raw SQL. | **P0** | **PENDIENTE** |
| **SEC-10** | **Password Reset Token Fallback** | `auth.controller.js` mantiene una búsqueda de token en texto plano (`resetToken: token`) como fallback legado. Debe eliminarse completamente en favor de SHA-256 estricto. | **P1** | **PENDIENTE** |
| **SEC-11** | **Audit Hash Chain Concurrency** | `audit.service.js` en `getLatestHash` no implementa bloqueo de fila (`SELECT ... FOR UPDATE`) o bloqueo consultivo transaccional, lo que permite bifurcaciones (forks) en la cadena de auditoría ante eventos concurrentes. | **P1** | **PENDIENTE** |
| **SEC-12** | **Logging de Datos Sensibles (PII/PHI)** | El controlador de autenticación imprime en consola el correo electrónico del usuario durante el flujo de restablecimiento de contraseña (`console.log([RESET PASSWORD] ... ${user.email})`). | **P1** | **PENDIENTE** |
| **SEC-13** | **Matriz RBAC de Endpoints** | Auditar exhaustivamente los 35 archivos de rutas para asegurar que ningún endpoint de escritura use permisos de solo lectura y que no existan bypasses de autorización. | **P1** | **PENDIENTE** |
| **SEC-14** | **Backup & Restore Ejecutable** | Realizar y registrar la prueba real de respaldo y restauración integral con validación de migraciones e integridad de base de datos. | **P1** | **PENDIENTE** |
| **SEC-15** | **Identidad Venezolana** | Formato canónico `V-########`, normalización `V########`, unicidad multi-tenant y código `IDENTITY_DOCUMENT_ALREADY_EXISTS` (HTTP 409). | **P0** | **RESUELTO** |

---

## 2. Plan de Ejecución Secuencial (Mandatorio)

Seguiremos estrictamente el orden establecido en la especificación:

1. **Fase 0:** Auditoría de estado actual *(Completada en este documento)*.
2. **PostgreSQL RLS:** Endurecimiento del helper transaccional, corrección de `withTenantTransaction`, aislamiento de connection pool, y verificación de políticas.
3. **Private Medical Files:** Verificación y blindaje del almacenamiento privado, eliminación total de accesos estáticos, tests de IDOR.
4. **Docker / Secrets / Network:** Eliminación de puertos expuestos de Postgres (5432), red interna `internal: true`, fail-fast en variables de entorno obligatorias (`:?`).
5. **CORS:** Validación y tests de allowlist estricta con credenciales.
6. **CSP:** Verificación y validación de CSP para Angular, WebSockets y WebRTC.
7. **Production Check Strict:** Modificación para ejecución estricta por defecto (`FAIL` en RLS y secretos).
8. **Identidad Venezolana:** Validación de cobertura (17/17 tests aprobados).
9. **Password Reset Cleanup:** Eliminación del fallback de texto plano y logs de PII.
10. **Audit Chain Concurrency:** Transacciones y bloqueos de fila deterministas para evitar forks en `audit_logs`.
11. **RBAC / Authorization Audit:** Auditoría y matriz de los 35 módulos de rutas del sistema.
12. **Multi-Tenant Attack Tests:** Creación y ejecución de la suite de ataque Tenant A vs Tenant B.
13. **Backup + Restore Validation:** Ejecución real de dump, checksum SHA-256, cifrado, restauración y comprobación de datos.
14. **Staging Deployment:** Verificación de configuración de despliegue y variables de entorno.
15. **Final Go-Live Gate:** Emisión de `GO_LIVE_CHECKLIST.md` y `PRODUCTION_HARDENING_REPORT.md`.
