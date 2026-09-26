require('dotenv').config();
const { sequelize, InventoryItem, InventoryMovement, Specialty, Doctor, User } = require('../models');

async function migrate() {
  try {
    await sequelize.authenticate();
    console.log('Connected to DB');

    // Create tables via sync or SQL query
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS "InventoryItems" (
        "id" UUID PRIMARY KEY,
        "organizationId" UUID REFERENCES "Organizations"("id") ON DELETE CASCADE,
        "code" VARCHAR(255) NOT NULL,
        "name" VARCHAR(255) NOT NULL,
        "nameEn" VARCHAR(255),
        "itemType" VARCHAR(50) DEFAULT 'PRODUCT',
        "category" VARCHAR(50) DEFAULT 'MEDICINE',
        "description" TEXT,
        "unit" VARCHAR(50) DEFAULT 'UNIDAD',
        "costUSD" DECIMAL(10, 2) DEFAULT 0.00,
        "priceUSD" DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        "stockCurrent" DECIMAL(10, 2) DEFAULT 0.00,
        "stockMin" DECIMAL(10, 2) DEFAULT 5.00,
        "batchNumber" VARCHAR(100),
        "expiryDate" DATE,
        "location" VARCHAR(100) DEFAULT 'Almacén General',
        "isTaxExempt" BOOLEAN DEFAULT true,
        "specialtyId" INTEGER REFERENCES "Specialties"("id") ON DELETE SET NULL,
        "doctorId" UUID REFERENCES "Doctors"("id") ON DELETE SET NULL,
        "doctorFeePercent" DECIMAL(5, 2) DEFAULT 70.00,
        "doctorFeeFixedUSD" DECIMAL(10, 2) DEFAULT 0.00,
        "requiresDoctor" BOOLEAN DEFAULT false,
        "isActive" BOOLEAN DEFAULT true,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "deletedAt" TIMESTAMP WITH TIME ZONE
      );

      CREATE TABLE IF NOT EXISTS "InventoryMovements" (
        "id" UUID PRIMARY KEY,
        "organizationId" UUID REFERENCES "Organizations"("id") ON DELETE CASCADE,
        "itemId" UUID NOT NULL REFERENCES "InventoryItems"("id") ON DELETE CASCADE,
        "movementType" VARCHAR(50) DEFAULT 'CLINICAL_CONSUMPTION',
        "quantity" DECIMAL(10, 2) NOT NULL,
        "unitCostUSD" DECIMAL(10, 2) DEFAULT 0.00,
        "unitPriceUSD" DECIMAL(10, 2) DEFAULT 0.00,
        "totalAmountUSD" DECIMAL(10, 2) DEFAULT 0.00,
        "bcvRate" DECIMAL(10, 4) DEFAULT 1.00,
        "patientId" UUID REFERENCES "Patients"("id") ON DELETE SET NULL,
        "doctorId" UUID REFERENCES "Doctors"("id") ON DELETE SET NULL,
        "doctorFeeId" UUID REFERENCES "DoctorFees"("id") ON DELETE SET NULL,
        "documentRef" VARCHAR(100),
        "reason" TEXT,
        "movementDate" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        "createdById" UUID REFERENCES "Users"("id") ON DELETE SET NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "deletedAt" TIMESTAMP WITH TIME ZONE
      );
    `);

    console.log('✅ PostgreSQL Inventory tables created successfully!');

    // Check if items exist, if not seed sample products and services with doctor fee rules
    const count = await InventoryItem.count();
    if (count === 0) {
      const doctors = await Doctor.findAll({ include: [User] });
      const specialties = await Specialty.findAll();

      const doc1 = doctors[0] || null;
      const doc2 = doctors[1] || doctors[0] || null;
      const specCardio = specialties.find(s => s.name.includes('Cardio')) || specialties[0] || null;
      const specTrauma = specialties.find(s => s.name.includes('Trauma')) || specialties[1] || null;

      const sampleItems = [
        // 1. Insumos / Medicamentos
        {
          code: 'MED-AB-01',
          name: 'Ceftriaxona 1g I.V. (Polvo para solución)',
          nameEn: 'Ceftriaxone 1g I.V.',
          itemType: 'MEDICATION',
          category: 'MEDICINE',
          unit: 'AMPOLLA',
          costUSD: 4.50,
          priceUSD: 12.00,
          stockCurrent: 85,
          stockMin: 20,
          batchNumber: 'LOT-2026-042',
          expiryDate: '2027-08-30',
          location: 'Farmacia Central',
          requiresDoctor: false
        },
        {
          code: 'INS-KIT-QX',
          name: 'Kit de Laparoscopía Descartable Estéril',
          nameEn: 'Sterile Disposable Laparoscopy Kit',
          itemType: 'PRODUCT',
          category: 'SURGICAL_MATERIAL',
          unit: 'KIT',
          costUSD: 45.00,
          priceUSD: 95.00,
          stockCurrent: 14,
          stockMin: 5,
          batchNumber: 'LOT-QX-881',
          expiryDate: '2028-01-15',
          location: 'Quirófano A',
          requiresDoctor: false
        },
        {
          code: 'INS-SOL-01',
          name: 'Solución Fisiológica 0.9% 500ml',
          nameEn: 'Normal Saline Solution 0.9% 500ml',
          itemType: 'PRODUCT',
          category: 'HOSPITAL_SUPPLY',
          unit: 'FRASCO',
          costUSD: 1.20,
          priceUSD: 4.50,
          stockCurrent: 150,
          stockMin: 30,
          batchNumber: 'LOT-SOL-99',
          expiryDate: '2027-11-20',
          location: 'Farmacia / Emergencia',
          requiresDoctor: false
        },
        // 2. Servicios Clínicos con Honorario Médico
        {
          code: 'SRV-ECO-DOP',
          name: 'Ecocardiograma Doppler Color Bidimensional',
          nameEn: '2D Color Doppler Echocardiogram',
          itemType: 'SERVICE',
          category: 'PROCEDURE',
          unit: 'SERVICIO',
          costUSD: 15.00,
          priceUSD: 80.00,
          stockCurrent: 999,
          stockMin: 0,
          specialtyId: specCardio?.id || null,
          doctorId: doc1?.id || null,
          requiresDoctor: true,
          doctorFeePercent: 75.00, // 75% médico
          doctorFeeFixedUSD: 60.00,
          location: 'Unidad de Cardiología'
        },
        {
          code: 'SRV-CIR-LAP',
          name: 'Colecistectomía Laparoscópica (Cirugía Ambulatoria)',
          nameEn: 'Laparoscopic Cholecystectomy',
          itemType: 'SERVICE',
          category: 'SURGERY',
          unit: 'SERVICIO',
          costUSD: 120.00,
          priceUSD: 650.00,
          stockCurrent: 999,
          stockMin: 0,
          specialtyId: specTrauma?.id || null,
          doctorId: doc2?.id || null,
          requiresDoctor: true,
          doctorFeePercent: 65.00, // 65% médico
          doctorFeeFixedUSD: 422.50,
          location: 'Pabellón Quirófano 1'
        },
        {
          code: 'SRV-CON-ESP',
          name: 'Consulta Médica Especializada Integral',
          nameEn: 'Specialized Medical Consultation',
          itemType: 'SERVICE',
          category: 'CONSULTATION',
          unit: 'SERVICIO',
          costUSD: 5.00,
          priceUSD: 50.00,
          stockCurrent: 999,
          stockMin: 0,
          doctorId: doc1?.id || null,
          requiresDoctor: true,
          doctorFeePercent: 70.00,
          doctorFeeFixedUSD: 35.00,
          location: 'Consultorios Médicos'
        }
      ];

      for (const it of sampleItems) {
        await InventoryItem.create(it);
      }
      console.log('✅ Seeded initial Products, Medications & Services linked to Doctor Fees!');
    }

    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
