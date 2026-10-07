# 🏢 Arquitectura Multi-Tenant y Seguridad de Aislamiento de Datos

## 🎯 Objetivo y Filosofía de Diseño
En **Clínica SaaS**, el aislamiento de datos entre organizaciones (clínicas, hospitales y centros médicos) es una prioridad crítica de primer orden. La arquitectura garantiza que:
1. **Cero Mezcla de Datos**: Ninguna organización puede acceder, listar, modificar ni inferir datos de otra organización.
2. **Cumplimiento Normativo**: Alineación con estándares de privacidad y confidencialidad médica (**HIPAA** e **ISO/IEC 27001**).
3. **Escalabilidad Multisede**: Cada cliente opera en un entorno virtualmente aislado con su propia configuración corporativa, baremos, pacientes e inventarios.

---

## 🛡️ Mecanismos de Aislamiento

### 1. Modelo de Datos con Clave Foránea Discriminadora (`organizationId`)
Todas las entidades del sistema que almacenan información sensible están asociadas directamente a un identificador único global (`UUID`) de organización:
- `Users` (`organizationId`)
- `Patients` (`organizationId`)
- `Doctors` (`organizationId`)
- `Nurses` (`organizationId`)
- `Staff` (`organizationId`)
- `Appointments` (`organizationId`)
- `MedicalRecords` (vinculado a `Patient.organizationId`)
- `Prescriptions` (vinculado a `MedicalRecord.patientId`)
- `Invoices / Payments` (`organizationId`)
- `Inventory / Pharmacy` (`organizationId`)
- `AuditLogs` (`organizationId`)

### 2. Scoping Automático y Contexto por Petición
- **Extracción de Identidad**: El middleware de autenticación (`authMiddleware`) decodifica el token JWT y extrae `userId`, `role` y `organizationId`.
- **Inyección Contextual**: Mediante `AsyncLocalStorage` y validadores en cada controlador, todas las consultas `SELECT`, `UPDATE`, `DELETE` y `INSERT` aplican forzosamente la cláusula:
  ```sql
  WHERE "organizationId" = :currentUserOrganizationId
  ```
- **Protección contra Inyección de Parámetros**: Si un usuario envía un `organizationId` diferente en el cuerpo (`body`) o parámetros (`params`) de la petición, el sistema lo sobrescribe forzosamente con el `organizationId` autenticado en su sesión.

### 3. Excepción de Plataforma: Superadministrador Maestro
- **Rol `SUPERADMIN`**: Únicamente los administradores globales de la plataforma pueden consultar métricas consolidadas o gestionar suscripciones en la consola maestro (`/platform-admin`).
- **Restricción a Datos Clínicos**: Incluso el `SUPERADMIN` mantiene trazabilidad inmutable mediante `AuditLogs` si realiza alguna acción asistida o soporte técnico.

---

## 🔒 Matriz de Control de Acceso (RBAC + Tenant Isolation)

| Rol | Alcance de Datos | Acceso a Pacientes | Acceso a Historias | Facturación |
|---|---|---|---|---|
| **SUPERADMIN** | Global (Gestión SaaS) | Sólo Auditoría | No Clínico | Planes y Licencias |
| **DOCTOR** | Su Organización | Pacientes asignados | Lectura/Escritura | Honorarios propios |
| **NURSE** | Su Organización | Pacientes en atención | Signos vitales | No |
| **RECEPTIONIST** | Su Organización | Registro y citas | No Clínico | Cobros y Pagos |
| **ADMINISTRATIVE** | Su Organización | Registro y citas | No Clínico | Reportes de Clínica |
| **PATIENT** | Únicamente sus propios datos | Propio perfil | Sólo sus recetas/citas | Sus pagos |

---

## 🧪 Pruebas de Verificación y Resistencia a Vulnerabilidades
1. **Prueba de Acceso Cruzado (Cross-Tenant Tampering)**: Peticiones `GET /api/patients/:id` con ID de otra clínica resultan inmediatamente en `403 Forbidden` o `404 Not Found`.
2. **Prueba de Inyección de Parámetro**: Modificación manual del payload de creación de citas forzando un `organizationId` ajeno es neutralizada por el middleware.
3. **Prueba de Búsqueda y Autocompletado**: Los endpoints de búsqueda rápida de pacientes y médicos filtran estrictamente por la organización del usuario autenticado.

---
*© 2026 Clínica SaaS - Documentación Técnica de Seguridad Multitenant*
