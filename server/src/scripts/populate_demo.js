// server/src/scripts/populate_demo.js
const { Patient, Doctor, LabResult, MedicalRecord, Prescription, Drug, User, Role, Organization, Specialty, sequelize } = require('../models');

async function seed() {
  try {
    console.log('--- Iniciando Seteo de Datos para Demo (Server Mode) ---');
    
    // 1. Obtener pacientes
    const patients = await Patient.findAll({ 
      include: [{ model: User }]
    });

    if (patients.length === 0) {
      console.log('Error: No hay pacientes en la base de datos.');
      return;
    }

    // 2. Doctor demo
    let doctor = await Doctor.findOne();
    if (!doctor) {
       const docRole = await Role.findOne({ where: { name: 'DOCTOR' } });
       const firstOrg = await Organization.findOne();
       const user = await User.create({
         username: 'dr_demo_1',
         email: 'dr.demo@clinica.com',
         password: 'DemoPassword123!',
         firstName: 'Carlos',
         lastName: 'Hernandez',
         roleId: docRole.id,
         organizationId: firstOrg?.id
       });
       doctor = await Doctor.create({
         userId: user.id,
         licenseNumber: 'MSAS-' + (Date.now() % 100000),
         organizationId: user.organizationId
       });
    }

    // 3. Medicamento base
    let drug = await Drug.findOne();
    if (!drug) {
      drug = await Drug.create({
        name: 'Complejo B',
        activeComponents: 'Vitamina B',
        presentation: 'Jarabe',
        category: 'Vitaminas'
      });
    }

    for (const p of patients) {
      // Labs - Adicionales
      const tests = [
        { name: 'Hematología Completa', cat: 'Sangre', val: 'Glóbulos Rojos: 4.8M, Hemoglobina: 14.2 g/dL', price: 15 },
        { name: 'Examen General de Orina', cat: 'Orina', val: 'Aspecto: Límpido, pH: 6.0, Proteínas: Negativo', price: 8 },
        { name: 'Rayos X de Tórax', cat: 'Imagen', val: 'Campos pulmonares limpios, silueta cardíaca normal', price: 50 },
        { name: 'Perfil Lipídico', cat: 'Sangre', val: 'Colesterol: 180 mg/dL, Triglicéridos: 140 mg/dL', price: 25 }
      ];

      for (const t of tests) {
        const alreadyHas = await LabResult.findOne({ where: { patientId: p.id, testName: t.name } });
        if (!alreadyHas) {
          await LabResult.create({
            testName: t.name,
            patientId: p.id,
            category: t.cat,
            price: t.price,
            status: 'Completed',
            resultValue: t.val,
            createdAt: new Date(Date.now() - Math.floor(Math.random() * 10) * 24 * 60 * 60 * 1000)
          });
        }
      }

      // History
      const existsRec = await MedicalRecord.count({ where: { patientId: p.id } });
      if (existsRec === 0) {
        const record = await MedicalRecord.create({
          patientId: p.id,
          doctorId: doctor.id,
          diagnosis: 'Control General',
          physicalExam: 'Normal',
          treatment: 'Seguir indicaciones'
        });
        await Prescription.create({
          medicalRecordId: record.id,
          drugId: drug.id,
          drugName: drug.name,
          dosage: '1', frequency: 'Día', duration: '30'
        });
      }
    }
    console.log('--- OK ---');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
seed();
