require('dotenv').config();
const { Doctor, User, Specialty } = require('../models');

async function seedCredentials() {
  try {
    const doctors = await Doctor.findAll({ include: [User, Specialty] });
    console.log(`Found ${doctors.length} doctors.`);

    const today = new Date();
    
    // Sample dates
    const expirySoonDate = new Date(today.getTime() + 18 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 18 days (3-week warning)
    const expiryMonthDate = new Date(today.getTime() + 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 28 days (1-month notice)
    const validDate = new Date(today.getTime() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 6 months (valid)
    const issueDate = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 1 year ago

    const sampleData = [
      {
        university: 'Universidad Central de Venezuela (UCV)',
        degreeTitle: 'Médico Cirujano - Especialista en Cardiología',
        mppsNumber: 'MPPS-58921',
        collegeNumber: 'CMD-14258',
        credentialsIssueDate: issueDate,
        credentialsExpiryDate: validDate,
        additionalSpecialties: ['Ecocardiografía', 'Cardiología Intervencionista'],
        chargesProfessionalFees: true
      },
      {
        university: 'Universidad del Zulia (LUZ)',
        degreeTitle: 'Médico Cirujano - Pediatra Puericultor',
        mppsNumber: 'MPPS-41203',
        collegeNumber: 'COMEZU-9874',
        credentialsIssueDate: issueDate,
        credentialsExpiryDate: expirySoonDate, // Alert
        additionalSpecialties: ['Neonatología'],
        chargesProfessionalFees: true
      },
      {
        university: 'Universidad de Carabobo (UC)',
        degreeTitle: 'Médico Cirujano - Traumatología y Ortopedia',
        mppsNumber: 'MPPS-63114',
        collegeNumber: 'CMEC-7412',
        credentialsIssueDate: issueDate,
        credentialsExpiryDate: expiryMonthDate, // Alert 1 month
        additionalSpecialties: ['Cirugía Artroscópica'],
        chargesProfessionalFees: true
      }
    ];

    for (let i = 0; i < doctors.length; i++) {
      const doc = doctors[i];
      const data = sampleData[i % sampleData.length];
      await doc.update(data);
      console.log(`Updated Doctor ${doc.User?.firstName || doc.id} with Venezuelan credentials.`);
    }

    console.log('✅ Doctor credentials seeded successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Error seeding credentials:', err);
    process.exit(1);
  }
}

seedCredentials();
