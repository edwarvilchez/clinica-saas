# MedicalCare 888 - Sistema de Gestión de Clínica SAAS

Sistema integral para la gestión de clínicas y videoconsultas médicas.

## 🚀 Despliegue de Producción (Vercel + Supabase)
- **Frontend**: Angular 21 (Servido desde `dist/client/browser`)
- **Backend**: Express.js (Funciones Serverless en `/api`)
- **Base de Datos**: Supabase PostgreSQL + Connection Pooler (IPv4)

### ⚙️ Configuración Crítica (Vercel Variables)
Para evitar errores de conectividad en entornos serverless (IPv6/IPv4), la `DATABASE_URL` **DEBE** usar el Transaction Pooler de Supabase:
`postgresql://postgres.[PROYECTO]:[PASSWORD]@aws-1-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true`

### Variables de Entorno Requeridas
| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `DATABASE_URL` | Connection string de Supabase (Transaction Pooler) | `postgresql://...pooler.supabase.com:6543/...` |
| `JWT_SECRET` | Secret para tokens JWT | (String aleatorio largo y seguro) |
| `INIT_SECRET` | Secret para endpoints de reset | (Solo para desarrollo local) |
| `ALLOWED_ORIGINS` | Dominios permitidos (comma-separated) | `https://tu-dominio.vercel.app` |
| `ALLOW_DB_RESET` | Habilitar reset de BD | `false` en producción |

### 🛡️ Seguridad de Contraseñas
- **Cambio obligatorio**: Los nuevos usuarios deben cambiar su contraseña en el primer inicio de sesión (`mustChangePassword: true`)
- **Hash seguro**: Las contraseñas se almacenan con bcrypt (salt rounds: 10)
- **Políticas**: Mínimo 6 caracteres, debe contener mayúscula, minúscula y número

### 🛠️ Inicialización del Sistema
⚠️ **DESHABILITADO en producción** - Los endpoints de reset solo funcionan en desarrollo local.

Para desarrollo local, agrega en `.env`:
```
ALLOW_DB_RESET=true
NODE_ENV=development
INIT_SECRET=tu_secret
```

Endpoints disponibles (solo local):
- `/api/system/init-888?key=INIT_SECRET` - Modo Demo (con datos de prueba)
- `/api/system/init-prod?key=INIT_SECRET` - Modo Producción (limpio)

## ✨ Página Informativa (Landing Page)
Desde la versión 4.5.0, el sistema incluye una página de aterrizaje premium accesible en la ruta raíz (`/`) o `/landing`.
- **Diseño Moderno:** Interfaz con efectos de glassmorphism, degradados vibrantes y optimizada para la conversión.
- **Secciones:** Hero interactivo, grid de funcionalidades, ventajas competitivas (segurida, velocidad, multi-dispositivo) y CTA para registro.
- **Navegación:** Enlace directo desde el login para informar a nuevos prospectos sobre los beneficios de la plataforma.

## 🛡️ Consola Maestro (Gestión Global)
El sistema incluye una consola de administración avanzada para el dueño de la plataforma y su equipo de ventas, accesible en `/platform-admin`.
- **Gestión de Organizaciones:** Visualización de todos los clientes, con capacidad para cambiar estados de suscripción (`ACTIVE`, `TRIAL`, `PAST_DUE`, `CANCELLED`).
- **Control de Usuarios:** Listado global de todos los usuarios registrados con opción de bloqueo/activación inmediata (bypass de acceso).
- **Roles de Plataforma:**
  - `SUPERADMIN` — Acceso total. Puede crear `PLATFORM_ADMIN` y `SUPERADMIN`.
  - `PLATFORM_ADMIN` — Perfil vendedor con acceso completo a la consola maestro, excepto: no puede eliminar usuarios ni crear `SUPERADMIN`. Solo los emails `edwarvilchez1977@gmail.com` y `cgk888digital@gmail.com` pueden crear nuevos `SUPERADMIN`.
- **Auditoría Inmutable (v4.3.0):** Implementación automática de registros para cumplimiento **ISO 27001**, capturando cada creación, edición o borrado de datos médicos y financieros.

## 🏗️ Arquitectura Unificada
Desde la v4.3.0, el sistema utiliza un **Núcleo de Fuente Única**:
- **Consolidación:** Desaparición de la carpeta `api/src` a favor de un `server/src` optimizado y compartido.
- **Seguridad Nativa:** Rate limiting y CSP integrados directamente en el servidor central.
- **Despliegue Serverless:** Puente nativo via `api/server.js` para máxima compatibilidad con Vercel.

## 📦 Gestión de Ramas (Git Flow)
1. **`develop`**: Desarrollo y correcciones.
2. **`staging`**: Pruebas de integración.
3. **`master`**: Rama productiva sincronizada con Vercel.

---
© 2026 MedicalCare 888. Desarrollado por CGK888Digital.
