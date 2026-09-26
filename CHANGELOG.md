# Changelog — MedicalCare 888

All notable changes to this project will be documented in this file.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [4.4.0] — 2026-09-25

### 🏥 Flujo Clínico, Admisiones, Ventas & Vistas Odoo

- **Gestión de Pacientes e Historias Médicas (`HC-CI`)**:
  - Selector exclusivo de tipo de documento (Cédula, Pasaporte, RIF) con formateo y sanitización a solo números.
  - Generación automática e inmutable de la Historia Médica basada en el número de CI (`HC-CI`).
  - Despliegue condicional para seguros (Aseguradora, Póliza, Plan, Cobertura, Clave, Carta Aval y Siniestro).
  - Carga estructurada de familiares, beneficiarios y antecedentes patológicos.
  - Prevención estricta de duplicados en pacientes, médicos, enfermería y empleados.

- **Admisiones y Flujo Hospitalario**:
  - Vinculación directa con el paciente mediante Historia Médica y números secuenciales de episodio (`ADM`/`EP`).
  - Registro estructurado de Titular y Garante de Pago.
  - Bloqueo de admisiones activas simultáneas para un mismo paciente.
  - Cintillo verde superior derecho de **ADMITIDO** e indicador de **ALTA MÉDICA Y ADM. (INMUTABLE)**.
  - Trazabilidad y auditoría completa de cambios de área (Triaje, Pabellón, Recuperación, UCI, Hospitalización).
  - Modal y proceso formal de Alta Médica y Administrativa con epicrisis y liberación automática de camas.

- **Presupuestos y Cotizaciones (`sales`)**:
  - Modificación manual de precios unitarios y porcentajes de descuento en línea por ítem.
  - Recálculo en tiempo real con conversión dual a Bolívares (VES) usando la tasa oficial del BCV.
  - Catálogo y carga instantánea de Combos y Plantillas Clínicas (`ClinicalPackage`).

- **Experiencia de Usuario & Vistas Duales (Estilo Odoo)**:
  - Vistas conmutables de **Lista** y **Tablero Kanban** en Pacientes, Admisiones, Cotizaciones, Pagos, Personal, Equipo, Enfermería y Especialidades.
  - Menú lateral (Sidebar) colapsable con diseño limpio, botones modernos y secciones organizadas.

---

## [4.3.13] — 2026-05-06

### 🔧 Production Connectivity Fixes

- **API Configuration Refactor** — Se cambió el uso de subdominios explícitos (`api.medicalcare-888.com`) por rutas relativas (`/api`) en `api-config.ts`. Esto resuelve errores de resolución de DNS en despliegues monorepo de Vercel.
- **Hardcoded URL Removal** — Se reemplazaron referencias directas a `localhost:5000` por la constante dinámica `API_URL` en el componente de citas públicas.

---

## [4.3.12] — 2026-04-10

---

## [4.3.7] — 2026-04-10

### 🏥 System Resilience & Maintenance

- **Resilient Logger Boot** — Implementada validación de niveles de log en `logger.js` con fallback automático a `info`. Esto previene fallos de arranque ("Critical Boot Failure") causados por variables de entorno corruptas o con caracteres invisibles en Vercel.
- **Improved Log Cleansing** — Eliminación de strings residuales en archivos de configuración local.

---

## [4.3.6] — 2026-04-10

### 🛡️ Security & Architecture (Master Hardening)

- **Centralized Shield Middleware v3.0** — Migración al escudo de seguridad centralizado del ecosistema CGK888 via `middleware_acceso.js`.
- **RBAC Standardization** — Unificación global del rol `SUPERADMIN` en todo el core del backend y frontend.
- **Environment Whitelisting** — Seguridad reforzada mediante la externalización de administradores maestros a variables de entorno (`ALLOWED_MASTER_EMAILS`).
- **Data Integrity** — Sincronización persistente de identidad del usuario en `localStorage` para garantizar la efectividad del escudo de acceso.

---

## [4.3.5] — 2026-04-10

### 🛡️ Security & Access Control

- **CGK888 Shield Middleware** — Implementación del sistema de bloqueo universal `Shield Middleware`.
- **Enforced Payment Funnel** — Los accesos sin suscripción válida son redirigidos automáticamente a la pasarela de pagos de `cgk888.org`.
- **Environment Awareness** — El sistema de seguridad detecta automáticamente entornos de desarrollo (`localhost`) para permitir pruebas sin interrupciones.

---

## [4.3.4] — 2026-04-10

### ✨ New Features & Adaptations (Nomimus Style)

- **Hierarchical Security Model** — Implementado bypass global en `roleMiddleware.js` para `SUPERADMIN` (Root) y `PLATFORM_ADMIN` (Demo/Global).
- **Administrative Privacy** — Los `PLATFORM_ADMIN` ahora tienen restringida la visibilidad y modificación de cuentas `SUPERADMIN`.
- **Resilient SuperAdmin Seeding** — Endpoints de creación de administradores ahora son auto-recuperables.
- **Admin Dashboard Stats** — Métricas de conversión de trials y alertas de expiración inmediata.
- **Subscription Bypass Management** — Gestión de accesos VIP/Bypass por usuario.

### 🔒 Security & Backend

- **Root CRUD Access** — `SUPERADMIN` ahora tiene permisos de "usuario root" automáticos en toda la aplicación.
- **API Access Update** — Habilitado acceso global para demostraciones a favor del rol `PLATFORM_ADMIN`.
- **Extended Login Payload** — Inclusión de `subscriptionBypass` en la respuesta de autenticación.

---

## [4.3.3] — 2026-04-09

### ✨ New Features

- **Rol `PLATFORM_ADMIN` (Vendedor)** — Nuevo perfil de acceso a la Consola Maestro (`/platform-admin`) orientado al equipo de ventas:
  - Puede gestionar organizaciones (cambio de estado de suscripción) y usuarios (bloqueo/activación).
  - **Restricciones:** No puede eliminar usuarios ni crear cuentas `SUPERADMIN`.
  - Solo los emails `edwarvilchez1977@gmail.com` y `admin@clinicasaas.com` están autorizados para crear nuevos `SUPERADMIN` (validación a nivel de backend y UI).

### 🔒 Security

- `createSuperAdmin` — Añadida whitelist de emails a nivel de controlador. Cualquier `SUPERADMIN` que no sea uno de los dos emails autorizados recibe `403 Forbidden` al intentar crear otro `SUPERADMIN`.
- Rutas `/admin/*` ahora usan middleware por ruta en lugar de middleware global, permitiendo granularidad por endpoint.

### 🎨 UI

- Tab "Admins" en Consola Maestro oculto para usuarios `PLATFORM_ADMIN`.
- Selector de rol en formulario de creación: solo muestra la opción `SUPERADMIN` a los emails autorizados.
- Sidebar muestra el enlace a Gestión Global también para `PLATFORM_ADMIN`.

---

## [4.3.2] — 2026-04-09

### ✨ New Features

- **Manual Digital Interactivo** (`/.docs/manual-digital.html`):  
  Documentación embebida en HTML con imagen corporativa de MedicalCare 888, navegación lateral por módulos y botón de exportación a PDF integrado.

### 🎨 Branding & Corporate Identity

- **Email Templates** (`server/src/utils/emailTemplates.js`):
  - Color de cabecera actualizado de azul oscuro CGK (`#0f172a`) al **verde esmeralda corporativo** (`#10b981`).
  - Imagen alternativa del logo actualizada a `MedicalCare 888`.
  - Pie de página ahora bilingüe: *"Todos los derechos reservados / All rights reserved"*.
  - Nombre de la plataforma actualizado de `"CGK 888 Digital Ecosystem"` a `"MedicalCare 888 Health System"`.

- **Email Bienvenida** (`getWelcomeEmail`):
  - Saludo bilingüe: *"¡Bienvenido / Welcome!"*.
  - Labels del formulario de credenciales bilingüe: *"Usuario / User"*, *"Contraseña / Password"*.
  - Alerta de seguridad ahora en español e inglés.

### 📄 PDF Reports — Bilingual Support

- **Reportes de Laboratorio** (`client/src/app/services/lab-pdf.service.ts`):
  - Color de franja superior y separadores actualizado a verde esmeralda `RGB(16, 185, 129)`.
  - Eliminadas referencias a "Clinica SaaS Blue".
  - Soporte completo bilingüe en headers de tablas (ES/EN).

- **Reportes de Exportación General** (`client/src/app/services/export.service.ts`):
  - Header de PDF actualizado a verde esmeralda `RGB(16, 185, 129)`.
  - Labels bilingüe: *"EMITIDO POR / ISSUED BY"*, *"FECHA / DATE"*, *"UBICACIÓN / LOCATION"*.
  - Cuadro de certificación final bilingüe: *"DOCUMENTO CERTIFICADO / CERTIFIED"*.
  - Sello de verificación actualizado y ajuste de layout para evitar recortes de texto.

- **Reporte de Videoconsultas** (`client/src/app/components/video-history/video-history.ts`):
  - Color de header PDF actualizado de azul (`#4a90e2`) a verde esmeralda (`#10b981`).
  - Pie de página bilingüe: *"Generado / Generated"*.
  - Dominio actualizado a `MedicalCare888.com`.

### 🐛 Bug Fixes

- **`[object Object]` en botón exportar Pacientes** (`patients.html`):  
  La clave de traducción `'dashboard.report'` devolvía un objeto completo en lugar de un string.  
  Corregida a `'dashboard.reportBtn'` que devuelve correctamente `"Descargar Reporte"`.

- **Ícono roto en tab "Combos y Perfiles"** (`lab-catalog.html`):  
  La clase Bootstrap Icons `bi-grid-36-gap` no existe en la librería.  
  Reemplazada por `bi-grid-3x3-gap` ✅.

---

## [4.3.1] — 2026-04-08

### Platform Stabilization
- Production SuperAdmin initialization endpoint secured.
- Frontend build issues resolved for Vercel deployment.
- Multi-tenant `organizationId` isolation hook validated.
- ISO 27001 Audit Trail hooks confirmed operational.

---

## [4.3.0] — 2026-04-07

### Core Release
- WebRTC Telemedicine module (video-call, video-history).
- Bancamiga payment gateway integration (USD 3DS + Pago Móvil).
- Lab Catalog with CSV bulk import.
- Pharmaceutical guide (Vademécum).
- Platform Admin console for SaaS management.
