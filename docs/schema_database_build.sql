-- ============================================================================
-- ARQUITECTURA DE BASE DE DATOS: CLINICA - SAAS (POSTGRESQL DDL)
-- Optimizado para https://database.build/ (Usa gen_random_uuid nativo)
-- ============================================================================

-- 1. DOMINIO CORE & MULTI-TENANT
CREATE TABLE "Organizations" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) UNIQUE NOT NULL,
    "rif" VARCHAR(50),
    "email" VARCHAR(255),
    "phone" VARCHAR(50),
    "address" TEXT,
    "subscriptionPlan" VARCHAR(50) DEFAULT 'PRO',
    "subscriptionStatus" VARCHAR(50) DEFAULT 'TRIAL',
    "trialEndsAt" TIMESTAMP WITH TIME ZONE,
    "isActive" BOOLEAN DEFAULT TRUE,
    "ownerId" UUID,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP WITH TIME ZONE
);

CREATE TABLE "Roles" (
    "id" SERIAL PRIMARY KEY,
    "name" VARCHAR(100) UNIQUE NOT NULL,
    "description" TEXT,
    "permissions" JSONB DEFAULT '[]'::jsonb,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Users" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "organizationId" UUID REFERENCES "Organizations"("id") ON DELETE CASCADE,
    "roleId" INTEGER REFERENCES "Roles"("id"),
    "username" VARCHAR(100) UNIQUE NOT NULL,
    "email" VARCHAR(255) UNIQUE NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "firstName" VARCHAR(100) NOT NULL,
    "lastName" VARCHAR(100) NOT NULL,
    "accountType" VARCHAR(50) DEFAULT 'PATIENT',
    "gender" VARCHAR(20),
    "isActive" BOOLEAN DEFAULT TRUE,
    "mustChangePassword" BOOLEAN DEFAULT FALSE,
    "resetToken" VARCHAR(255),
    "resetExpires" TIMESTAMP WITH TIME ZONE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP WITH TIME ZONE
);

CREATE TABLE "AuditLogs" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "organizationId" UUID REFERENCES "Organizations"("id") ON DELETE CASCADE,
    "userId" UUID REFERENCES "Users"("id"),
    "action" VARCHAR(100) NOT NULL,
    "entity" VARCHAR(100) NOT NULL,
    "entityId" VARCHAR(100),
    "oldValues" JSONB,
    "newValues" JSONB,
    "ipAddress" VARCHAR(50),
    "userAgent" TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. DEPARTAMENTOS, ESPECIALIDADES Y PERSONAL CLÍNICO
CREATE TABLE "Departments" (
    "id" SERIAL PRIMARY KEY,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Specialties" (
    "id" SERIAL PRIMARY KEY,
    "departmentId" INTEGER REFERENCES "Departments"("id") ON DELETE SET NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "basePriceUSD" NUMERIC(10, 2) DEFAULT 0.00,
    "isActive" BOOLEAN DEFAULT TRUE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Doctors" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "organizationId" UUID REFERENCES "Organizations"("id") ON DELETE CASCADE,
    "userId" UUID UNIQUE NOT NULL REFERENCES "Users"("id") ON DELETE CASCADE,
    "specialtyId" INTEGER REFERENCES "Specialties"("id") ON DELETE SET NULL,
    "medicalLicense" VARCHAR(100),
    "mpps" VARCHAR(100),
    "colegioMedico" VARCHAR(100),
    "consultationFeeUSD" NUMERIC(10, 2) DEFAULT 0.00,
    "commissionPercentage" NUMERIC(5, 2) DEFAULT 70.00,
    "bankDetails" JSONB,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP WITH TIME ZONE
);

CREATE TABLE "Nurses" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "organizationId" UUID REFERENCES "Organizations"("id") ON DELETE CASCADE,
    "userId" UUID UNIQUE NOT NULL REFERENCES "Users"("id") ON DELETE CASCADE,
    "licenseNumber" VARCHAR(100),
    "shift" VARCHAR(50) DEFAULT 'MAÑANA',
    "department" VARCHAR(100) DEFAULT 'HOSPITALIZACIÓN',
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP WITH TIME ZONE
);

CREATE TABLE "Staff" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "organizationId" UUID REFERENCES "Organizations"("id") ON DELETE CASCADE,
    "userId" UUID UNIQUE NOT NULL REFERENCES "Users"("id") ON DELETE CASCADE,
    "position" VARCHAR(100) NOT NULL,
    "department" VARCHAR(100) DEFAULT 'ADMINISTRACIÓN',
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP WITH TIME ZONE
);

CREATE TABLE "Employees" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "organizationId" UUID REFERENCES "Organizations"("id") ON DELETE CASCADE,
    "userId" UUID REFERENCES "Users"("id") ON DELETE SET NULL,
    "doctorId" UUID REFERENCES "Doctors"("id") ON DELETE SET NULL,
    "departmentId" INTEGER REFERENCES "Departments"("id") ON DELETE SET NULL,
    "specialtyId" INTEGER REFERENCES "Specialties"("id") ON DELETE SET NULL,
    "employeeCode" VARCHAR(50) NOT NULL,
    "documentType" VARCHAR(20) DEFAULT 'CEDULA',
    "documentNumber" VARCHAR(50) NOT NULL,
    "fullName" VARCHAR(200) NOT NULL,
    "jobTitle" VARCHAR(100) NOT NULL,
    "salaryUSD" NUMERIC(10, 2) DEFAULT 0.00,
    "hireDate" DATE,
    "status" VARCHAR(50) DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP WITH TIME ZONE
);

-- 3. SEGUROS Y BAREMOS
CREATE TABLE "InsuranceCompanies" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "organizationId" UUID REFERENCES "Organizations"("id") ON DELETE CASCADE,
    "name" VARCHAR(200) NOT NULL,
    "rif" VARCHAR(50) NOT NULL,
    "contactEmail" VARCHAR(255),
    "contactPhone" VARCHAR(50),
    "claimSubmissionUrl" TEXT,
    "isActive" BOOLEAN DEFAULT TRUE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP WITH TIME ZONE
);

CREATE TABLE "InsurancePolicies" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "insuranceCompanyId" UUID NOT NULL REFERENCES "InsuranceCompanies"("id") ON DELETE CASCADE,
    "patientId" UUID,
    "policyNumber" VARCHAR(100) NOT NULL,
    "planName" VARCHAR(100),
    "holderType" VARCHAR(50) DEFAULT 'TITULAR',
    "coveragePercentage" NUMERIC(5, 2) DEFAULT 80.00,
    "coverageLimitUSD" NUMERIC(12, 2) DEFAULT 50000.00,
    "isActive" BOOLEAN DEFAULT TRUE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. PACIENTES E HISTORIAS MÉDICAS
CREATE TABLE "Patients" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "organizationId" UUID REFERENCES "Organizations"("id") ON DELETE CASCADE,
    "userId" UUID REFERENCES "Users"("id") ON DELETE SET NULL,
    "insuranceCompanyId" UUID REFERENCES "InsuranceCompanies"("id") ON DELETE SET NULL,
    "medicalRecordNumber" VARCHAR(100) UNIQUE NOT NULL,
    "documentType" VARCHAR(20) DEFAULT 'CEDULA',
    "documentPrefix" VARCHAR(5) DEFAULT 'V',
    "documentNumber" VARCHAR(50) NOT NULL,
    "birthDate" DATE,
    "gender" VARCHAR(20),
    "bloodType" VARCHAR(10),
    "phone" VARCHAR(50),
    "address" TEXT,
    "emergencyContact" JSONB,
    "allergies" TEXT,
    "chronicDiseases" TEXT,
    "pathologicalHistory" JSONB DEFAULT '[]'::jsonb,
    "familyInfo" JSONB DEFAULT '[]'::jsonb,
    "hasInsurance" BOOLEAN DEFAULT FALSE,
    "policyNumber" VARCHAR(100),
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP WITH TIME ZONE
);

CREATE TABLE "MedicalRecords" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "patientId" UUID NOT NULL REFERENCES "Patients"("id") ON DELETE CASCADE,
    "doctorId" UUID NOT NULL REFERENCES "Doctors"("id"),
    "consultationDate" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "reasonForVisit" TEXT,
    "symptoms" TEXT,
    "diagnosis" TEXT NOT NULL,
    "physicalExam" JSONB,
    "vitalSigns" JSONB,
    "treatmentPlan" TEXT,
    "cie11Code" VARCHAR(50),
    "notes" TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Drugs" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "genericName" VARCHAR(200) NOT NULL,
    "commercialName" VARCHAR(200),
    "pharmaceuticalForm" VARCHAR(100),
    "concentration" VARCHAR(100),
    "presentation" VARCHAR(100),
    "indications" TEXT,
    "contraindications" TEXT,
    "sideEffects" TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Prescriptions" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "medicalRecordId" UUID NOT NULL REFERENCES "MedicalRecords"("id") ON DELETE CASCADE,
    "drugId" UUID REFERENCES "Drugs"("id") ON DELETE SET NULL,
    "dosage" VARCHAR(100) NOT NULL,
    "frequency" VARCHAR(100) NOT NULL,
    "durationDays" INTEGER DEFAULT 7,
    "instructions" TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. CITAS Y TELEMEDICINA
CREATE TABLE "Appointments" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "patientId" UUID NOT NULL REFERENCES "Patients"("id") ON DELETE CASCADE,
    "doctorId" UUID NOT NULL REFERENCES "Doctors"("id") ON DELETE CASCADE,
    "appointmentDate" TIMESTAMP WITH TIME ZONE NOT NULL,
    "durationMinutes" INTEGER DEFAULT 30,
    "type" VARCHAR(50) DEFAULT 'IN_PERSON',
    "status" VARCHAR(50) DEFAULT 'SCHEDULED',
    "reason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "VideoConsultations" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "appointmentId" UUID UNIQUE REFERENCES "Appointments"("id") ON DELETE CASCADE,
    "doctorId" UUID NOT NULL REFERENCES "Users"("id"),
    "patientId" UUID NOT NULL REFERENCES "Users"("id"),
    "roomId" VARCHAR(100) UNIQUE NOT NULL,
    "status" VARCHAR(50) DEFAULT 'scheduled',
    "startTime" TIMESTAMP WITH TIME ZONE,
    "endTime" TIMESTAMP WITH TIME ZONE,
    "duration" INTEGER DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. ADMISIONES Y HOSPITALIZACIÓN
CREATE TABLE "HospitalBeds" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "organizationId" UUID REFERENCES "Organizations"("id") ON DELETE CASCADE,
    "currentPatientId" UUID REFERENCES "Patients"("id") ON DELETE SET NULL,
    "bedNumber" VARCHAR(50) NOT NULL,
    "room" VARCHAR(50) NOT NULL,
    "floor" VARCHAR(50) DEFAULT 'Piso 1',
    "ward" VARCHAR(50) DEFAULT 'HOSPITALIZATION',
    "dailyRateUSD" NUMERIC(10, 2) DEFAULT 100.00,
    "status" VARCHAR(50) DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Admissions" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "organizationId" UUID REFERENCES "Organizations"("id") ON DELETE CASCADE,
    "patientId" UUID NOT NULL REFERENCES "Patients"("id") ON DELETE CASCADE,
    "attendingDoctorId" UUID REFERENCES "Doctors"("id") ON DELETE SET NULL,
    "insuranceCompanyId" UUID REFERENCES "InsuranceCompanies"("id") ON DELETE SET NULL,
    "admissionNumber" VARCHAR(100) UNIQUE NOT NULL,
    "episodeNumber" VARCHAR(100) UNIQUE NOT NULL,
    "medicalRecordNumber" VARCHAR(100) NOT NULL,
    "admissionType" VARCHAR(50) DEFAULT 'HOSPITALIZATION',
    "admissionDate" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "dischargeDate" TIMESTAMP WITH TIME ZONE,
    "status" VARCHAR(50) DEFAULT 'ADMITTED',
    "currentArea" VARCHAR(100) DEFAULT 'ADMISIÓN GENERAL',
    "areaMovements" JSONB DEFAULT '[]'::jsonb,
    "hasInsurance" BOOLEAN DEFAULT FALSE,
    "insurancePolicyNumber" VARCHAR(100),
    "insurancePlan" VARCHAR(100),
    "insuranceHolderType" VARCHAR(50) DEFAULT 'TITULAR',
    "insuranceCoverageAmountUSD" NUMERIC(12, 2) DEFAULT 0.00,
    "insuranceAuthorizationCode" VARCHAR(100),
    "insuranceClaimNumber" VARCHAR(100),
    "insuranceCartaAval" VARCHAR(255),
    "titularData" JSONB,
    "guarantorData" JSONB,
    "patientDataSnapshot" JSONB,
    "initialDiagnosis" TEXT NOT NULL,
    "dischargeNotes" TEXT,
    "companionName" VARCHAR(150),
    "companionPhone" VARCHAR(50),
    "notes" TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP WITH TIME ZONE
);

CREATE TABLE "EmergencyTriages" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "admissionId" UUID REFERENCES "Admissions"("id") ON DELETE SET NULL,
    "patientId" UUID NOT NULL REFERENCES "Patients"("id") ON DELETE CASCADE,
    "assignedDoctorId" UUID REFERENCES "Doctors"("id") ON DELETE SET NULL,
    "triageLevel" INTEGER NOT NULL DEFAULT 3,
    "chiefComplaint" TEXT NOT NULL,
    "systolicBP" INTEGER,
    "diastolicBP" INTEGER,
    "heartRate" INTEGER,
    "respiratoryRate" INTEGER,
    "temperature" NUMERIC(4, 1),
    "oxygenSaturation" INTEGER,
    "glasgowScore" INTEGER DEFAULT 15,
    "painScale" INTEGER DEFAULT 0,
    "status" VARCHAR(50) DEFAULT 'WAITING',
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "HospitalStays" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "admissionId" UUID NOT NULL REFERENCES "Admissions"("id") ON DELETE CASCADE,
    "patientId" UUID NOT NULL REFERENCES "Patients"("id") ON DELETE CASCADE,
    "bedId" UUID NOT NULL REFERENCES "HospitalBeds"("id"),
    "attendingDoctorId" UUID REFERENCES "Doctors"("id"),
    "checkInDate" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "checkOutDate" TIMESTAMP WITH TIME ZONE,
    "dailyRateUSD" NUMERIC(10, 2) DEFAULT 0.00,
    "totalCostUSD" NUMERIC(12, 2) DEFAULT 0.00,
    "status" VARCHAR(50) DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Surgeries" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "admissionId" UUID REFERENCES "Admissions"("id") ON DELETE SET NULL,
    "patientId" UUID NOT NULL REFERENCES "Patients"("id") ON DELETE CASCADE,
    "specialtyId" INTEGER REFERENCES "Specialties"("id") ON DELETE SET NULL,
    "leadSurgeonId" UUID NOT NULL REFERENCES "Doctors"("id"),
    "assistantSurgeonId" UUID REFERENCES "Doctors"("id"),
    "anesthesiologistId" UUID REFERENCES "Doctors"("id"),
    "surgeryNumber" VARCHAR(100) UNIQUE NOT NULL,
    "procedureName" VARCHAR(255) NOT NULL,
    "operatingRoom" VARCHAR(100) DEFAULT 'Quirófano 1',
    "scheduledDate" DATE NOT NULL,
    "scheduledStartTime" TIME,
    "estimatedDurationMinutes" INTEGER DEFAULT 120,
    "actualDurationMinutes" INTEGER,
    "anesthesiaType" VARCHAR(50) DEFAULT 'GENERAL',
    "status" VARCHAR(50) DEFAULT 'SCHEDULED',
    "preOpDiagnosis" TEXT,
    "postOpDiagnosis" TEXT,
    "surgicalProtocolNotes" TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. LABORATORIO CLÍNICO
CREATE TABLE "LabTests" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "code" VARCHAR(50) UNIQUE NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "category" VARCHAR(100) DEFAULT 'HEMATOLOGÍA',
    "priceUSD" NUMERIC(10, 2) NOT NULL,
    "referenceValues" JSONB,
    "sampleType" VARCHAR(100) DEFAULT 'Sangre Total',
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "LabCombos" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "code" VARCHAR(50) UNIQUE NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "priceUSD" NUMERIC(10, 2) NOT NULL,
    "isActive" BOOLEAN DEFAULT TRUE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "LabComboTests" (
    "comboId" UUID REFERENCES "LabCombos"("id") ON DELETE CASCADE,
    "testId" UUID REFERENCES "LabTests"("id") ON DELETE CASCADE,
    PRIMARY KEY ("comboId", "testId")
);

CREATE TABLE "LabResults" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "patientId" UUID NOT NULL REFERENCES "Patients"("id") ON DELETE CASCADE,
    "testId" UUID REFERENCES "LabTests"("id") ON DELETE SET NULL,
    "orderNumber" VARCHAR(100) NOT NULL,
    "sampleStatus" VARCHAR(50) DEFAULT 'RECEIVED',
    "resultsData" JSONB,
    "pathologistDoctorId" UUID REFERENCES "Doctors"("id"),
    "validationDate" TIMESTAMP WITH TIME ZONE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. INVENTARIO Y MOVIMIENTOS DE FARMACIA
CREATE TABLE "InventoryItems" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "organizationId" UUID REFERENCES "Organizations"("id") ON DELETE CASCADE,
    "specialtyId" INTEGER REFERENCES "Specialties"("id") ON DELETE SET NULL,
    "doctorId" UUID REFERENCES "Doctors"("id") ON DELETE SET NULL,
    "code" VARCHAR(100) UNIQUE NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "category" VARCHAR(100) DEFAULT 'MEDICINE',
    "unit" VARCHAR(50) DEFAULT 'Unidad',
    "costUSD" NUMERIC(10, 2) DEFAULT 0.00,
    "salePriceUSD" NUMERIC(10, 2) DEFAULT 0.00,
    "stockQuantity" INTEGER DEFAULT 0,
    "minStock" INTEGER DEFAULT 10,
    "lotNumber" VARCHAR(100),
    "expiryDate" DATE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP WITH TIME ZONE
);

CREATE TABLE "InventoryMovements" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "organizationId" UUID REFERENCES "Organizations"("id") ON DELETE CASCADE,
    "itemId" UUID NOT NULL REFERENCES "InventoryItems"("id") ON DELETE CASCADE,
    "patientId" UUID REFERENCES "Patients"("id") ON DELETE SET NULL,
    "doctorId" UUID REFERENCES "Doctors"("id") ON DELETE SET NULL,
    "movementType" VARCHAR(50) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitCostUSD" NUMERIC(10, 2) DEFAULT 0.00,
    "totalCostUSD" NUMERIC(12, 2) DEFAULT 0.00,
    "reason" TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. VENTAS, COTIZACIONES Y COMBOS CLÍNICOS
CREATE TABLE "ClinicalServices" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "organizationId" UUID REFERENCES "Organizations"("id") ON DELETE CASCADE,
    "specialtyId" INTEGER REFERENCES "Specialties"("id") ON DELETE SET NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "category" VARCHAR(50) DEFAULT 'CONSULTATION',
    "description" TEXT,
    "priceUSD" NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    "isTaxExempt" BOOLEAN DEFAULT TRUE,
    "taxRate" NUMERIC(5, 2) DEFAULT 0.00,
    "requiresDoctor" BOOLEAN DEFAULT FALSE,
    "isActive" BOOLEAN DEFAULT TRUE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP WITH TIME ZONE
);

CREATE TABLE "ClinicalPackages" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "organizationId" UUID REFERENCES "Organizations"("id") ON DELETE CASCADE,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "category" VARCHAR(50) DEFAULT 'SURGERY',
    "description" TEXT,
    "totalPriceUSD" NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    "estimatedDurationHours" NUMERIC(6, 2) DEFAULT 2.0,
    "items" JSONB DEFAULT '[]'::jsonb,
    "isActive" BOOLEAN DEFAULT TRUE,
    "notes" TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP WITH TIME ZONE
);

CREATE TABLE "Quotes" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "organizationId" UUID REFERENCES "Organizations"("id") ON DELETE CASCADE,
    "patientId" UUID REFERENCES "Patients"("id") ON DELETE SET NULL,
    "doctorId" UUID REFERENCES "Doctors"("id") ON DELETE SET NULL,
    "insuranceCompanyId" UUID REFERENCES "InsuranceCompanies"("id") ON DELETE SET NULL,
    "quoteNumber" VARCHAR(100) UNIQUE NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "patientName" VARCHAR(200) NOT NULL,
    "patientDocumentId" VARCHAR(50),
    "patientPhone" VARCHAR(50),
    "patientEmail" VARCHAR(255),
    "bcvRate" NUMERIC(12, 4) DEFAULT 1.0000,
    "subtotalUSD" NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    "totalUSD" NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    "totalVES" NUMERIC(16, 2) NOT NULL DEFAULT 0.00,
    "patientPayableUSD" NUMERIC(12, 2) DEFAULT 0.00,
    "validUntil" DATE,
    "status" VARCHAR(50) DEFAULT 'SENT',
    "notes" TEXT,
    "terms" TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP WITH TIME ZONE
);

CREATE TABLE "QuoteItems" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "quoteId" UUID NOT NULL REFERENCES "Quotes"("id") ON DELETE CASCADE,
    "serviceId" UUID REFERENCES "ClinicalServices"("id") ON DELETE SET NULL,
    "concept" VARCHAR(255) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPriceUSD" NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    "unitPriceVES" NUMERIC(14, 2) DEFAULT 0.00,
    "discountPercent" NUMERIC(5, 2) DEFAULT 0.00,
    "totalPriceUSD" NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    "totalPriceVES" NUMERIC(16, 2) NOT NULL DEFAULT 0.00,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. PAGOS, HONORARIOS MÉDICOS Y CONTABILIDAD VENEZOLANA
CREATE TABLE "Payments" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "organizationId" UUID REFERENCES "Organizations"("id") ON DELETE CASCADE,
    "patientId" UUID REFERENCES "Patients"("id") ON DELETE SET NULL,
    "appointmentId" UUID REFERENCES "Appointments"("id") ON DELETE SET NULL,
    "amountUSD" NUMERIC(10, 2) NOT NULL,
    "amountVES" NUMERIC(14, 2) NOT NULL,
    "exchangeRateBCV" NUMERIC(12, 4) NOT NULL,
    "paymentMethod" VARCHAR(50) NOT NULL,
    "referenceNumber" VARCHAR(100),
    "status" VARCHAR(50) DEFAULT 'COMPLETED',
    "notes" TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "DoctorFees" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "organizationId" UUID REFERENCES "Organizations"("id") ON DELETE CASCADE,
    "doctorId" UUID NOT NULL REFERENCES "Doctors"("id") ON DELETE CASCADE,
    "patientId" UUID REFERENCES "Patients"("id") ON DELETE SET NULL,
    "paymentId" UUID REFERENCES "Payments"("id") ON DELETE SET NULL,
    "insuranceCompanyId" UUID REFERENCES "InsuranceCompanies"("id") ON DELETE SET NULL,
    "clinicalServiceId" UUID REFERENCES "ClinicalServices"("id") ON DELETE SET NULL,
    "voucherNumber" VARCHAR(100) UNIQUE NOT NULL,
    "grossAmountUSD" NUMERIC(10, 2) NOT NULL,
    "clinicCommissionUSD" NUMERIC(10, 2) NOT NULL,
    "doctorNetAmountUSD" NUMERIC(10, 2) NOT NULL,
    "taxRetentionISLR_VES" NUMERIC(12, 2) DEFAULT 0.00,
    "status" VARCHAR(50) DEFAULT 'PENDING_PAYMENT',
    "paymentDate" DATE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "InsuranceClaims" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "organizationId" UUID REFERENCES "Organizations"("id") ON DELETE CASCADE,
    "insuranceCompanyId" UUID NOT NULL REFERENCES "InsuranceCompanies"("id") ON DELETE CASCADE,
    "patientId" UUID NOT NULL REFERENCES "Patients"("id") ON DELETE CASCADE,
    "doctorId" UUID REFERENCES "Doctors"("id") ON DELETE SET NULL,
    "claimNumber" VARCHAR(100) UNIQUE NOT NULL,
    "claimedAmountUSD" NUMERIC(12, 2) NOT NULL,
    "approvedAmountUSD" NUMERIC(12, 2) DEFAULT 0.00,
    "deductibleUSD" NUMERIC(10, 2) DEFAULT 0.00,
    "copayUSD" NUMERIC(10, 2) DEFAULT 0.00,
    "status" VARCHAR(50) DEFAULT 'SUBMITTED',
    "settlementDate" DATE,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "AccountCharts" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "organizationId" UUID REFERENCES "Organizations"("id") ON DELETE CASCADE,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "level" INTEGER DEFAULT 1,
    "parentAccountId" UUID REFERENCES "AccountCharts"("id") ON DELETE SET NULL,
    "isActive" BOOLEAN DEFAULT TRUE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "JournalEntries" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "organizationId" UUID REFERENCES "Organizations"("id") ON DELETE CASCADE,
    "entryNumber" VARCHAR(100) UNIQUE NOT NULL,
    "entryDate" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "totalDebitUSD" NUMERIC(14, 2) DEFAULT 0.00,
    "totalCreditUSD" NUMERIC(14, 2) DEFAULT 0.00,
    "bcvRate" NUMERIC(12, 4) DEFAULT 1.0000,
    "status" VARCHAR(50) DEFAULT 'POSTED',
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "JournalItems" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "journalEntryId" UUID NOT NULL REFERENCES "JournalEntries"("id") ON DELETE CASCADE,
    "accountId" UUID NOT NULL REFERENCES "AccountCharts"("id") ON DELETE CASCADE,
    "debitUSD" NUMERIC(12, 2) DEFAULT 0.00,
    "creditUSD" NUMERIC(12, 2) DEFAULT 0.00,
    "debitVES" NUMERIC(16, 2) DEFAULT 0.00,
    "creditVES" NUMERIC(16, 2) DEFAULT 0.00,
    "concept" TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "TaxRetentions" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "organizationId" UUID REFERENCES "Organizations"("id") ON DELETE CASCADE,
    "voucherNumber" VARCHAR(100) UNIQUE NOT NULL,
    "taxType" VARCHAR(50) DEFAULT 'ISLR',
    "beneficiaryName" VARCHAR(200) NOT NULL,
    "beneficiaryRif" VARCHAR(50) NOT NULL,
    "baseAmountVES" NUMERIC(16, 2) NOT NULL,
    "retentionPercentage" NUMERIC(5, 2) NOT NULL,
    "retainedAmountVES" NUMERIC(16, 2) NOT NULL,
    "retentionDate" DATE NOT NULL,
    "fiscalPeriod" VARCHAR(20) NOT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
