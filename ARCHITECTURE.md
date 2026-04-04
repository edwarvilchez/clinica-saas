# 🏗️ Arquitectura del Proyecto - MedicalCare 888

**MedicalCare 888** es un sistema integral de gestión médica y hospitalaria diseñado para optimizar los flujos de trabajo clínicos y administrativos. Este documento detalla la arquitectura técnica, las tecnologías utilizadas y la estructura del código.

---

## 🚀 1. Stack Tecnológico

El sistema utiliza una arquitectura **Full Stack JavaScript (PERN/MEAN híbrido)** moderna:

### **Frontend (Cliente)**

- **Framework**: [Angular 21](https://angular.io/) (Uso de componentes **Standalone** y **Signals** para gestión de estado reactivo).
- **Estilos**: Bootstrap 5 + CSS personalizado con Glassmorphism y temas premium.
- **Gráficos**: Chart.js con ng2-charts.
- **Reportes**: jsPDF + jspdf-autotable para generación de PDFs en el cliente.
- **Notificaciones**: SweetAlert2.
- **Iconos**: Bootstrap Icons.

### **Backend (Servidor)**

- **Runtime**: [Node.js](https://nodejs.org/).
- **Framework**: [Express.js](https://expressjs.com/) para la API RESTful.
- **ORM**: [Sequelize](https://sequelize.org/) para manejo de base de datos relacional.
- **Seguridad**:
  - `jsonwebtoken` (JWT) para autenticación stateless.
  - `bcryptjs` para hashing de contraseñas.
  - `cors` y `helmet` para seguridad HTTP.

### **Base de Datos**

- **Motor**: SQL Relacional (compatible con PostgreSQL / MySQL).
- **Modelado**: Definido vía Sequelize Models.

---

## 📐 2. Patrones de Diseño

El sistema sigue una arquitectura **Cliente-Servidor (REST)** con separación clara de preocupaciones:

1.  **Modelo-Vista-Controlador (MVC) en Backend**:
    - **Modelos**: Definen la estructura de datos y relaciones (`server/src/models`).
    - **Controladores**: Contienen la lógica de negocio y orquestación (`server/src/controllers`).
    - **Rutas**: Definen los endpoints de la API (`server/src/routes`).

2.  **Arquitectura de Componentes en Frontend**:
    - **Servicios**: Capa de comunicación HTTP con el backend (Singleton).
    - **Componentes**: Lógica de presentación y UI.
    - **Guards**: Protección de rutas basada en autenticación.

---

## 📂 3. Estructura del Proyecto

### **Cliente (`/client`)**

```
client/src/app/
├── components/           # Componentes visuales (Páginas)
│   ├── dashboard/        # Panel principal con estadísticas
│   ├── doctors/          # Gestión de doctores
│   ├── lab-results/      # Módulo de laboratorio (Nuevo)
│   ├── login/            # Autenticación
│   └── shared/           # Componentes reutilizables (Sidebar, Navbar)
├── services/             # Lógica de comunicación con API y globales
│   ├── auth.service.ts   # Login/Register
│   ├── laboratory.service.ts # Gestión de resultados
│   ├── payment.service.ts # Transacciones financieras
│   ├── language.service.ts # Motor de traducción reactivo (Signals)
│   ├── currency.service.ts # Motor de conversión monetaria
│   └── stats.service.ts  # Datos para dashboard
├── guards/               # Protección de rutas (AuthGuard)
├── models/               # Interfaces TypeScript
└── app.routes.ts         # Definición de rutas del sistema
```

### **Servidor (`/server`)**

```
server/src/
├── config/               # Configuración de BD y entorno
├── controllers/          # Lógica de negocio (Endpoints)
│   ├── auth.controller.js
│   ├── stats.controller.js
│   └── ...
├── models/               # Definiciones de Tablas (Sequelize)
│   ├── User.js           # Usuario base
│   ├── Doctor.js         # Perfil extendido
│   ├── Appointment.js    # Citas médicas
│   └── index.js          # Relaciones (Associations)
├── routes/               # Rutas de Express
├── utils/                # scripts utilitarios (Seeds, Fixes)
└── app.js                # Punto de entrada
```

---

## 🔗 4. Modelo de Datos (Relaciones Clave)

El sistema utiliza un modelo relacional centrado en el usuario:

- **User**: Entidad central (Email, Password, Rol).
- **Roles**: `SUPERADMIN`, `DOCTOR`, `NURSE`, `ADMINISTRATIVE`, `PATIENT`.
- **Perfiles (Polimorfismo Simulado)**:
  - `User` 1:1 `Doctor` (Especialidad, Licencia).
  - `User` 1:1 `Patient` (Historial, Sangre).
  - `User` 1:1 `Nurse`.
- **Citas (Appointments)**:
  - Relaciona `Doctor` y `Patient`.
  - Tiene `Status` (Pending, Confirmed, Completed).
- **Resultados de Laboratorio**:
  - Relacionado con `Patient`.

---

## 🛠️ 5. Módulos y Características Clave

### **1. Autenticación y Seguridad (RBAC)**

El sistema implementa un control de acceso basado en roles (**RBAC**) robusto.

- **Roles Soportados**: `SUPER_ADMIN`, `ADMIN`, `DOCTOR`, `NURSE`, `PATIENT`.
- **Protección Backend**: Middleware de autenticación JWT. (Nota: ACL a nivel de rutas pendiente, lógica actual en controladores).
- **Protección Frontend**:
  - **Guards**: `AuthGuard` protege rutas privadas.
  - **Renderizado Condicional (User-Centric UI)**:
    - _Staff (Docs/Admin)_: Dashboard de gestión con KPIs financieros, métricas globales y agenda completa.
    - _Pacientes_: Interfaz simplificada y amigable centrada en "Mis Citas" y "Mis Resultados", sin ruido visual.

### **2. Módulo de Laboratorio y Reportes PDF**

Motor de generación de documentos clínicos dinámicos integrado en el cliente (Client-Side Rendering).

- **Tecnología**: `jsPDF` + `jspdf-autotable`.
- **Servicio Dedicado**: `LabPdfService` (Patrón Singleton).
- **Capacidades**:
  - **Generación On-the-fly**: Creación de Blobs PDF en memoria para visualización instantánea en nueva pestaña (sin descarga obligatoria).
  - **Descarga de Archivos**: Opción de guardar reporte en disco.
  - **Inteligencia Clínica**: Detección automática de valores fuera de rango (anomalías se renderizan en **rojo** y negrita).
  - **Diseño Profesional**: Membretes corporativos, grillas alineadas y estilos tipográficos fieles a la identidad institucional.

### **3. Diseño Responsivo y UI/UX**

La aplicación es totalmente **Cross-Device** (Escritorio, Tablet, Móvil).

- **Sidebar Off-Canvas**: Menú de navegación lateral responsivo. En móvil se oculta y desliza suavemente sobre el contenido, con _backdrop_ oscuro para cierre táctil.
- **Adaptive Layout**: Grillas CSS y Flexbox que reordenan tarjetas y tablas según el viewport.
- **Glassmorphism**: Estética moderna translúcida en componentes clave.

### **4. Gestión Médica Integral**

- **Citas**: Flujo completo de agendamiento, confirmación y ejecución.
- **Pacientes**: Expediente clínico digital centralizado.
- **Doctores**: Gestión de perfiles profesionales.

### **5. Inteligencia Financiera y Pagos (Version 1.4.x)**

Módulo avanzado para el control de ingresos y facturación de la clínica.

- **Búsqueda Reactiva**: Filtrado instantáneo por referencia, paciente o concepto.
- **Gestión de Cobros**: Flujo de estados (Pendiente/Pagado) con actualización en tiempo real.
- **Exportación de Reportes**: Generación de archivos CSV para auditorías externas.
- **Recibos Digitales**: Visualización de comprobantes con opción de impresión directa.

### **6. Historial Médico Inteligente (Version 1.7.0)**

Módulo de registro clínico evolucionado para garantizar precisión y facilidad de uso.

- **Resolución Automática de Identidad**: El sistema detecta y vincula automáticamente el perfil del doctor (`doctorId`) basado en el usuario logueado, eliminando errores de asignación.
- **Cálculo de Reposos Médicos**: Lógica inteligente que calcula automáticamente la **Fecha de Fin** de un reposo basándose en la fecha de inicio y la cantidad de días indicados, manejando correctamente las zonas horarias locales.
- **Impresión Detallada**: Los informes impresos ahora incluyen el desglose completo del reposo (Días, Desde, Hasta) para mayor claridad del paciente.
- **Integridad de Datos**: Esquema de base de datos reforzado con claves foráneas explícitas y tipos de datos precisos (`DATEONLY` para fechas de reposo).

### **7. Globalización y Flexibilidad (i18n & Multicurrency)**

El sistema ha sido diseñado para operar en entornos internacionales y mercados dinámicos.

- **Soporte Multidioma (ES/EN)**: Motor de traducción basado en **Angular Signals** que permite el cambio de idioma instantáneo en toda la UI sin recargar la aplicación.
- **Sistema Multimoneda (USD/VES)**:
  - Conversión dinámica de montos basada en una tasa de cambio configurable.
  - Visualización dual de precios en tablas y recibos (Moneda principal y equivalente estimado).
  - Persistencia de preferencias del usuario mediante LocalStorage.

---

## 🔄 6. Flujo de Datos

1.  **Login**: Usuario recibe JWT + User Profile.
2.  **Dashboard**: Angular decide qué vista mostrar (Paciente vs Staff) basado en `user.role`.
3.  **Consultas**: Componentes solicitan datos a API REST.
4.  **Reportes**: Datos JSON se transforman en documentos PDF directamente en el cliente (reduciendo carga en servidor y latencia).

---

## 🔄 6. Flujo de Trabajo (Workflow) Reciente

Para garantizar la estabilidad y funcionalidad, se han implementado scripts de mantenimiento:

- **Generación de Datos**: `server/src/utils/seedOperationalData.js` (Crea citas y pagos de prueba).
- **Reparación de Bases de Datos**: `server/src/utils/fixDatabase.js` (Agrega columnas faltantes sin borrar datos).
- **Corrección de Datos**: `server/src/utils/fixData.js` (Asigna valores a campos nulos).

---

---

## 🛡️ 7. Seguridad y Cumplimiento (Compliance)

El sistema ha sido arquitectado bajo pilares de seguridad robustos, alineándose con estándares internacionales:

### **1. ISO/IEC 27001 (Seguridad de la Información)**

- **Confidencialidad**: Encriptación de datos sensibles y transporte vía HTTPS.
- **Integridad**: Validación de esquemas en base de datos y sanitización de inputs.
- **Disponibilidad**: Arquitectura desacoplada lista para escalado horizontal.

### **2. GDPR / RGPD (Protección de Datos)**

- **Consentimiento Explícito**: Formulario de registro con aceptación de términos.
- **Privacidad por Diseño**: Acceso a datos médicos limitado estrictamente por roles de usuario.
- **Transparencia**: Notificaciones claras sobre el uso y tratamiento de la información personal.

### **3. ISO 9001:2015 (Gestión de Calidad)**

- **Enfoque en el Usuario**: Dashboards diferenciados para optimizar la experiencia del paciente y del clínico.
- **Mantenimiento Preventivo**: Scripts de utilería para integridad de bases de datos y estabilidad del sistema.

---

## 🚀 Despliegue y Ejecución

**Requisitos**: Node.js v18+, Base de datos SQL.

1.  **Backend**:

    ```bash
    cd server
    npm install
    npm run dev
    ```

2.  **Frontend**:
    ```bash
    cd client
    npm install
    npm start
    ```

---

---

## 🚀 8. Videoconsultas (v1.6.1+)

Sistema de telemedicina integrado para consultas médicas remotas.

- **Tecnología**: WebRTC para comunicación en tiempo real.
- **Servidor de Señalización**: Socket.io para coordinación de conexiones peer-to-peer.
- **Funcionalidades**:
  - Salas de videollamada dinámicas.
  - Notas médicas durante la consulta.
  - Generación de reportes PDF en tiempo real.
  - Notas de voz adjuntas.

---

## 📊 9. Gestión de Suscripciones SaaS (v1.8.4+)

Sistema de monetización multi-nivel para clínicas y hospitales.

- **Planes**: Consultorio, Clínica, Hospital, Enterprise.
- **Ciclos de Facturación**: Mensual y Anual.
- **Gestión de Pagos**: Sistema de reportes de transferencias bancarias.
- **Activación Automática**: Upgrade de cuenta tras confirmación de pago.
- **SuperAdmin Bypass**: Acceso ilimitado para usuarios estratégicos.

---

## 🔐 10. Seguridad Avanzada (v2.0.1+)

Refuerzos de seguridad para entornos de producción.

- **Rate Limiting**: Protección contra ataques de fuerza bruta.
- **Helmet**: Headers de seguridad HTTP (CSP, X-Frame-Options).
- **Login Robusto**: Búsqueda case-insensitive con trim de espacios.
- **Protección de Producción**: Seeder desactivado en entornos de producción.
- **Respeto de Contraseñas**: El registro utiliza la contraseña elegida por el usuario.

---

## 💊 11. Guía Farmacéutica (v1.8.7+)

Vademécum de medicamentos integrado.

- **Scraper Inteligente**: Extracción automatizada de 6,000+ medicamentos desde Vademécum Venezuela.
- **Exportación a Producción**: Herramienta para generar SQL con lógica de upsert.
- **Datos Incluidos**: Nombres genéricos, componentes activos, indicaciones, posología, contraindicaciones.

---

## 🔄 12. Sincronización de Ramas Git

Workflow de promoción de código entre entornos.

- **Ramas**: `develop` → `staging` → `master` → producción.
- **CI/CD**: GitHub Actions para promoción automática.
- **Easypanel**: Webhooks para auto-despliegue.

---

_Documentación actualizada por Antigravity Agent - Marzo 2026 (v2.1.0)_
