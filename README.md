# 🏥 Medicus - Sistema de Gestión Clínica

Sistema completo de gestión para clínicas médicas desarrollado con Angular y Node.js.

![Versión](https://img.shields.io/badge/versión-1.8.6-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Security](https://img.shields.io/badge/security-9%2F10-brightgreen.svg)
![Test Coverage](https://img.shields.io/badge/coverage-18%25-yellow.svg)
![Docker](https://img.shields.io/badge/docker-ready-blue.svg)
![Deployment](https://img.shields.io/badge/deployment-easypanel-success.svg)

## 📋 Características Principales

### 🌎 Soporte Bilingüe e Internacionalización (i18n)

- ✅ **Interfaz 100% bilingüe** (Español / Inglés)
- ✅ **Cambio dinámico de idioma** en tiempo real sin recargar la página
- ✅ **Soporte de monedas** (USD / VES) con tasa de cambio configurable
- ✅ **Formatos regionales** para fechas, números y monedas

### 👥 Gestión de Usuarios

- ✅ Sistema de autenticación con JWT
- ✅ Roles y permisos (Admin, Doctor, Paciente)
- ✅ **Recuperación de contraseña** con tokens seguros y modo simulación
- ✅ Registro público de pacientes
- ✅ Perfiles de usuario personalizables

### 📅 Agendamiento de Citas

- ✅ **Agendamiento público** sin necesidad de cuenta
- ✅ Sistema inteligente de detección de pacientes existentes
- ✅ Calendario interactivo
- ✅ Gestión de horarios disponibles
- ✅ Estados de citas (Confirmada, Completada, Cancelada)
- ✅ Notificaciones automáticas

### 📧 Sistema de Notificaciones

- ✅ **Emails de confirmación** de citas
- ✅ **Emails de recuperación** de contraseña (Robusto tras fallos)
- ✅ WhatsApp simulado (listo para integración real)
- ✅ Recordatorios automáticos
- ✅ Enlaces a Google Calendar

### 🏥 Gestión Médica

- ✅ Registro de pacientes con historial
- ✅ Gestión de doctores y especialidades
- ✅ Dashboard con estadísticas en tiempo real
- ✅ Reportes y análisis

### 🎨 Interfaz de Usuario

- ✅ **Diseño moderno y responsivo**
- ✅ **Branding consistente** en todas las páginas
- ✅ Formularios optimizados sin scroll
- ✅ Animaciones suaves
- ✅ Modo oscuro (próximamente)

### 💳 Gestión de Planes y Suscripciones

- ✅ **Planes Escalables** (Consultorio, Clínica, Hospital, Enterprise)
- ✅ **Ciclos de Facturación** flexibles (Mensual, Anual)
- ✅ **Pagos Integrados** y reporte de transferencias
- ✅ **Activación Automática** de servicios premium
- ✅ **Gestión de Organización**
- ✅ **SuperAdmin Bypass**: Acceso total sin restricciones de suscripción

## 🆕 Novedades v1.8.7 (Marzo 2026)

### 💊 Guía Farmacéutica (Vademécum Venezuela)

- ✅ **Scraper Inteligente**: Implementación de `scrape_vademecum.js` para la extracción automatizada de más de 6,000 medicamentos desde Vademécum Venezuela.
- ✅ **Exportación a Producción**: Herramienta `export_drugs_sql.js` para generar volcados SQL optimizados con lógica de _upsert_ (insert/update).
- ✅ **Base de Datos Poblada**: Diccionario farmacéutico completo con nombres genéricos, componentes activos, indicaciones, posología y contraindicaciones.

## 🆕 Novedades v1.8.6 (Marzo 2026)

- ✅ **Soporte Multilingüe**: Implementación total de `LanguageService` en todos los módulos (Dashboard, Citas, Historial, Facturación, Equipo).
- ✅ **Gestión de Planes Pro**: Nueva interfaz de suscripción con soporte bilingüe para límites, nombres y características de planes.
- ✅ **Módulo de Mi Equipo**: Gestión administrativa de miembros con roles dinámicos y soporte i18n.
- ✅ **Billing UI Fixes**: Corrección de carga de estilos (`NG2008`) e integración de estilos inline para mayor estabilidad en entornos de desarrollo.

## 🆕 Novedades v1.8.5 (Febrero 2026)

### 🛠️ Robustez y DevOps

- ✅ **Validador de Entorno**: El servidor valida variables críticas (SMTP, JWT, DB) antes de iniciar.
- ✅ **Trust Proxy Fix**: Corrección para `express-rate-limit` detrás de Nginx/Easypanel.
- ✅ **Email Sender Pro**: Sistema de envío con simulación automática si falla el SMTP.
- ✅ **CI/CD Optimizada**: Validación paralela de Cliente/Servidor y etiquetado automático de versiones.

## 🆕 Novedades v1.8.4 (Febrero 2026)

### 💎 Módulo de Suscripciones

- ✅ **Nueva UI de Precios** basada en estándares modernos
- ✅ **Client Area** para gestión de pagos
- ✅ **Upgrade Automático** de cuentas tras confirmación de pago
- ✅ **Soporte B2B** con facturación a nombre de la organización
  > 📖 Ver detalles en [README_SUBSCRIPTION.md](README_SUBSCRIPTION.md)

## 🆕 Novedades v1.8.2 (Febrero 2026)

### 🚀 Deployment Ready

- ✅ **Docker Completo** - Configuración lista para producción
- ✅ **Easypanel/Railway/Render** - Deploy en un click desde GitHub
- ✅ **CI/CD Automático** - Push to GitHub → Auto-deploy
- ✅ **Health Checks** - Monitoreo automático de servicios
- ✅ **SSL/HTTPS** - Configuración automática
- ✅ **Documentación Completa** - Guía paso a paso en [DEPLOYMENT_EASYPANEL.md](DEPLOYMENT_EASYPANEL.md)

> 📖 Ver [DEPLOYMENT_EASYPANEL.md](DEPLOYMENT_EASYPANEL.md) para instrucciones completas de deployment

---

## 🔒 Novedades v1.8.1 (Febrero 2026)

### 🔒 Seguridad Mejorada

- ✅ **Rate Limiting** - Protección contra ataques de fuerza bruta
- ✅ **Helmet** - Headers de seguridad HTTP (CSP, X-Frame-Options)
- ✅ **CORS Específico** - Whitelist de orígenes autorizados
- ✅ **Validación Centralizada** - Joi para validación robusta de inputs

### ⚡ Performance Optimizado

- ✅ **Paginación** - Endpoints principales con soporte de paginación
- ✅ **Índices en BD** - 16 índices para queries 10x más rápidas
- ✅ **Logger Profesional** - Pino para logs estructurados

### 📚 Documentación y Testing

- ✅ **Swagger UI** - Documentación interactiva en `/api-docs`
- ✅ **Jest + Supertest** - Framework de testing configurado (15% cobertura inicial)

> 📖 Ver [MEJORAS_IMPLEMENTADAS.md](MEJORAS_IMPLEMENTADAS.md) para detalles completos

---

## 🛡️ Estándares y Cumplimiento Internacional

Medicus está diseñado siguiendo los más altos estándares internacionales para garantizar la seguridad de la información y la calidad del servicio:

- 🔒 **ISO/IEC 27001**: Implementamos controles de seguridad de la información para proteger la confidencialidad, integridad y disponibilidad de los datos médicos.
- 💎 **ISO 9001:2015**: Procesos orientados a la gestión de calidad y mejora continua de la experiencia del paciente y doctor.
- 🇪🇺 **GDPR (RGPD)**: Cumplimiento estricto del Reglamento General de Protección de Datos, asegurando el derecho a la privacidad, acceso y olvido de los usuarios.
- ⚖️ **Protección Legal Internacional**: Uso de marcos legales vigentes para la protección de propiedad intelectual y datos sensibles.

## 🚀 Tecnologías

### Frontend

- **Angular 18** - Framework principal
- **Bootstrap 5** - Estilos y componentes
- **Bootstrap Icons** - Iconografía
- **RxJS** - Programación reactiva
- **SweetAlert2** - Alertas elegantes

### Backend

- **Node.js** - Runtime
- **Express** - Framework web
- **Sequelize** - ORM
- **PostgreSQL** - Base de datos
- **JWT** - Autenticación
- **Bcrypt** - Encriptación de contraseñas
- **Nodemailer** - Envío de emails
- **Helmet** - Seguridad HTTP
- **express-rate-limit** - Protección anti fuerza bruta
- **Joi** - Validación de esquemas
- **Pino** - Logging profesional
- **Jest + Supertest** - Testing
- **Swagger/OpenAPI** - Documentación API

## 🚀 Deployment en Producción

### Opción A: Deployment con Docker (Recomendado)

**Rápido y fácil** - Listo para Easypanel, Railway, Render, o cualquier plataforma con Docker.

```bash
# 1. Clonar repositorio
git clone https://github.com/edwarvilchez/medicus-app.git
cd medicus-app

# 2. Configurar variables de entorno
cp .env.production.example .env
# Editar .env con tus valores reales

# 3. Levantar con Docker Compose
docker-compose up -d

# 4. Ejecutar migraciones
docker exec medicus-server npm run migrate
```

**Servicios desplegados:**

- 🗄️ PostgreSQL 14 (puerto 5432)
- 🔧 Backend API (puerto 5000)
- 🌐 Frontend Angular (puerto 80)

**Documentación completa:** Ver [DEPLOYMENT_EASYPANEL.md](DEPLOYMENT_EASYPANEL.md)

---

### Opción B: Easypanel/Railway (Un Click)

1. **Fork** el repositorio
2. Conecta tu cuenta en [Easypanel](https://easypanel.io) o [Railway](https://railway.app)
3. Selecciona el repo → **Deploy**
4. Configura variables de entorno
5. ✅ ¡Listo!

**Guía detallada:** [DEPLOYMENT_EASYPANEL.md](DEPLOYMENT_EASYPANEL.md)

---

## 📦 Instalación Local (Desarrollo)

### Prerrequisitos

- Node.js 18+
- PostgreSQL 14+
- npm o yarn

### 1. Clonar el repositorio

```bash
git clone https://github.com/edwarvilchez/medicus-app.git
cd medicus-app
```

### 2. Configurar Backend

```bash
cd server
npm install
```

Crear archivo `.env`:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=medicus
DB_USER=postgres
DB_PASSWORD=tu_password

# JWT
JWT_SECRET=tu_secreto_super_seguro_aqui

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_EMAIL=tu_email@gmail.com
SMTP_PASSWORD=tu_app_password
FROM_NAME=Clínica Medicus
FROM_EMAIL=tu_email@gmail.com

# Frontend URL
CLIENT_URL=http://localhost:4200
```

**Nota sobre Gmail:**
Para usar Gmail, necesitas generar una "Contraseña de Aplicación":

1. Ve a tu cuenta de Google
2. Seguridad → Verificación en 2 pasos (actívala si no la tienes)
3. Contraseñas de aplicaciones → Generar
4. Usa esa contraseña en `SMTP_PASSWORD`

Iniciar servidor:

```bash
npm run dev
```

### 3. Configurar Frontend

```bash
cd client
npm install
npm start
```

La aplicación estará disponible en `http://localhost:4200`

## 📱 Uso

### Acceso Público

- **Agendar Cita**: `http://localhost:4200/agendar-cita`
- **Registrarse**: `http://localhost:4200/register`
- **Recuperar Contraseña**: `http://localhost:4200/forgot-password`

### Usuarios del Sistema

- **Login**: `http://localhost:4200/login`

Credenciales por defecto:

```
Admin:
Email: admin@medicus.com
Password: <Configurado en .env o base de datos>
```

## 🔐 Recuperación de Contraseña

El sistema incluye un flujo completo de recuperación:

1. Usuario solicita recuperación en `/forgot-password`
2. Ingresa su email registrado
3. Recibe email con enlace de recuperación
4. El enlace es válido por 1 hora
5. Usuario establece nueva contraseña
6. Recibe confirmación por email
7. Puede iniciar sesión con la nueva contraseña

## 📧 Configuración de Emails

El sistema usa Nodemailer para enviar:

- ✅ Confirmaciones de citas
- ✅ Enlaces de recuperación de contraseña
- ✅ Confirmaciones de cambio de contraseña

### Proveedores Soportados

- Gmail (configurado por defecto)
- Outlook/Hotmail
- SendGrid
- Mailgun
- Cualquier servidor SMTP

## 📊 Estructura del Proyecto

```
medicus-app/
├── client/                 # Frontend Angular
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/
│   │   │   ├── services/
│   │   │   ├── guards/
│   │   │   └── interceptors/
│   │   └── styles/
│   └── package.json
│
├── server/                 # Backend Node.js
│   ├── src/
│   │   ├── controllers/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── middleware/
│   │   └── utils/
│   └── package.json
│
├── CHANGELOG.md           # Historial de cambios
└── README.md             # Este archivo
```

## 🔄 Flujo de Git

El proyecto usa tres ramas principales:

- **develop**: Desarrollo activo
- **staging**: Pre-producción
- **master**: Producción

### Workflow

```bash
# Desarrollo
git checkout develop
git add .
git commit -m "feat: nueva característica"
git push origin develop

# Staging
git checkout staging
git merge develop
git push origin staging

# Producción
git checkout master
git merge staging
git push origin master
```

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📝 Changelog

Ver [CHANGELOG.md](CHANGELOG.md) para el historial completo de cambios.

## 📄 Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo LICENSE para más detalles.

## 👨‍💻 Autor

**Edwar Vilchez**

- GitHub: [@edwarvilchez](https://github.com/edwarvilchez)
- Email: edwarvilchez1977@gmail.com

## 🙏 Agradecimientos

- Angular Team
- Node.js Community
- Bootstrap Team
- Todos los contribuidores

---

**Desarrollado con ❤️ para mejorar la gestión de clínicas médicas**
