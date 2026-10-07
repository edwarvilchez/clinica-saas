# Changelog — Clínica SaaS

All notable changes to this project will be documented in this file.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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
