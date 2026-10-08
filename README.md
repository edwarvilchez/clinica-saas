# Clínica SaaS - Sistema Integral de Gestión Médica y Hospitalaria

Sistema SaaS multisede para la administración de clínicas, centros de salud, videoconsultas médicas, control de admisiones hospitalarias, baremos, seguros e historias clínicas.

---

## 📚 Documentación del Sistema

Para consultar las especificaciones técnicas completas y manuales operativos:

- [**Guía Completa de Despliegue en VPS (Ubuntu + Nginx + PM2 + SSL)**](DEPLOYMENT.md)
- [**Guía Rápida de Comandos para Puesta en Marcha**](DEPLOYMENT_GUIDE.md)
- [**Arquitectura Técnica del Sistema y Stack Tecnológico**](ARCHITECTURE.md)
- [**Especificación y Diseño de Futuros Microservicios (Fase 27)**](FUTURE_MICROSERVICES.md)
- [**Plan de Implementación Integral (Fases 1 a 28 - 100% Completado)**](IMPLEMENTATION_PLAN.md)
- [**Guía de Entornos Separados (Dev / QA / Prod) y Migración de Datos (QA -> Prod)**](docs/GUIA_ENTORNOS_Y_MIGRACION_QA_PROD.md)
- [**Arquitectura Multi-Tenant y Aislamiento Estricto de Datos**](docs/ARQUITECTURA_MULTITENANT.md)
- [**Esquema DDL de Base de Datos PostgreSQL**](server/schema_postgres.sql)
- [**Historial de Versiones y Cambios (Changelog)**](CHANGELOG.md)
- [**Manual Digital Interactivo para Usuarios**](.docs/manual-digital.html)

---

## 🚦 Auditoría de Producción y Suite de Pruebas

El sistema cuenta con una batería integral de pruebas automatizadas y un inspector pre-vuelo previo al pase a producción:

```bash
# 1. Auditoría Automatizada Pre-Vuelo para Producción (Fase 28)
npm run production:check

# 2. Ejecutar la Batería Completa de Pruebas Automatizadas (49 suites, 422 tests en verde)
npm test

# 3. Ejecutar Suites Específicas de Seguridad y Multi-Tenant RLS
npm run test:security
```

---

## 🏢 Aislamiento Multi-Tenant (Garantía de Cero Cruce de Datos)

El sistema cuenta con un motor estricto de aislamiento por inquilino (`Tenant Isolation Engine`):
- **PostgreSQL Row-Level Security (RLS)**: Enforzado a nivel de motor de base de datos en las 27 tablas críticas del sistema (`Patients`, `Appointments`, `MedicalRecords`, `Prescriptions`, `audit_logs`, `Payments`, etc.).
- **Sobrescritura Forzosa**: Todo payload entrante es sanitizado por el middleware de seguridad, previniendo inyecciones de identificadores de otras clínicas.
- **Cumplimiento HIPAA / ISO 27001**: Cada registro médico, receta y pago está blindado contra acceso cruzado no autorizado con trazabilidad inmutable mediante auditoría automática (`audit_logs`) y triggers append-only (`trg_prevent_audit_log_mutation`).

---

## 🚀 Despliegue en Servidor VPS

- **Frontend**: Angular 21 (Compilado en `dist/client/browser` y servido por Nginx como SPA estático de alto rendimiento).
- **Backend**: Node.js / Express + Socket.IO (Ejecutado con PM2 en modo clúster para alta disponibilidad).
- **Base de Datos**: PostgreSQL 15+ con pool de conexiones nativo y RLS activo.
- **WebSockets & WebRTC**: Señalización WebRTC endurecida con **Tokens Criptográficos de Sala (JWT HMAC-SHA256)** y límite estricto de capacidad máxima (Médico + Paciente).
- **Almacenamiento**: Persistencia de archivos cifrados en el directorio local `server/uploads/` o S3/MinIO compatible.
- **Proxy Inverso & SSL**: Nginx con compresión Gzip, HTTP/2 y certificados SSL automáticos Let's Encrypt (Certbot).

---

## ⚙️ Variables de Entorno Requeridas (`server/.env`)

| Variable | Descripción | Ejemplo |
|---|---|---|
| `DB_HOST` | Host del servidor PostgreSQL | `127.0.0.1` o IP interna |
| `DB_PORT` | Puerto de PostgreSQL | `5432` |
| `DB_NAME` | Nombre de la base de datos | `clinica_saas_bd` |
| `DB_USER` | Usuario de base de datos | `clinica_saas_admin` |
| `DB_PASSWORD` | Contraseña del usuario de BD | `(password seguro)` |
| `JWT_SECRET` | Clave secreta para tokens JWT (mín. 32 caracteres) | `(string aleatorio largo de 32+ caracteres)` |
| `ALLOWED_ORIGINS` | Dominios autorizados (separados por coma) | `https://tu-dominio.com` |
| `CLIENT_URL` | URL pública del frontend | `https://tu-dominio.com` |
| `API_URL` | URL pública del API | `https://tu-dominio.com/api` |
| `RESEND_API_KEY` | API Key para envío de correos (Resend) | `re_...` |
| `WHATSAPP_API_TOKEN` | Token de acceso para Meta WhatsApp Cloud API | `EAA...` |

---

## 🛡️ Seguridad y Autenticación

- **2FA TOTP (RFC 6238)**: Doble factor de autenticación con código QR y tokens de 6 dígitos.
- **Firma Digital de Recetas**: Generación de hash SHA-256 y firma HMAC para validación pública con código QR.
- **Auditoría Inmutable Forense**: Registro de trazabilidad para cumplimiento **ISO 27001** y **HIPAA**.
- **Control de Roles (RBAC Granular)**: Superadmin, Platform Admin, Doctor, Enfermería, Recepción, Administración y Paciente.
- **Clinical AI Decision Support (CDSS)**: Asistencia médica para sugerencias CIE-11 y resúmenes con directiva ética obligatoria de revisión y aprobación por el médico.
- **Portal del Paciente Seguro**: Auto-gestión de citas y descargas con defensas estrictas Anti-IDOR.

---

## 🛠️ Inicialización del Sistema

Para el despliegue inicial en desarrollo o VPS:

```bash
# 1. Migraciones de base de datos
cd server && npx sequelize-cli db:migrate

# 2. Inicialización inicial con usuario SuperAdmin maestro
node sync_db.js

# 3. Auditoría previa al pase a producción
npm run production:check
```

---

## ✨ Módulos Principales

1. **Gestión de Pacientes e Historias Médicas**: Identificación estricta (Cédula/RIF/Pasaporte), seguros y antecedentes.
2. **Admisiones Hospitalarias**: Control de camas, movimientos entre áreas (Triaje, Quirófano, UCI, Piso), garantes y alta médica.
3. **Presupuestos y Facturación**: Catálogo de baremos, combos quirúrgicos, doble moneda en tiempo real (USD y Tasa BCV).
4. **Videoconsultas Médicas**: Salas virtuales WebRTC blindadas con tokens temporales de sala y señalización Socket.IO.
5. **Portal de Pacientes y Smart Waitlist**: Reserva pública de citas, auto-gestión y reasignación automática de cancelaciones.
6. **Inteligencia de Ingresos y Liquidación a Médicos**: Reportes financieros agregados, cálculo de comisiones y series temporales.
7. **Vistas Duales Odoo**: Alternancia entre tabla detallada y tablero Kanban para gestión operativa ágil.

---

## 📦 Gestión de Ramas (Git Flow)

1. **`develop`**: Desarrollo y características activas (CI automatizado con 49 suites pasando al 100%).
2. **`staging`**: Pruebas de integración previas a producción.
3. **`master` / `main`**: Rama productiva para despliegue en VPS.

---
*© 2026 Clínica SaaS / Medicusve. Todos los derechos reservados.*
