# 🚀 Clínica SaaS - Guía de Despliegue en VPS (Virtual Private Server)

Esta guía documenta la infraestructura y los pasos necesarios para desplegar **Clínica SaaS** en un servidor VPS propio (Ubuntu/Debian) con dominio personalizado, Nginx, PM2, PostgreSQL y SSL Let's Encrypt.

---

## 🏗️ Arquitectura de Despliegue

- **Frontend**: Angular 21 (Compilado en `client/dist/browser`, servido por Nginx como SPA estático de alto rendimiento).
- **Backend Core**: Node.js / Express (Ejecutado como servicio persistente en cluster via **PM2** en puerto `5000`).
- **WebSockets / Signaling**: Socket.IO nativo para videoconsultas en tiempo real.
- **Reverse Proxy & SSL**: **Nginx** manejando proxy inverso `/api/`, WebSockets `/socket.io/`, compresión Gzip y certificados HTTPS con Certbot.
- **Base de Datos**: **PostgreSQL 14+** (Instancia local en VPS o servidor dedicado) con pool de conexiones optimizado.
- **Almacenamiento de Archivos**: Directorio persistente `/server/uploads/` para historias médicas, recetas y adjuntos.

---

## 📋 Requisitos Previos en el VPS

- Servidor Linux (Ubuntu 22.04 LTS o 24.04 LTS recomendado).
- Acceso SSH con permisos `sudo`.
- Dominio apuntando a la IP pública del VPS (Registros DNS tipo `A`).
- Node.js 18+ o 20+ LTS instalado (`nvm` o NodeSource).
- PostgreSQL 14+ instalado y corriendo.
- Nginx y Certbot instalados.
- PM2 instalado globalmente (`npm install -g pm2`).

---

## ⚙️ Paso 1: Configurar la Base de Datos PostgreSQL

```bash
# Conectarse a PostgreSQL como superusuario
sudo -u postgres psql

# Crear usuario y base de datos
CREATE DATABASE clinica_saas_bd;
CREATE USER clinica_saas_admin WITH ENCRYPTED PASSWORD 'tu_password_seguro_aqui';
GRANT ALL PRIVILEGES ON DATABASE clinica_saas_bd TO clinica_saas_admin;
\c clinica_saas_bd
GRANT ALL ON SCHEMA public TO clinica_saas_admin;
\q
```

---

## 📦 Paso 2: Clonar el Proyecto y Preparar Dependencias

```bash
# Clonar en directorio de aplicaciones
cd /var/www
git clone -b develop https://github.com/edwarvilchez/clinica-saas.git
cd clinica-saas

# Instalar dependencias raíz y subproyectos
npm install
cd client && npm install && npm run build
cd ../server && npm install
cd ..
```

---

## 🔑 Paso 3: Configurar Variables de Entorno

Crear el archivo `/var/www/clinica-saas/server/.env`:

```env
# ===============================================
# CLÍNICA SAAS - PRODUCCIÓN VPS
# ===============================================
NODE_ENV=production
PORT=5000
LOG_LEVEL=info

# 🏠 BASE DE DATOS (PostgreSQL)
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=clinica_saas_bd
DB_USER=clinica_saas_admin
DB_PASSWORD=tu_password_seguro_aqui
DB_SSL=false
DB_POOL_MAX=20
DB_POOL_MIN=2

# 🛡️ SEGURIDAD
JWT_SECRET=genera_un_string_largo_y_aleatorio_aqui
ALLOWED_ORIGINS=https://tu-dominio.com,https://www.tu-dominio.com
ALLOW_DB_RESET=false

# 📧 EMAIL (Resend o SMTP)
RESEND_API_KEY=re_tu_api_key_aqui
FROM_NAME=Clínica SaaS
FROM_EMAIL=no-reply@tu-dominio.com

# 🌐 URLs
CLIENT_URL=https://tu-dominio.com
API_URL=https://tu-dominio.com/api
```

---

## 🗄️ Paso 4: Inicialización y Migraciones

```bash
cd /var/www/clinica-saas/server

# Ejecutar migraciones automáticas
npx sequelize-cli db:migrate

# Opcional: Para inicialización inicial limpia con SuperAdmin
node sync_db.js
```

---

## 🚀 Paso 5: Iniciar el Backend con PM2

```bash
cd /var/www/clinica-saas

# Iniciar procesos con PM2
pm2 start ecosystem.config.js

# Guardar estado para auto-reinicio al reiniciar el VPS
pm2 save
pm2 startup
```

---

## 🌐 Paso 6: Configuración de Nginx y SSL Let's Encrypt

1. Copiar y editar el template de Nginx:
```bash
sudo cp /var/www/clinica-saas/nginx.conf.example /etc/nginx/sites-available/clinica-saas
sudo nano /etc/nginx/sites-available/clinica-saas
# Reemplazar tu-dominio.com con el dominio real
```

2. Activar el sitio y validar:
```bash
sudo ln -s /etc/nginx/sites-available/clinica-saas /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

3. Obtener certificado SSL gratis con Certbot:
```bash
sudo certbot --nginx -d tu-dominio.com -d www.tu-dominio.com
```

---

## 🔄 Paso 7: Actualizaciones / Despliegues Posteriores

Para desplegar nuevas versiones desde Git:

```bash
cd /var/www/clinica-saas
git pull origin develop
cd client && npm run build
cd ../server && npx sequelize-cli db:migrate
pm2 reload clinica-saas-api
```

---
*© 2026 Clínica SaaS - Plataforma Médica Integral Multisede*
