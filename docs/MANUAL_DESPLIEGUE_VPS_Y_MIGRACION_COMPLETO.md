# 📘 Manual Integral de Despliegue en VPS y Migración Multientorno (QA -> Producción)

> **Documento Unificado de Operaciones y Despliegue — Clínica SaaS (v4.5.0)**  
> Consolida la configuración del servidor VPS, bases de datos PostgreSQL independientes, orquestación concurrente con PM2, proxy inverso Nginx con SSL y el motor de migración de datos de prospectos (QA a Producción).

---

## 📑 Tabla de Contenidos
1. [Arquitectura de Entornos y Puertos](#1-arquitectura-de-entornos-y-puertos)
2. [Aprovisionamiento del Servidor VPS (Linux / Ubuntu)](#2-aprovisionamiento-del-servidor-vps-linux--ubuntu)
3. [Configuración de Bases de Datos PostgreSQL (Dev, QA y Prod)](#3-configuración-de-bases-de-datos-postgresql-dev-qa-y-prod)
4. [Estructura de Variables de Entorno (.env)](#4-estructura-de-variables-de-entorno-env)
5. [Compilación y Despliegue de Código](#5-compilación-y-despliegue-de-código)
6. [Orquestación de Procesos con PM2 (Modo Clúster y Fork)](#6-orquestación-de-procesos-con-pm2-modo-clúster-y-fork)
7. [Configuración de Nginx y Certificados SSL Let's Encrypt](#7-configuración-de-nginx-y-certificados-ssl-lets-encrypt)
8. [Motor de Migración de Datos de Clínicas (QA a Producción)](#8-motor-de-migración-de-datos-de-clínicas-qa-a-producción)
9. [Protocolo de Promoción Git (develop -> staging -> master)](#9-protocolo-de-promoción-git-develop---staging---master)
10. [Resolución de Problemas Frecuentes (Troubleshooting)](#10-resolución-de-problemas-frecuentes-troubleshooting)

---

## 1. Arquitectura de Entornos y Puertos

Para permitir que los prospectos evalúen el microSaaS sin poner en riesgo la privacidad ni el rendimiento de los clientes reales, el sistema opera con dos instancias simultáneas en el VPS:

| Entorno | Base de Datos | Puerto Backend | Dominio / Subdominio | Directorio Frontend | Propósito |
|---|---|---|---|---|---|
| **Production** | `clinica_saas_prod` | `5000` | `https://tu-dominio.com` | `/var/www/clinica-saas/client/dist/browser` | Clínicas y pacientes activos oficiales |
| **QA / Demo** | `clinica_saas_qa` | `5001` | `https://qa.tu-dominio.com` | `/var/www/clinica-saas-qa/client/dist/browser` | Demos, onboarding y pruebas de prospectos |
| **Development** | `clinica_saas_dev` | `5000` | `http://localhost:4200` | Local (máquina de desarrollo) | Desarrollo y pruebas unitarias |

---

## 2. Aprovisionamiento del Servidor VPS (Linux / Ubuntu)

Ejecuta estos comandos en tu servidor VPS (Ubuntu 22.04 LTS o 24.04 LTS):

```bash
# 1. Actualizar repositorios del sistema
sudo apt update && sudo apt upgrade -y

# 2. Instalar herramientas base
sudo apt install -y curl git ufw build-essential nginx certbot python3-certbot-nginx

# 3. Instalar Node.js 20 LTS (NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 4. Instalar PM2 globalmente
sudo npm install -g pm2

# 5. Instalar PostgreSQL 16
sudo apt install -y postgresql postgresql-contrib

# 6. Configurar Firewall (UFW)
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable
```

---

## 3. Configuración de Bases de Datos PostgreSQL (Dev, QA y Prod)

Accede a la consola de PostgreSQL:

```bash
sudo -u postgres psql
```

Ejecuta el script de aprovisionamiento de usuario y bases de datos aisladas:

```sql
-- 1. Crear usuario administrador con contraseña segura
CREATE USER clinica_saas_admin WITH ENCRYPTED PASSWORD 'TuPasswordSeguro2026!';

-- 2. Crear bases de datos independientes
CREATE DATABASE clinica_saas_qa;
CREATE DATABASE clinica_saas_prod;
CREATE DATABASE clinica_saas_dev;

-- 3. Otorgar permisos al usuario
GRANT ALL PRIVILEGES ON DATABASE clinica_saas_qa TO clinica_saas_admin;
GRANT ALL PRIVILEGES ON DATABASE clinica_saas_prod TO clinica_saas_admin;
GRANT ALL PRIVILEGES ON DATABASE clinica_saas_dev TO clinica_saas_admin;

-- 4. Habilitar extensión UUID en cada base de datos
\c clinica_saas_qa
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
GRANT ALL ON SCHEMA public TO clinica_saas_admin;

\c clinica_saas_prod
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
GRANT ALL ON SCHEMA public TO clinica_saas_admin;

\c clinica_saas_dev
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
GRANT ALL ON SCHEMA public TO clinica_saas_admin;

\q
```

---

## 4. Estructura de Variables de Entorno (.env)

### Para Producción (`/var/www/clinica-saas/server/.env`)
```env
NODE_ENV=production
PORT=5000
LOG_LEVEL=info

# BASE DE DATOS (PROD)
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=clinica_saas_prod
DB_USER=clinica_saas_admin
DB_PASSWORD=TuPasswordSeguro2026!
DB_SSL=false
DB_POOL_MAX=20
DB_POOL_MIN=2

# SEGURIDAD
JWT_SECRET=genera_un_string_criptografico_largo_y_aleatorio_prod
ALLOWED_ORIGINS=https://tu-dominio.com,https://www.tu-dominio.com
ALLOW_DB_RESET=false

# EMAILS
RESEND_API_KEY=re_tu_api_key_aqui
FROM_NAME=Clínica SaaS
FROM_EMAIL=no-reply@tu-dominio.com

# URLS
CLIENT_URL=https://tu-dominio.com
API_URL=https://tu-dominio.com/api

# PARAMETROS DE MIGRACIÓN QA -> PROD
DB_NAME_QA=clinica_saas_qa
DB_NAME_PROD=clinica_saas_prod
```

### Para QA / Demos (`/var/www/clinica-saas-qa/server/.env`)
```env
NODE_ENV=staging
PORT=5001
LOG_LEVEL=debug

# BASE DE DATOS (QA)
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=clinica_saas_qa
DB_USER=clinica_saas_admin
DB_PASSWORD=TuPasswordSeguro2026!
DB_SSL=false
DB_POOL_MAX=10
DB_POOL_MIN=1

# SEGURIDAD
JWT_SECRET=genera_un_string_criptografico_largo_y_aleatorio_qa
ALLOWED_ORIGINS=https://qa.tu-dominio.com
ALLOW_DB_RESET=true

# EMAILS
RESEND_API_KEY=re_tu_api_key_aqui
FROM_NAME=Clínica SaaS (Demo QA)
FROM_EMAIL=no-reply@tu-dominio.com

# URLS
CLIENT_URL=https://qa.tu-dominio.com
API_URL=https://qa.tu-dominio.com/api
```

---

## 5. Compilación y Despliegue de Código

```bash
# -------------------------------------------------------------
# 1. DESPLIEGUE DE PRODUCCIÓN (Rama master / staging)
# -------------------------------------------------------------
sudo mkdir -p /var/www/clinica-saas
sudo chown -R $USER:$USER /var/www/clinica-saas
cd /var/www/clinica-saas
git clone -b master https://github.com/edwarvilchez/clinica-saas.git .

# Instalar y compilar Producción
npm install
cd client && npm install && npm run build
cd ../server && npm install
npx sequelize-cli db:migrate
node sync_db.js # Inicializa SuperAdmin inicial limpio
cd ..

# -------------------------------------------------------------
# 2. DESPLIEGUE DE QA / DEMOS (Rama staging)
# -------------------------------------------------------------
sudo mkdir -p /var/www/clinica-saas-qa
sudo chown -R $USER:$USER /var/www/clinica-saas-qa
cd /var/www/clinica-saas-qa
git clone -b staging https://github.com/edwarvilchez/clinica-saas.git .

# Instalar y compilar QA
npm install
cd client && npm install && npm run build
cd ../server && npm install
NODE_ENV=staging DB_NAME=clinica_saas_qa npx sequelize-cli db:migrate
NODE_ENV=staging DB_NAME=clinica_saas_qa node sync_db.js
cd ..
```

---

## 6. Orquestación de Procesos con PM2 (Modo Clúster y Fork)

El archivo `ecosystem.config.js` en la raíz gestiona ambos ambientes:

```javascript
module.exports = {
  apps: [
    // PRODUCCIÓN: Modo Clúster (Todos los cores de CPU disponibles)
    {
      name: 'clinica-saas-prod',
      cwd: '/var/www/clinica-saas',
      script: 'server/src/index.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
        DB_NAME: 'clinica_saas_prod'
      },
      max_memory_restart: '500M',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '/var/www/clinica-saas/logs/prod-error.log',
      out_file: '/var/www/clinica-saas/logs/prod-out.log',
      merge_logs: true,
      restart_delay: 3000,
      autorestart: true
    },

    // QA / DEMOS: Modo Fork (1 proceso ligero)
    {
      name: 'clinica-saas-qa',
      cwd: '/var/www/clinica-saas-qa',
      script: 'server/src/index.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'staging',
        PORT: 5001,
        DB_NAME: 'clinica_saas_qa'
      },
      max_memory_restart: '300M',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '/var/www/clinica-saas-qa/logs/qa-error.log',
      out_file: '/var/www/clinica-saas-qa/logs/qa-out.log',
      merge_logs: true,
      restart_delay: 3000,
      autorestart: true
    }
  ]
};
```

### Comandos de Gestión con PM2
```bash
# Iniciar ambos servicios
pm2 start /var/www/clinica-saas/ecosystem.config.js

# Guardar configuración para reinicios del sistema
pm2 save
pm2 startup # Ejecuta la línea indicada por PM2 con sudo

# Ver estado en tiempo real
pm2 status
pm2 monit

# Reinicio sin caída de servicio (Zero-downtime)
pm2 reload clinica-saas-prod
pm2 reload clinica-saas-qa
```

---

## 7. Configuración de Nginx y Certificados SSL Let's Encrypt

Crea el archivo `/etc/nginx/sites-available/clinica-saas`:

```nginx
# ==============================================================================
# PRODUCCIÓN: tu-dominio.com -> Proxy al Backend en Puerto 5000
# ==============================================================================
server {
    listen 80;
    listen [::]:80;
    server_name tu-dominio.com www.tu-dominio.com;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 301 https://$host$request_uri; }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name tu-dominio.com www.tu-dominio.com;

    ssl_certificate /etc/letsencrypt/live/tu-dominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tu-dominio.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    gzip on;
    client_max_body_size 25M;

    # Frontend Producción
    root /var/www/clinica-saas/client/dist/browser;
    index index.html;
    location / { try_files $uri $uri/ /index.html; }
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }

    # Backend API Producción (PM2 5000)
    location /api/ {
        proxy_pass http://127.0.0.1:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSockets Producción (Socket.IO)
    location /socket.io/ {
        proxy_pass http://127.0.0.1:5000/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Uploads Producción
    location /uploads/ {
        alias /var/www/clinica-saas/server/uploads/;
        expires 7d;
        add_header Cache-Control "public";
    }
}

# ==============================================================================
# QA / DEMOS: qa.tu-dominio.com -> Proxy al Backend en Puerto 5001
# ==============================================================================
server {
    listen 80;
    listen [::]:80;
    server_name qa.tu-dominio.com;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 301 https://$host$request_uri; }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name qa.tu-dominio.com;

    ssl_certificate /etc/letsencrypt/live/tu-dominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tu-dominio.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    gzip on;
    client_max_body_size 25M;

    # Frontend QA
    root /var/www/clinica-saas-qa/client/dist/browser;
    index index.html;
    location / { try_files $uri $uri/ /index.html; }

    # Backend API QA (PM2 5001)
    location /api/ {
        proxy_pass http://127.0.0.1:5001/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSockets QA
    location /socket.io/ {
        proxy_pass http://127.0.0.1:5001/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Uploads QA
    location /uploads/ {
        alias /var/www/clinica-saas-qa/server/uploads/;
        expires 3d;
        add_header Cache-Control "public";
    }
}
```

### Activación y Certificado SSL
```bash
# Activar sitio en Nginx
sudo ln -s /etc/nginx/sites-available/clinica-saas /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Obtener certificado SSL multi-dominio con Certbot
sudo certbot --nginx -d tu-dominio.com -d www.tu-dominio.com -d qa.tu-dominio.com
```

---

## 8. Motor de Migración de Datos de Clínicas (QA a Producción)

Cuando un cliente potencial prueba el sistema en `qa.tu-dominio.com`, configura su personal, especialidades y catálogo, y luego adquiere la suscripción, puedes migrar todos sus datos a Producción en segundos sin necesidad de que vuelvan a registrar nada.

### Qué migra la herramienta:
- Organización (cambiando su suscripción a `ACTIVE`).
- Todos sus Usuarios (dueño, doctores, enfermeros, recepcionistas), **preservando sus contraseñas hasheadas** para que puedan ingresar de inmediato.
- Doctores y Enfermería asociados.
- Especialidades y Departamentos vinculados.
- Catálogo de Inventario y Farmacia.
- Combos y Paquetes Clínicos (`ClinicalPackages`).
- Opcional: Pacientes e Historias Médicas creadas en el periodo de prueba.

### Comandos de Ejecución:

```bash
cd /var/www/clinica-saas/server

# 1. Simulación Previa (DRY-RUN): Valida sin modificar nada en Producción
npm run migrate:tenant-qa-to-prod -- --slug clinica-san-rafael --dry-run

# 2. Migración Real de Configuración Médica y Personal
npm run migrate:tenant-qa-to-prod -- --slug clinica-san-rafael

# 3. Migración Completa (Incluyendo Pacientes creados durante la prueba)
npm run migrate:tenant-qa-to-prod -- --slug clinica-san-rafael --include-patients
```

> [!IMPORTANT]
> **Seguridad Transaccional**: La migración se ejecuta dentro de una transacción `BEGIN ... COMMIT`. Si ocurre cualquier conflicto (ejemplo: email ya registrado en producción), se aplica un `ROLLBACK` automático garantizando que la base de datos de producción no quede en un estado inconsistente.

---

## 9. Protocolo de Promoción Git (develop -> staging -> master)

Para evitar errores de despliegue y conflictos de fusión en el servidor:

```bash
# Paso 1: En tu máquina local, asegurar que develop esté al día
git checkout develop
git pull origin develop

# Paso 2: Promover cambios a staging (para el ambiente QA)
git checkout staging
git pull origin staging
git merge develop
git push origin staging

# Paso 3: Promover a master (para el ambiente de Producción)
git checkout master
git pull origin master
git merge staging
git push origin master

# Paso 4: Volver a develop para continuar trabajando
git checkout develop
```

---

## 10. Resolución de Problemas Frecuentes (Troubleshooting)

### Error: `CONFLICT in DEPLOYMENT_GUIDE.md or README.md`
Ocurre cuando la rama destino tiene modificaciones manuales directas.
**Solución:**
```bash
git checkout develop -- DEPLOYMENT_GUIDE.md README.md
git add DEPLOYMENT_GUIDE.md README.md
git commit -m "merge: resolve documentation conflicts from develop"
git push origin staging  # (o master según la rama en conflicto)
```

### Error: `WebSockets connection failed in production`
Verifica que el bloque `location /socket.io/` en Nginx tenga las cabeceras `Upgrade` y `Connection "Upgrade"` activas y que apunte al puerto correcto (`5000` para Prod, `5001` para QA).

### Error: `Database connection error: password authentication failed`
Verifica que las contraseñas en el archivo `.env` coincidan con las configuradas en PostgreSQL:
```bash
psql -U clinica_saas_admin -h 127.0.0.1 -d clinica_saas_prod
```

### Reiniciar el servicio completo en el VPS tras actualizar código:
```bash
cd /var/www/clinica-saas
git pull origin master
cd client && npm run build
cd ../server && npx sequelize-cli db:migrate
pm2 reload clinica-saas-prod
```
