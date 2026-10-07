# MedicusVE  - Sistema de Gestión de Clínica SAAS

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
  - `PLATFORM_ADMIN` — Perfil vendedor con acceso completo a la consola maestro, excepto: no puede eliminar usuarios ni crear `SUPERADMIN`. Solo los emails `edwarvilchez1977@gmail.com` y `admin@clinicasaas.com` pueden crear nuevos `SUPERADMIN`.
- **Auditoría Inmutable (v4.3.0):** Implementación automática de registros para cumplimiento **ISO 27001**, capturando cada creación, edición o borrado de datos médicos y financieros.

## 🏗️ Arquitectura Unificada
Desde la v4.3.0, el sistema utiliza un **Núcleo de Fuente Única**:
- **Consolidación:** Desaparición de la carpeta `api/src` a favor de un `server/src` optimizado y compartido.
- **Seguridad Nativa:** Rate limiting y CSP integrados directamente en el servidor central.
- **Despliegue Serverless:** Puente nativo via `api/server.js` para máxima compatibilidad con Vercel.

## ✨ Funcionalidades Principales & Flujos Clínicos Integrales (v4.4.0)

### 🏥 1. Gestión de Pacientes & Historias Médicas
- **Identificación Estricta:** Selección exclusiva entre Cédula, Pasaporte o RIF. Formateo y limpieza automática a solo números (sin caracteres especiales ni espacios).
- **Historia Médica Inmutable:** Generación automática basada en la Cédula del paciente (`HC-CI`).
- **Seguros & Pólizas:** Opción condicional *"¿Viene por seguro?"* con captura de Aseguradora, Número de Póliza, Plan, Tipo de Titular/Beneficiario, Monto de Cobertura, Clave, Carta Aval y Número de Siniestro.
- **Historial Familiar y Clínico:** Registro de beneficiarios, antecedentes patológicos y núcleo familiar.
- **Prevención de Duplicados:** Validación estricta que previene duplicidad de registros en pacientes, médicos, enfermería y empleados.

### 🛏️ 2. Admisiones & Operaciones Hospitalarias
- **Vinculación por Historia Médica:** Asociación directa con el paciente mediante su `HC-CI` y generación de episodios secuenciales (`ADM-YYYY-XXXXX` / `EP-YYYY-XXXXX`).
- **Garante y Titular de Pago:** Captura estructurada del responsable financiero con documento formateado y compromiso de pago.
- **Restricción de Admisión Activa:** Un paciente con un episodio activo no puede tener otra admisión abierta simultáneamente.
- **Cintillo de Estado:** Indicador visual verde **ADMITIDO** durante la estancia activa y **ALTA MÉDICA Y ADM. (INMUTABLE)** tras el egreso.
- **Trazabilidad de Movimientos:** Auditoría completa de cada cambio de área (Triaje, Quirófano, UCI, Hospitalización) con registro de fecha, personal actuante y médico autorizante.
- **Alta Médica y Administrativa:** Cierre de episodio clínico con registro de epicrisis y liberación automática de camas hospitalarias.

### 💼 3. Presupuestos, Cotizaciones & Combos Clínicos (`sales`)
- **Modificación Manual de Precios en Línea:** Edición directa de cantidad, precio unitario en USD y porcentaje de descuento por ítem, con recálculo dinámico de subtotales.
- **Doble Moneda con Tasa BCV:** Conversión en tiempo real de subtotales y totales a Bolívares (VES) sincronizado con la tasa oficial del Banco Central de Venezuela.
- **Combos y Plantillas Predeterminadas:** Catálogo de paquetes quirúrgicos y diagnósticos precargados (Parto/Cesárea, Apendicectomía, Colecistectomía, Cirugía Menor, Perfil 20, Triaje) con carga instantánea y desglose personalizable.

### 📊 4. Vistas Duales Odoo (Lista & Tablero Kanban)
- Alternancia con un clic entre **Vista Lista** (tablas detalladas con ordenamiento y filtros) y **Tablero Kanban** (tarjetas por etapas operativas o turnos) disponible en Pacientes, Admisiones, Cotizaciones, Pagos, Personal, Equipo, Enfermería y Especialidades.

### 📐 5. Interfaz Moderna & Sidebar Colapsable
- Menú lateral colapsable (0px a 275px en desktop / offcanvas en móvil) con agrupación limpia por áreas: *Clínica*, *Operaciones*, *Administración*, *Facturación* y *Configuración*.

---

## 📦 Gestión de Ramas (Git Flow)
1. **`develop`**: Desarrollo y correcciones.
2. **`staging`**: Pruebas de integración.
3. **`master`**: Rama productiva sincronizada con Vercel.

---
© 2026 Clinica - SaaS. Todos los derechos reservados.
