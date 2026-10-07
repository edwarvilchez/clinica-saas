# Clínica SaaS - Sistema Integral de Gestión Médica y Hospitalaria

Sistema SaaS multisede para la administración de clínicas, centros de salud, videoconsultas médicas, control de admisiones hospitalarias, baremos, seguros e historias clínicas.

---

## 🚀 Despliegue en Servidor VPS

- **Frontend**: Angular 21 (Compilado en `dist/client/browser` y servido por Nginx)
- **Backend**: Express.js + Socket.IO (Ejecutado con PM2 en cluster)
- **Base de Datos**: PostgreSQL 14+ con pool de conexiones nativo
- **WebSockets**: Soportados nativamente para videollamadas y notificaciones en tiempo real
- **Almacenamiento**: Persistencia de archivos en `server/uploads/`

---

## ⚙️ Variables de Entorno Requeridas

| Variable | Descripción | Ejemplo |
|---|---|---|
| `DB_HOST` | Host del servidor PostgreSQL | `127.0.0.1` o IP del clúster |
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
# Migraciones de base de datos
cd server && npx sequelize-cli db:migrate

# Inicialización inicial con usuario SuperAdmin maestro
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
