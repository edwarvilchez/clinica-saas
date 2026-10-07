# 🏛️ ARCHITECTURE — CLÍNICA SAAS
> **Arquitectura Objetivo:** Modular Monolith + Domain Boundaries + Domain Events + Service Abstractions  
> **Enfoque Estratégico:** Máxima cohesión interna, mínimo acoplamiento y preparación para extracción selectiva a microservicios cuando el volumen lo justifique.

---

## 1. Principio Rector: Monolito Modular Primero

En esta fase de evolución, la aplicación **NO se dividirá en microservicios prematuros**. Se adopta la arquitectura de **Monolito Modular**, cuyas directrices son:

- **Un único proceso de ejecución principal y una base de datos central PostgreSQL**, eliminando la sobrecarga de red, fallos distribuidos y complejidad operacional innecesaria.
- **Límites de dominio estrictos (Bounded Contexts)**: Cada módulo posee sus propias entidades, servicios de aplicación y controladores.
- **Comunicación asíncrona mediante Eventos de Dominio**: Los módulos no se llaman directamente en cascada para efectos secundarios, sino que emiten eventos a través de un `DomainEventBus` interno.
- **Abstracción de Servicios Externos**: Todo servicio dependiente de infraestructura (notificaciones, almacenamiento de archivos, IA, analítica) se encapsula tras una interfaz genérica.

```mermaid
graph TD
    subgraph "Clients"
        WebClient["Angular 21 Client SPA"]
        MobileClient["Mobile / Portal Paciente"]
    end

    subgraph "API Gateway & Security Layer"
        ReverseProxy["Nginx Reverse Proxy + SSL"]
        RateLimiter["Rate Limiting & Helmet"]
        AuthMiddleware["JWT & Request Context Middleware"]
        TenantContext["Tenant Context Injection (RLS)"]
    end

    subgraph "Modular Monolith Application Core"
        subgraph "Core Business Domains"
            IdentityModule["Identity & Access (RBAC)"]
            TenantModule["Organization & Multi-tenancy"]
            PatientModule["Patient & Clinical Timeline"]
            AppointmentModule["Appointments & Agenda"]
            BillingModule["Billing, Quotes & Claims"]
            ClinicalModule["Medical Records, Labs & Pharmacy"]
        end

        subgraph "Internal Domain Event Bus"
            EventBus["In-Memory Domain Event Bus"]
        end

        subgraph "Service Abstractions (Candidates for Extraction)"
            NotificationSvc["NotificationService (Email / SMS / WhatsApp)"]
            FileStorageSvc["FileStorageService (Local / S3 / MinIO)"]
            AuditSvc["AuditService (Tamper-Evident SHA-256)"]
            AISvc["AIService (Clinical Copilot / Doctor Approval)"]
            TelemedSvc["TelemedicineService (WebRTC Signaling)"]
            AnalyticsSvc["AnalyticsService (Reporting & BI)"]
        end
    end

    subgraph "Data & Persistence Tier"
        PostgresDB[(PostgreSQL 16 + Row Level Security)]
        Storage[(Secure File Storage)]
    end

    WebClient --> ReverseProxy
    MobileClient --> ReverseProxy
    ReverseProxy --> RateLimiter
    RateLimiter --> AuthMiddleware
    AuthMiddleware --> TenantContext
    TenantContext --> Core Business Domains

    Core Business Domains --> EventBus
    EventBus --> Service Abstractions

    Core Business Domains --> PostgresDB
    FileStorageSvc --> Storage
    AuditSvc --> PostgresDB
```

---

## 2. Definición de Límites de Dominio (Bounded Contexts)

Cada dominio encapsula su propia lógica de negocio y expone interfaces limpias:

| Dominio | Responsabilidad Principal | Entidades Principales | Dependencias Permitidas |
|---|---|---|---|
| **Identity & Access** | Autenticación, JWT, 2FA, Refresh Tokens, RBAC | `User`, `Role`, `RefreshToken` | Módulo base (sin dependencias de negocio) |
| **Organizations** | Tenants, clínicas, planes de suscripción, cuotas | `Organization`, `Department` | Identity |
| **Patients** | Registro demográfico, antecedentes, timeline clínico | `Patient`, `EmergencyTriage` | Organizations, Identity |
| **Appointments** | Agenda médica, citas, recordatorios, lista de espera | `Appointment`, `Doctor` | Patients, Organizations |
| **Clinical Records** | Historias clínicas, evoluciones, recetas, diagnósticos | `MedicalRecord`, `Prescription` | Patients, Doctors, Organizations |
| **Lab & Pharmacy** | Catálogo de pruebas, muestras, inventario de medicamentos FEFO | `LabTest`, `LabResult`, `Drug`, `PharmacyBatch` | Patients, Organizations |
| **Billing & Finance** | Facturación, cotizaciones, cobros, reclamos a aseguradoras | `Payment`, `Quote`, `InsuranceClaim`, `AccountChart` | Patients, Organizations |
| **Audit & Compliance** | Trazabilidad inmutable de eventos, firmas y accesos PHI | `AuditLog` | Global (observador transversal) |

---

## 3. Arquitectura de Eventos de Dominio (Domain Events)

Para desacoplar la ejecución inmediata de los efectos secundarios (como envíos de correo, notificaciones por WhatsApp o actualización de métricas), el sistema utiliza el patrón **Domain Events**:

```typescript
// Contrato base para eventos de dominio
interface DomainEvent {
  eventId: string;           // UUIDv4
  eventName: string;         // e.g. "AppointmentCreated"
  occurredOn: Date;          // Timestamp ISO
  organizationId: string;    // UUID del Tenant
  actorUserId?: string;      // UUID del usuario causante
  payload: Record<string, any>;
}
```

### Flujo Típico de un Evento:
1. El médico programa una cita en `AppointmentModule`.
2. Se guarda la cita en PostgreSQL dentro de una transacción.
3. Se publica el evento `AppointmentCreated` en el `DomainEventBus`.
4. El suscriptor `NotificationService` recibe el evento de forma asíncrona y despacha el correo/WhatsApp de confirmación sin bloquear la respuesta HTTP al médico.
5. El suscriptor `AuditService` registra el evento en la bitácora con hash criptográfico.

---

## 4. Abstracción de Servicios para Futura Extracción

Los servicios con alta probabilidad de extracción futura se diseñan siguiendo el principio de **Inversión de Dependencias (DIP)**:

### 4.1. FileStorageService
```typescript
interface FileStorageService {
  uploadFile(file: Buffer, metadata: FileMetadata): Promise<StorageResult>;
  getDownloadUrl(fileId: string, userContext: UserContext): Promise<string>;
  deleteFile(fileId: string, userContext: UserContext): Promise<boolean>;
}
```
*Implementaciones:* `LocalStorageProvider` (actual) -> `S3StorageProvider` / `R2StorageProvider` (futuro).

### 4.2. NotificationService
```typescript
interface NotificationService {
  sendEmail(options: EmailOptions): Promise<DeliveryResult>;
  sendWhatsApp(options: WhatsAppOptions): Promise<DeliveryResult>;
  sendSMS(options: SMSOptions): Promise<DeliveryResult>;
}
```
*Implementaciones:* Despachador local que conecta con Resend/Twilio -> Extracción a microservicio consumidor de colas cuando el volumen supere 10,000 envíos/día.

### 4.3. AIService (Clinical Copilot)
```typescript
interface AIService {
  generateClinicalSummary(recordData: ClinicalData): Promise<AISuggestion>;
  extractLabFindings(rawResults: string): Promise<AILabInsights>;
}
```
*Regla de Oro:* **Doctor reviews & approves**. La IA nunca persiste cambios clínicos directamente en la base de datos sin firma y confirmación médica explícita.

---

## 5. Estrategia de Persistencia y Aislamiento de Datos

- **Base de Datos Unificada con Esquemas Lógicos y RLS:**  
  Todos los datos residen en la base de datos PostgreSQL del entorno (`clinica_saas_prod`), aislados a nivel de fila mediante **PostgreSQL Row Level Security**.
- **Variables de Sesión por Transacción:**  
  Cada conexión ejecuta `SET LOCAL app.current_organization_id = '<uuid>'`. Esto asegura que el motor de la base de datos rechace cualquier intento de consulta fuera del tenant, protegiendo al sistema de posibles bugs en el código de aplicación o raw queries.
- **Trazabilidad Criptográfica Inmutable:**  
  La tabla `audit_logs` utiliza encadenamiento SHA-256 (`currentHash = H(previousHash + eventData)`), imposibilitando la alteración retroactiva de auditorías.

---

## 6. Evolución Futura a Microservicios (Gatillos Operacionales)

La separación física a servicios independientes solo se justificará cuando se cumpla al menos uno de los siguientes disparadores:

1. **Escalado Diferencial de Recursos:** El procesamiento de documentos o videollamadas WebRTC consume CPU/ancho de banda que degrada el rendimiento de la API transaccional.
2. **Aislamiento de Disponibilidad Crítica:** Caídas en proveedores externos (como WhatsApp o pasarelas de pago) provocan agotamiento de hilos en el monolito.
3. **Escala de Equipos de Ingeniería:** Múltiples equipos autónomos necesitan desplegar ciclos de release independientes sin coordinar el monolito.

La especificación completa de contratos y condiciones de separación se documentará en `FUTURE_MICROSERVICES.md`.
