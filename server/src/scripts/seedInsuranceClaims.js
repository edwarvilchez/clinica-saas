const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const sequelize = require('../config/db.config');
const { InsuranceCompany, InsurancePolicy, InsuranceClaim, Patient, Doctor, User, Specialty } = require('../models');

async function seedClaims() {
  try {
    await sequelize.authenticate();
    console.log('Database connected for insurance claims seeding...');

    // Find or create insurance companies
    let caracas = await InsuranceCompany.findOne({ where: { rif: 'J-00035541-0' } });
    if (!caracas) {
      caracas = await InsuranceCompany.create({
        name: 'Seguros Caracas C.A.',
        rif: 'J-00035541-0',
        phone: '+58 212-208-1111',
        email: 'reclamos@seguroscaracas.com',
        contactPerson: 'Lcda. Valentina Mendoza',
        defaultCoveragePercent: 85.00,
        paymentTermDays: 30
      });
    }

    let mercantil = await InsuranceCompany.findOne({ where: { rif: 'J-00090180-5' } });
    if (!mercantil) {
      mercantil = await InsuranceCompany.create({
        name: 'Mercantil Seguros Panamá / Vzla',
        rif: 'J-00090180-5',
        phone: '+58 212-277-2111',
        email: 'siniestros@mercantilseguros.com',
        contactPerson: 'Ing. Carlos Gutiérrez',
        defaultCoveragePercent: 90.00,
        paymentTermDays: 15
      });
    }

    // Find patients and doctors
    const patient = await Patient.findOne({ include: [{ model: User }] });
    const doctor = await Doctor.findOne({ include: [{ model: User }, { model: Specialty }] });

    if (!patient) {
      console.log('No patient found in database, please ensure users/patients are seeded.');
      process.exit(0);
    }

    // Check existing claims
    const count = await InsuranceClaim.count();
    if (count > 0) {
      console.log(`Already found ${count} insurance claims. Seeding extra if needed.`);
    }

    const claim1 = await InsuranceClaim.create({
      claimNumber: `SIN-2026-00001`,
      insuranceCompanyId: caracas.id,
      patientId: patient.id,
      doctorId: doctor ? doctor.id : null,
      policyNumber: 'POL-SC-889412',
      authorizationCode: 'AVAL-CARACAS-99214',
      serviceType: 'SURGERY',
      serviceStartDate: '2026-09-10',
      serviceEndDate: '2026-09-12',
      diagnosis: 'K35.8 - Apendicitis Aguda con Peritonitis Localizada (CIE-11: DB10.0)',
      items: [
        { description: 'Derechos de Pabellón Quirúrgico y Recuperación', code: 'PAB-01', category: 'SURGERY', quantity: 1, unitPriceUSD: 850.00, totalUSD: 850.00 },
        { description: 'Honorarios Médico Cirujano Principal', code: 'HON-CIR-01', category: 'FEES', quantity: 1, unitPriceUSD: 600.00, totalUSD: 600.00 },
        { description: 'Honorarios Médico Anestesiólogo', code: 'HON-ANE-01', category: 'FEES', quantity: 1, unitPriceUSD: 300.00, totalUSD: 300.00 },
        { description: 'Hospitalización Habitación Privada (2 Noches)', code: 'HOSP-HAB-01', category: 'HOSPITALIZATION', quantity: 2, unitPriceUSD: 180.00, totalUSD: 360.00 },
        { description: 'Material Médico Quirúrgico y Fármacos Antibióticos', code: 'MED-MAT-01', category: 'SUPPLIES', quantity: 1, unitPriceUSD: 390.00, totalUSD: 390.00 }
      ],
      grossAmountUSD: 2500.00,
      deductibleUSD: 200.00,
      claimedAmountUSD: 2300.00,
      bcvRate: 45.5000,
      status: 'APPROVED',
      settledAmountUSD: 2300.00,
      settledDate: '2026-09-20',
      notes: 'Carta aval aprobada por la aseguradora. Se anexa informe médico e historia clínica.'
    });

    const claim2 = await InsuranceClaim.create({
      claimNumber: `SIN-2026-00002`,
      insuranceCompanyId: mercantil.id,
      patientId: patient.id,
      doctorId: doctor ? doctor.id : null,
      policyNumber: 'POL-MER-334102',
      authorizationCode: 'CLAVE-EMERG-44109',
      serviceType: 'EMERGENCY',
      serviceStartDate: '2026-09-22',
      serviceEndDate: '2026-09-23',
      diagnosis: 'J18.9 - Neumonía Adquirida en la Comunidad / Dificultad Respiratoria',
      items: [
        { description: 'Atención Médica de Emergencia y Triaje', code: 'EMERG-01', category: 'EMERGENCY', quantity: 1, unitPriceUSD: 150.00, totalUSD: 150.00 },
        { description: 'Nebulizaciones continuas y Oxigenoterapia', code: 'PROC-NEB-01', category: 'PROCEDURE', quantity: 4, unitPriceUSD: 25.00, totalUSD: 100.00 },
        { description: 'Panel de Laboratorio: Hematología Completa y PCR', code: 'LAB-HEM-01', category: 'LAB', quantity: 1, unitPriceUSD: 95.00, totalUSD: 95.00 },
        { description: 'Tomografía Computarizada de Tórax de Alta Resolución', code: 'IMG-TAC-01', category: 'IMAGING', quantity: 1, unitPriceUSD: 220.00, totalUSD: 220.00 }
      ],
      grossAmountUSD: 565.00,
      deductibleUSD: 0.00,
      claimedAmountUSD: 565.00,
      bcvRate: 45.5000,
      status: 'UNDER_REVIEW',
      notes: 'Expediente remitido a liquidación de siniestros de Mercantil Seguros.'
    });

    console.log('Seeded Insurance Claims successfully:');
    console.log(`- Claim 1: ${claim1.claimNumber} (${claim1.claimedAmountUSD} USD)`);
    console.log(`- Claim 2: ${claim2.claimNumber} (${claim2.claimedAmountUSD} USD)`);
    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
}

seedClaims();
