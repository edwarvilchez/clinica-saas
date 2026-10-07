# MedicusVE - Guía de Despliegue v4.3.12 (Vercel + Supabase)

Esta guía documenta la infraestructura profesionalizada para el monorepo de MedicusVE .

## 🏗️ Arquitectura de Despliegue

- **Frontend**: Angular 21 (Ruta: `/client`)
- **Backend Bridge**: Node.js Proxy (Ruta: `/api/server.js`)
- **Backend Core**: Express Server (Ruta: `/server/src`)
- **Base de Datos**: Supabase (PostgreSQL con Connection Pooling)

## 🛰️ Configuración en Vercel

- **Root Directory**: `.` (Raíz del proyecto)
- **Settings**: "Include files outside the root directory in the Build Step" debe estar **HABILITADO**.
- **Enrutamiento**: Controlado por `vercel.json` optimizado para Angular SPA:
  - `/api/*` -> `/api/server.js` (Serverless Bridge)
  - Asset management para `.js`, `.css` y `/assets`
  - Fallback universal a `index.html` para ruteo interno de Angular.

## 🔑 Variables de Entorno Críticas (Vercel)

| Variable | Valor / Formato |
| :--- | :--- |
| `DATABASE_URL` | `postgresql://user:pass@db.qgtjmesaicjnjtlsibbq.supabase.co:6543/postgres?pgbouncer=true` |
| `NODE_ENV` | `production` |

> [!IMPORTANT]
> El ID de Supabase correcto es `qgtjmesaicjnjtlsibbq`. No omitir la 'j'.

## 🚀 Pipeline de CI/CD (GitHub Actions)

El despliegue es automático desde la rama **master**. Se utiliza el comando nativo de Vercel en la nube para asegurar el correcto mapeo de funciones serverless y archivos estáticos.

## 🛠️ Inicialización de Base de Datos

Una vez desplegado en producción, es obligatorio ejecutar la inyección del esquema visitando:
`https://clinica-saas-client.vercel.app/api/system/init-888?key=v888`

---
*Mantenido por el equipo de Arquitectura Elite MC888 - 2026*
