// populate_demo.js
// Script para generar datos de prueba vinculados a los pacientes existentes (Lab, Historia, Recetas)

const { Patient, Doctor, LabResult, MedicalRecord, Prescription, Drug, User, Role, Organization, Specialty, sequelize } = require('./server/src/models');

async function seed() {
  try {
    console.log('--- Iniciando Seteo de Datos para Demo ---');
    
    // 1. Obtener pacientes
    const patients = await Patient.findAll({ 
      include: [{ model: User }]
    });

    if (patients.length === 0) {
      console.log('Error: No hay pacientes en la base de datos para vincular.');
      return;
    }

    // 2. Asegurar que existe un Doctor para la demo
    let doctor = await Doctor.findOne();
    if (!doctor) {
      console.log('No se encontró un doctor. Creando perfil de doctor demo...');
      const docRole = await Role.findOne({ where: { name: 'DOCTOR' } });
      const firstOrg = await Organization.findOne();
      
      const user = await User.create({
        username: 'dr_medical',
        email: 'doctor.demo@medicalcare-888.com',
        password: 'MedicalCare888!',
        firstName: 'Guillermo',
        lastName: 'Vivas',
        roleId: docRole.id,
        organizationId: firstOrg ? firstOrg.id : null
      });

      doctor = await Doctor.create({
        userId: user.id,
        licenseNumber: 'MSAS-' + Math.floor(Math.random() * 90000 + 10000),
        phone: '04141234567',
        organizationId: user.organizationId
      });
    }

    // 3. Asegurar que existe un medicamento guía
    let drug = await Drug.findOne();
    if (!drug) {
      console.log('Creando medicamento base...');
      drug = await Drug.create({
        name: 'Complejo B Forte',
        activeComponents: 'B1, B6, B12',
        presentation: 'Caja x 30 Tabletas',
        category: 'Multivitamínico',
        indications: 'Deficiencia de vitaminas del grupo B'
      });
    }

    console.log(`Procesando ${patients.length} pacientes...`);

    for (const p of patients) {
      // Evitar duplicar si ya tiene algo
      const hasLabs = await LabResult.count({ where: { patientId: p.id } });
      
      if (hasLabs === 0) {
        // Crear Resultado de Hematología
        await LabResult.create({
          testName: 'Hematología Completa',
          patientId: p.id,
          category: 'Sangre',
          price: 12.50,
          status: 'Completed',
          resultValue: 'Hb: 14.8 g/dL, Hct: 44%, Leuc: 6.800/mm3, Plaq: 240.000/mm3',
          referenceRange: 'Hb: 13-17, Hct: 40-50, Plaq: 150-450'
        });

        // Crear Resultado de Perfil 20
        await LabResult.create({
          testName: 'Glicemia y Colesterol',
          patientId: p.id,
          category: 'Sangre',
          price: 18.00,
          status: 'Completed',
          resultValue: 'Glicemia: 92 mg/dL, Colesterol: 185 mg/dL, Triglicéridos: 130 mg/dL',
          referenceRange: 'Glic: 70-110, Col: <200, Tri: <150'
        });
        
        console.log(`+ Labs creados para ${p.User?.firstName} ${p.User?.lastName}`);
      }

      const hasHistory = await MedicalRecord.count({ where: { patientId: p.id } });
      if (hasHistory === 0) {
        // Crear Consulta Médica
        const record = await MedicalRecord.create({
          patientId: p.id,
          doctorId: doctor.id,
          diagnosis: 'Paciente en buen estado general. Control de rutina.',
          physicalExam: 'TA: 120/80 mmHg, Peso: 70kg, Talla: 1.70m. Sin hallazgos patológicos.',
          treatment: 'Alimentación balanceada, reducción de azúcares procesados.',
          indications: 'Repetir laboratorios en 12 meses.'
        });

        // Crear Receta vinculada
        await Prescription.create({
          medicalRecordId: record.id,
          drugId: drug.id,
          drugName: drug.name,
          dosage: '1 tableta',
          frequency: 'Cada 24 horas (En ayuna)',
          duration: '3 meses',
          instructions: 'No suspender sin indicación médica.'
        });

        console.log(`+ Historia y Receta creada para ${p.User?.firstName} ${p.User?.lastName}`);
      }
    }

    console.log('--- PROCESO DE DEMO FINALIZADO CON ÉXITO ---');
    process.exit(0);
  } catch (err) {
    console.error('ERROR EN SEEDER DEMO:', err);
    process.exit(1);
  }
}

seed();
