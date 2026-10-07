# 🚀 Guía Rápida de Despliegue - Clínica SaaS (v4.3.13)

## ✅ Estado del Ecosistema

**Versión:** v4.3.13 - Production Ready  
**Plataforma:** Clínica SaaS - Sistema Integral de Gestión Médica y Hospitalaria  
**Infraestructura:** VPS Linux (Ubuntu / Debian) + Nginx + PM2 + PostgreSQL + Socket.IO WebSockets + Resend SDK / SMTP

---

## 📦 Arquitectura de Producción en VPS

✅ **Base de Datos (PostgreSQL):**
- Instancia nativa optimizada en VPS o clúster PostgreSQL dedicado.
- Pool de conexiones Sequelize configurado (2-20 conexiones concurrentes).
- Migraciones controladas por `sequelize-cli`.

✅ **Backend y Señalización WebSockets (Node.js/Express + PM2):**
- Ejecutado en modo cluster mediante PM2 (`ecosystem.config.js`).
- Señalización Socket.IO en tiempo real completamente soportada para videoconsultas médicas.
- Almacenamiento local persistente para archivos subidos (`uploads/`).

✅ **Frontend (Angular 21 SPA):**
- Compilación optimizada con Vite/esbuild en `client/dist/browser`.
- Servido directamente como archivos estáticos con compresión Gzip y headers de caché por Nginx.

✅ **Seguridad y Cumplimiento:**
- Rate limiting global y protección contra fuerza bruta.
- Sanitización de inputs y headers HTTP seguros (Helmet, CORS restringido).
- Inmutabilidad de auditoría de registros médicos (ISO 27001 / HIPAA).

---

## 🎯 Resumen de Comandos para Despliegue en VPS

### 1. Variables de Entorno (`server/.env`)
```env
NODE_ENV=production
PORT=5000
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=clinica_saas_bd
DB_USER=clinica_saas_admin
DB_PASSWORD=tu_password_seguro
JWT_SECRET=tu_jwt_secret_seguro
CLIENT_URL=https://tu-dominio.com
API_URL=https://tu-dominio.com/api
ALLOWED_ORIGINS=https://tu-dominio.com
RESEND_API_KEY=re_tu_api_key
FROM_NAME=Clínica SaaS
FROM_EMAIL=no-reply@tu-dominio.com
```

### 2. Puesta en Marcha
```bash
# 1. Compilar frontend
cd client && npm run build

# 2. Migrar base de datos
cd ../server && npx sequelize-cli db:migrate

# 3. Iniciar backend con PM2
cd .. && pm2 start ecosystem.config.js && pm2 save

# 4. Habilitar Nginx y SSL
sudo cp nginx.conf.example /etc/nginx/sites-available/clinica-saas
sudo ln -s /etc/nginx/sites-available/clinica-saas /etc/nginx/sites-enabled/
sudo systemctl reload nginx
sudo certbot --nginx -d tu-dominio.com
```

---
*© 2026 Clínica SaaS - Plataforma Médica Integral*
