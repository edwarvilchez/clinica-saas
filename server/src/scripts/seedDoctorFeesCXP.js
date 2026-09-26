require('dotenv').config();
const { DoctorFee, Doctor, Patient, User, ClinicalService, InsuranceCompany, Organization } = require('../models');
const { v4: uuidv4 } = require('uuid');

async function seedFees() {
  try {
    const doctors = await Doctor.findAll({ include: [User] });
    const patients = await Patient.findAll({ include: [User] });
    const services = await ClinicalService.findAll();
    const insurers = await InsuranceCompany.findAll();

    if (doctors.length === 0 || patients.length === 0) {
      console.log('Doctors or Patients missing for fee seeding');
      process.exit(0);
    }

    const doc1 = doctors[0];
    const doc2 = doctors[1] || doctors[0];
    const pat1 = patients[0];
    const pat2 = patients[1] || patients[0];
    const srv1 = services[0] || null;
    const srv2 = services[1] || null;
    const ins1 = insurers[0] || null;

    const today = new Date();
    const bcvRate = 30.00;

    // 1. Pending Consultation Fee
    await DoctorFee.create({
      doctorId: doc1.id,
      patientId: pat1.id,
      clinicalServiceId: srv1 ? srv1.id : null,
      serviceConcept: srv1 ? srv1.name : 'Consulta de Cardiología Especializada',
      serviceType: 'CONSULTATION',
      feeType: 'PERCENTAGE',
      totalAmountUSD: 60.00,
      totalAmountVES: (60.00 * bcvRate).toFixed(2),
      bcvRate,
      doctorPercent: 70.00,
      clinicPercent: 30.00,
      doctorAmountUSD: 42.00,
      clinicAmountUSD: 18.00,
      retentionIslrPercent: 3.00,
      retentionIslrUSD: 1.26,
      netPayableUSD: 40.74,
      status: 'PENDING',
      notes: 'Consulta médica ambulatoria matutina'
    });

    // 2. Pending Surgery Fee with Insurance
    await DoctorFee.create({
      doctorId: doc2.id,
      patientId: pat2.id,
      clinicalServiceId: srv2 ? srv2.id : null,
      insuranceCompanyId: ins1 ? ins1.id : null,
      serviceConcept: srv2 ? srv2.name : 'Cirugía Quirúrgica Ambulatoria',
      serviceType: 'SURGERY',
      feeType: 'PERCENTAGE',
      totalAmountUSD: 450.00,
      totalAmountVES: (450.00 * bcvRate).toFixed(2),
      bcvRate,
      doctorPercent: 65.00,
      clinicPercent: 35.00,
      doctorAmountUSD: 292.50,
      clinicAmountUSD: 157.50,
      retentionIslrPercent: 3.00,
      retentionIslrUSD: 8.78,
      netPayableUSD: 283.72,
      status: 'PENDING',
      notes: 'Honorario quirúrgico principal bajo cobertura de aseguradora'
    });

    // 3. Paid Fee with Digital Receipt
    const paidAt = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000); // 2 days ago at 10:00 AM
    await DoctorFee.create({
      doctorId: doc1.id,
      patientId: pat2.id,
      clinicalServiceId: srv1 ? srv1.id : null,
      serviceConcept: 'Procedimiento Electrocardiograma y Valoración',
      serviceType: 'PROCEDURE',
      feeType: 'PERCENTAGE',
      totalAmountUSD: 80.00,
      totalAmountVES: (80.00 * bcvRate).toFixed(2),
      bcvRate,
      doctorPercent: 75.00,
      clinicPercent: 25.00,
      doctorAmountUSD: 60.00,
      clinicAmountUSD: 20.00,
      retentionIslrPercent: 3.00,
      retentionIslrUSD: 1.80,
      netPayableUSD: 58.20,
      status: 'PAID',
      settlementDate: paidAt,
      paidAt,
      paidAmountUSD: 58.20,
      paidAmountVES: (58.20 * bcvRate).toFixed(2),
      paidPaymentMethod: 'Transferencia Bancaria (Banesco)',
      paymentReference: 'TRANSF-9485123',
      receiptNumber: `REC-HON-${today.getFullYear()}-00001`,
      receiptToken: uuidv4(),
      notes: 'Liquidación procesada mediante transferencia electrónica'
    });

    console.log('✅ Sample Doctor Fees CXP and Receipts seeded successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Error seeding Doctor Fees:', err);
    process.exit(1);
  }
}

seedFees();
