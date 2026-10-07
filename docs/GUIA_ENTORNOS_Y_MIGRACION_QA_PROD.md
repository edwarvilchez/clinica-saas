# 🌐 Guía de Entornos Separados (Dev / QA / Prod) y Migración de Datos (QA -> Prod)

Esta guía explica la arquitectura de bases de datos independientes para **Clínica SaaS**, cómo desplegar simultáneamente el ambiente **QA (Demo / Prospectos)** y **Producción (Clientes Reales)** en el mismo VPS, y cómo migrar una clínica de QA a Producción cuando deciden contratar el servicio.

---

## 🏗️ 1. Arquitectura de Entornos y Bases de Datos

| Entorno | Base de Datos PostgreSQL | Puerto Backend | Dominio / URL | Propósito |
|---|---|---|---|---|
| **Development** | `clinica_saas_dev` | `5000` | `http://localhost:4200` | Desarrollo local de nuevas funciones |
| **QA / Staging** | `clinica_saas_qa` | `5001` | `https://qa.tu-dominio.com` | Demostraciones y pruebas para prospectos |
| **Production** | `clinica_saas_prod` | `5000` | `https://tu-dominio.com` | Clínicas y hospitales activos en producción |

> [!TIP]
> **Aislamiento Total**: Al mantener bases de datos separadas (`clinica_saas_qa` y `clinica_saas_prod`), los prospectos pueden realizar pruebas masivas, crear doctores y manipular inventarios en QA sin poner en riesgo la integridad, rendimiento ni confidencialidad médica de las clínicas en producción.

---

## ⚙️ 2. Creación de las Bases de Datos en el VPS

En el servidor PostgreSQL de tu VPS:

```bash
sudo -u postgres psql
```

```sql
-- 1. Crear las bases de datos independientes
CREATE DATABASE clinica_saas_qa;
CREATE DATABASE clinica_saas_prod;

-- 2. Asignar permisos al usuario de la aplicación
GRANT ALL PRIVILEGES ON DATABASE clinica_saas_qa TO clinica_saas_admin;
GRANT ALL PRIVILEGES ON DATABASE clinica_saas_prod TO clinica_saas_admin;

-- 3. Habilitar extensión UUID en ambas bases de datos
\c clinica_saas_qa
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
GRANT ALL ON SCHEMA public TO clinica_saas_admin;

\c clinica_saas_prod
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
GRANT ALL ON SCHEMA public TO clinica_saas_admin;

\q
```

---

## 🚀 3. Orquestación Simultánea en el VPS con PM2

El archivo [`ecosystem.config.js`](../ecosystem.config.js) está preconfigurado para levantar ambos servicios en simultáneo:

- **`clinica-saas-prod`**: Modo clúster, puerto `5000`, conectada a `clinica_saas_prod`.
- **`clinica-saas-qa`**: Modo fork, puerto `5001`, conectada a `clinica_saas_qa`.

### Inicialización de Migraciones y Servicios
```bash
# Migrar la base de datos de QA
NODE_ENV=staging DB_NAME=clinica_saas_qa npx sequelize-cli db:migrate

# Migrar la base de datos de Producción
NODE_ENV=production DB_NAME=clinica_saas_prod npx sequelize-cli db:migrate

# Iniciar ambos ambientes con PM2
pm2 start ecosystem.config.js
pm2 save
```

---

## 🌐 4. Configuración de Nginx para Doble Dominio (Prod y QA)

El archivo [`nginx.conf.example`](../nginx.conf.example) contiene los bloques para ambos dominios:

1. **Producción**:
   - `server_name tu-dominio.com www.tu-dominio.com;`
   - Proxy inverso a `http://127.0.0.1:5000/api/`
2. **QA / Demos**:
   - `server_name qa.tu-dominio.com;`
   - Proxy inverso a `http://127.0.0.1:5001/api/`

### Generación de Certificados SSL
```bash
sudo certbot --nginx -d tu-dominio.com -d www.tu-dominio.com -d qa.tu-dominio.com
```

---

## 🔄 5. Flujo de Conversión: Migración de Clínica de QA a Producción

Cuando un prospecto prueba el microSaaS en `qa.tu-dominio.com`, configura su clínica y decide contratar el plan, no necesita volver a cargar su información manualmente.

### Herramienta CLI de Migración Atómica

El motor [`server/src/scripts/migrateTenantQaToProd.js`](../server/src/scripts/migrateTenantQaToProd.js) migra automáticamente todos los datos del tenant:
- **Organización**: Datos comerciales, slug, logo y estado actualizado a `ACTIVE`.
- **Usuarios & Credenciales**: Propietario, administradores, doctores, enfermeros y secretarias (preservando los hashes de contraseña para que puedan ingresar inmediatamente con las mismas claves).
- **Especialidades y Departamentos**: Estructura médica configurada.
- **Inventario & Baremos**: Ítems de farmacia y paquetes clínicos precargados.
- **Transacción Atómica**: Si ocurre cualquier fallo durante el proceso, se ejecuta un rollback completo sin afectar la base de datos de producción.

### Comandos de Ejecución

#### Paso A: Simulación Previa (Dry-Run)
Verifica que la organización exista en QA, que no haya colisiones en Prod y comprueba todos los registros sin escribir ningún cambio:
```bash
cd /var/www/clinica-saas/server
npm run migrate:tenant-qa-to-prod -- --slug clinica-san-rafael --dry-run
```

#### Paso B: Migración Real de Configuración y Personal
Migra la clínica, su personal médico y su inventario:
```bash
npm run migrate:tenant-qa-to-prod -- --slug clinica-san-rafael
```

#### Paso C: Migración Completa (Incluyendo Pacientes)
Si la clínica atendió pacientes reales durante el periodo de prueba y desea conservarlos:
```bash
npm run migrate:tenant-qa-to-prod -- --slug clinica-san-rafael --include-patients
```

---
*© 2026 Clínica SaaS - Documentación de Arquitectura de Entornos y Migración*
