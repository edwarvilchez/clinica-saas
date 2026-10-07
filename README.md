# Clínica SaaS - Sistema Integral de Gestión Médica y Hospitalaria

Sistema SaaS multisede para la administración de clínicas, centros de salud, videoconsultas médicas, control de admisiones hospitalarias, baremos, seguros e historias clínicas.

---

## 📚 Documentación del Sistema

Para consultar las especificaciones técnicas completas y manuales operativos:

- [**Guía Completa de Despliegue en VPS (Ubuntu + Nginx + PM2 + SSL)**](DEPLOYMENT.md)
- [**Guía Rápida de Comandos para Puesta en Marcha**](DEPLOYMENT_GUIDE.md)
- [**Arquitectura Técnica del Sistema y Stack Tecnológico**](ARCHITECTURE.md)
- [**Arquitectura Multi-Tenant y Aislamiento Estricto de Datos**](docs/ARQUITECTURA_MULTITENANT.md)
- [**Esquema DDL de Base de Datos PostgreSQL**](server/schema_postgres.sql)
- [**Historial de Versiones y Cambios (Changelog)**](CHANGELOG.md)
- [**Manual Digital Interactivo para Usuarios**](.docs/manual-digital.html)

---

## 🏢 Aislamiento Multi-Tenant (Garantía de Cero Cruce de Datos)

El sistema cuenta con un motor estricto de aislamiento por inquilino (`Tenant Isolation Engine`):
- **Identificador Único (`organizationId`)**: Cada consulta SQL de lectura, modificación o eliminación incluye automáticamente el filtro por organización del usuario activo.
- **Sobrescritura Forzosa**: Todo payload entrante es sanitizado por el middleware de seguridad, previniendo inyecciones de identificadores de otras clínicas.
- **Cumplimiento HIPAA / ISO 27001**: Cada registro médico, receta y pago está blindado contra acceso cruzado no autorizado con trazabilidad inmutable mediante auditoría automática (`AuditLogs`).

---

## 🚀 Despliegue en Servidor VPS

- **Frontend**: Angular 21 (Compilado en `dist/client/browser` y servido por Nginx como SPA estático de alto rendimiento).
- **Backend**: Node.js / Express + Socket.IO (Ejecutado con PM2 en modo clúster para alta disponibilidad).
- **Base de Datos**: PostgreSQL 14+ con pool de conexiones nativo (2-20 conexiones concurrentes).
- **WebSockets**: Soportados nativamente para videollamadas WebRTC y notificaciones de llamada entrante en tiempo real.
- **Almacenamiento**: Persistencia de archivos en el directorio local `server/uploads/`.
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
| `JWT_SECRET` | Clave secreta para tokens JWT | `(string aleatorio largo)` |
| `ALLOWED_ORIGINS` | Dominios autorizados (separados por coma) | `https://tu-dominio.com` |
| `CLIENT_URL` | URL pública del frontend | `https://tu-dominio.com` |
| `API_URL` | URL pública del API | `https://tu-dominio.com/api` |
| `RESEND_API_KEY` | API Key para envío de correos (Resend) | `re_...` |

---

## 🛡️ Seguridad y Autenticación

- **2FA TOTP (RFC 6238)**: Doble factor de autenticación con código QR y tokens de 6 dígitos.
- **Firma Digital de Recetas**: Generación de hash SHA-256 y firma HMAC para validación pública con código QR.
- **Auditoría Inmutable**: Registro de trazabilidad para cumplimiento **ISO 27001** y **HIPAA**.
- **Control de Roles (RBAC)**: Superadmin, Doctor, Enfermería, Recepción, Administración y Paciente.

---

## 🛠️ Inicialización del Sistema

Para el despliegue inicial en desarrollo o VPS:

```bash
# 1. Migraciones de base de datos
cd server && npx sequelize-cli db:migrate

# 2. Inicialización inicial con usuario SuperAdmin maestro
node sync_db.js
```

---

## ✨ Módulos Principales

1. **Gestión de Pacientes e Historias Médicas**: Identificación estricta (Cédula/RIF/Pasaporte), seguros y antecedentes.
2. **Admisiones Hospitalarias**: Control de camas, movimientos entre áreas (Triaje, Quirófano, UCI, Piso), garantes y alta médica.
3. **Presupuestos y Facturación**: Catálogo de baremos, combos quirúrgicos, doble moneda en tiempo real (USD y Tasa BCV).
4. **Videoconsultas Médicas**: Salas virtuales WebRTC con señalización Socket.IO y notificaciones de llamada entrante.
5. **Vistas Duales Odoo**: Alternancia entre tabla detallada y tablero Kanban para gestión operativa ágil.

---

## 📦 Gestión de Ramas (Git Flow)

1. **`develop`**: Desarrollo y características activas.
2. **`staging`**: Pruebas de integración previas a producción.
3. **`master` / `main`**: Rama productiva para despliegue en VPS.

---
*© 2026 Clínica SaaS. Todos los derechos reservados.*
