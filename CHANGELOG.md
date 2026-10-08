# Changelog — Clínica SaaS

All notable changes to this project will be documented in this file.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [4.6.1] — 2026-10-08

### 🐛 Estabilización y Correcciones Críticas (Frontend & Backend Hotfix)

- **Backend (Resolución de Critical Boot Failure):**
  - Corrección de `SyntaxError: Missing catch or finally after try` en `server/src/controllers/hospital.controller.js` originado por anidamiento redundante de bloques `try`.
  - Unificación transaccional segura en `createAdmission`: protección atómica mediante `sequelize.transaction()` con reversión automática segura (`rollback`) en bloque `catch` unificado.
  - Validación del 100% de la sintaxis del backend con `node --check` y verificación de la suite completa de pruebas (49 suites, 422/422 pruebas en verde).
- **Frontend (Eliminación de Advertencias de Compilación Angular v21):**
  - Remoción de importaciones no utilizadas de `TranslatePipe` en componentes *standalone* que utilizan directamente `LanguageService` o cadenas literales:
    - `AccountingComponent` (`accounting.ts`)
    - `DoctorFeesComponent` (`doctor-fees.ts`)
    - `HospitalOpsComponent` (`hospital-ops.ts`)
    - `InsuranceComponent` (`insurance.ts`)
    - `InventoryComponent` (`inventory.ts`)
    - `Patients` (`patients.ts`)
    - `SpecialtiesComponent` (`specialties.ts`)
  - Compilación 100% limpia sin advertencias `NG8113` durante `ng serve` y `npm run build`.

---

## [4.6.0] — 2026-10-08

### 🛡️ Arquitectura Avanzada, Inteligencia Clínica, Seguridad WebRTC y Production Readiness (Fases 20 a 28)

- **Fase 20 — Automatización de No-Shows y Reconciliación de Citas:**
  - Marcado manual y automático de ausencias con registro en auditoría inmutable.
  - Tareas programadas de recordatorios y métricas analíticas de ausentismo por clínica.
- **Fase 21 — Inteligencia de Ingresos & Liquidación a Médicos (Revenue Intelligence):**
  - Métricas agregadas de ingresos brutos, netos, pasivos pendientes a médicos y ticket promedio en USD.
  - Reportes de series temporales y liquidación de honorarios médicos (*Fee Splits*).
- **Fase 22 — Auditoría Forense y Cumplimiento HIPAA / SOC-2:**
  - Trazabilidad append-only inmutable en `audit_logs` con encadenamiento criptográfico SHA-256.
  - Triggers inmutables en PostgreSQL (`trg_prevent_audit_log_mutation`) para protección contra manipulaciones.
- **Fase 23 — Portal del Paciente con Defensas Anti-IDOR:**
  - Aislamiento multi-tenant y verificación estricta de identidad para auto-consulta de historias, citas y recetas.
- **Fase 24 — Soporte a la Decisión Clínica con IA (CDSS):**
  - Sugerencias asistidas de codificación CIE-11 y resúmenes clínicos basados en LLMs.
  - Directiva ética obligatoria: aprobación y firma explícita del médico tratante previa a cualquier persistencia.
- **Fase 25 — Comunicaciones Desacopladas y Proveedores de WhatsApp:**
  - Arquitectura desacoplada para envío omnicanal (Meta WhatsApp Cloud API, Twilio, Resend, SMTP).
  - Emisión de eventos canónicos (`Communication.Sent`, `Communication.Delivered`, `Communication.Failed`).
- **Fase 26 — Endurecimiento de Telemedicina WebRTC:**
  - Emisión de Tokens Criptográficos de Sala (`JWT` con `sub: 'webrtc_room_access'`) con expiración corta.
  - Guard de señalización WebSocket que rechaza tokens forjados y limita la sala a un máximo estricto de 2 participantes (Médico + Paciente).
- **Fase 27 — Especificación y Diseño de Futuros Microservicios:**
  - Creación del documento normativo [`FUTURE_MICROSERVICES.md`](FUTURE_MICROSERVICES.md) analizando los 6 candidatos: Notifications, Clinical AI, File Storage, Telemedicine, Audit y Analytics.
  - Contratos de datos REST, gRPC y Event-Driven con catálogo de 42 eventos canónicos congelados.
- **Fase 28 — Production Readiness Check:**
  - Script automatizado de auditoría previa al despliegue: `npm run production:check`.
  - 16 verificaciones en 8 categorías (Secretos, Base de Datos, Migraciones, RLS, Auditoría, Storage, Health, Event Bus).
  - Verificación global: **49 suites pasadas, 422/422 pruebas en verde (100%)**.

---

## [4.5.0] — 2026-10-07

- **Multi-Environment Architecture**: Configuración de bases de datos y esquemas independientes para `develop` (`clinica_saas_dev`), `qa`/`staging` (`clinica_saas_qa`) y `production` (`clinica_saas_prod`).
- **QA & Prod Coexistence**: Orquestación simultánea en VPS mediante PM2 (puertos 5000 y 5001) y Nginx (`tu-dominio.com` y `qa.tu-dominio.com`).
- **Tenant Migration Engine (QA -> Prod)**: Herramienta CLI (`migrateTenantQaToProd.js`) para migrar atómicamente clínicas desde el ambiente de pruebas a producción al momento de contratar el servicio.
- **PM2 & Nginx Orchestration**: Incorporación de `ecosystem.config.js` y `nginx.conf.example` para clusterización, compresión gzip y SSL.
- **Branding Unificado**: Estandarización de la marca a **Clínica SaaS** en toda la interfaz de usuario, exportadores PDF, correos electrónicos y documentación.

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

- **API Configuration Refactor** — Se cambiaron los endpoints a rutas relativas `/api` compatibles con proxy inverso y subdominios dinámicos.
- **Hardcoded URL Removal** — Reemplazo de referencias estáticas por la constante dinámica `API_URL`.

---

## [4.3.7] — 2026-04-10

### 🏥 System Resilience & Maintenance

- **Resilient Logger Boot** — Validación de niveles de log en `logger.js` con fallback automático a `info`.
- **Improved Log Cleansing** — Eliminación de strings residuales en archivos de configuración local.

---

## [4.3.6] — 2026-04-10

### 🛡️ Security & Architecture

- **RBAC Standardization** — Unificación global del rol `SUPERADMIN` en todo el core del backend y frontend.
- **Environment Whitelisting** — Seguridad reforzada mediante la externalización de administradores maestros a variables de entorno (`ALLOWED_MASTER_EMAILS`).
- **Data Integrity** — Sincronización persistente de identidad del usuario en `localStorage`.

---

## [4.3.3] — 2026-04-09

### ✨ New Features & Security

- **Rol `PLATFORM_ADMIN` (Vendedor)** — Nuevo perfil de acceso a la Consola Maestro (`/platform-admin`) orientado al equipo comercial.
- **Restricción SuperAdmin** — Whitelist estricta de correos autorizados para la creación de nuevos `SUPERADMIN`.
- **Auditoría Inmutable (ISO 27001 / HIPAA)** — Ganchos automáticos de Sequelize para registro de trazabilidad de cada cambio en la BD.

---

## [4.3.0] — 2026-04-07

### Core Release
- Módulo de Telemedicina WebRTC (videoconsultas en tiempo real).
- Integración de pasarelas de pago y conversión dual de divisas.
- Catálogo de laboratorios e importación masiva CSV.
- Vademécum farmacéutico e inventario médico.
- Consola Maestro para administración multisede.
