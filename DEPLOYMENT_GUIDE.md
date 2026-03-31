# 🚀 Guía de Despliegue - MedicalCare 888 (v2.2.0)

## ✅ Estado del Ecosistema CGK 888

**Versión:** v2.2.0 - "Production Ready"
**Plataforma:** MedicalCare 888 Professional Clinics
**Stack:** Angular 21 + Node.js/Express + PostgreSQL (Supabase) + Resend SDK + Docker

---

## 📦 Arquitectura de Producción

✅ **Base de Datos (Supabase):**
- Conexión externa vía Connection String.
- Certificados SSL obligatorios (ya pre-configurados en `db.config.js`).

✅ **Emails (Resend):**
- Gestión mediante el SDK oficial.
- Plantillas dinámicas de CGK 888 con logo centralizado.
- Soporte para adjuntos y tracking.

✅ **Performance:**
- **Compresión Gzip:** Activada en el backend para entregas rápidas.
- **Lazy Loading:** Implementado en rutas pesadas y librerías externas (jsPDF, ExcelJS).

---

## 🎯 PASOS PARA DEPLOYMENT (Easypanel / Docker)

### 1️⃣ Variables de Entorno (.env)

Configura estas variables en tu panel de control de servidor:

```env
# Database (Supabase) - Asegúrate de incluir el puerto 5432 ó 6543
DB_URL=postgres://user:password@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?sslmode=require

# JWT
JWT_SECRET=node_generate_random_secret

# Email (Resend SDK)
RESEND_API_KEY=re_tu_api_key_aqui
FROM_NAME="MedicalCare 888"
FROM_EMAIL="no-reply@medicalcare-888.com"
BRAND_LOGO_URL=https://cgk888.com/images/logo.png

# URLs
CLIENT_URL=https://medicalcare-888.com
API_URL=https://api.medicalcare-888.com

# Env
NODE_ENV=production
PORT=5000
```

### 2️⃣ Procedimiento de Lanzamiento

1. **Build Frontend:** Angular 21 usa `esbuild`, el build es extremadamente rápido.
2. **Docker Orchestration:** Usa el archivo `docker-compose.prod.yml` para levantar la infraestructura sin base de datos local.
3. **Migraciones:** Una vez el servidor esté conectado a Supabase, ejecuta:
   ```bash
   npm run migrate
   ```

---

## 🔐 Seguridad y Robustez

- **Graceful Shutdown:** El servidor maneja `SIGTERM` y cierra conexiones de DB limpiamente.
- **CORS Hardened:** Solo se permiten dominios de CGK 888 y MedicalCare 888.
- **XSS Protection:** Sanitización automática de inputs médicos.
- **Security Headers:** Helmet configurado con estándares 2026.

---

## 📊 Mantenimiento

- **Logs:** Pino Logger configurado para salida estructurada (JSON) en producción.
- **Health Check:** `GET /health` verifica el estado del proceso y la conexión a la DB.

---

**Última actualización:** 30 de Marzo, 2026
**Equipos:** CGK 888 Digital Ecosystem + Antigravity (Advanced Agentic Coding Team)
