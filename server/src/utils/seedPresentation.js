const { User, Role, Patient, Doctor, Nurse, Staff, Specialty, Department, Organization, Appointment, Payment, MedicalRecord, Prescription, LabResult, LabTest, sequelize } = require('../models');

const SEED_PASSWORD = 'ClinicaSaaS!2026';

async function seedPresentation() {
  console.log('🎯 Poblando datos para presentación...\n');
  
  const hospitalOrg = await Organization.findOne({ where: { name: 'Hospital Central Clinica SaaS' } });
  const clinicOrg = await Organization.findOne({ where: { name: 'Clínica Salud Integral' } });
  const proOrg = await Organization.findOne({ where: { name: 'Andrés Cárdenas Practice' } });
  
  const roles = {};
  for (const name of ['SUPERADMIN', 'DOCTOR', 'NURSE', 'PATIENT', 'ADMINISTRATIVE']) {
    roles[name] = await Role.findOne({ where: { name } });
  }

  console.log('🏥 Hospital Central Clinica SaaS');
  
  const hospitalDoctors = [
    { email: 'dr.perez@clinicasaas.com', firstName: 'Roberto', lastName: 'Pérez', specialty: 'Cardiología', license: 'MED-HOSP-002' },
    { email: 'dr.jimenez@clinicasaas.com', firstName: 'Patricia', lastName: 'Jiménez', specialty: 'Ginecología', license: 'MED-HOSP-003' }
  ];
  
  for (const d of hospitalDoctors) {
    let u = await User.findOne({ where: { email: d.email } });
    if (!u) u = await User.create({ username: d.email.split('@')[0], email: d.email, password: SEED_PASSWORD, firstName: d.firstName, lastName: d.lastName, roleId: roles.DOCTOR.id, organizationId: hospitalOrg.id });
    
    let doc = await Doctor.findOne({ where: { userId: u.id } });
    if (!doc) {
      let spec = await Specialty.findOne({ where: { name: d.specialty } });
      if (!spec) spec = await Specialty.create({ name: d.specialty });
      doc = await Doctor.create({ userId: u.id, licenseNumber: d.license, specialtyId: spec.id, organizationId: hospitalOrg.id });
    }
    console.log('  ✅ Dr.', d.lastName);
  }
  
  const hospitalPatients = [
    { name: 'María Castillo', doc: 'V-10000001', phone: '04141234567' },
    { name: 'Carlos Mendoza', doc: 'V-10000002', phone: '04141234568' },
    { name: 'Ana López', doc: 'V-10000003', phone: '04141234569' },
    { name: 'Jorge Ramírez', doc: 'V-10000004', phone: '04141234570' },
    { name: 'Laura Fernández', doc: 'V-10000005', phone: '04141234571' }
  ];
  
  for (const p of hospitalPatients) {
    const [firstName, lastName] = p.name.split(' ');
    let u = await User.findOne({ where: { email: p.doc.toLowerCase() + '@email.com' } });
    if (!u) u = await User.create({ username: p.doc, email: p.doc.toLowerCase() + '@email.com', password: SEED_PASSWORD, firstName, lastName, roleId: roles.PATIENT.id, organizationId: hospitalOrg.id });
    
    let patient = await Patient.findOne({ where: { userId: u.id } });
    if (!patient) patient = await Patient.create({ userId: u.id, documentId: p.doc, phone: p.phone, bloodType: 'O+', organizationId: hospitalOrg.id });
  }
  console.log('  ✅ 5 pacientes adicionales');
  
  const doctorUsers = await User.findAll({ where: { roleId: roles.DOCTOR.id, organizationId: hospitalOrg.id } });
  const patientUsers = await User.findAll({ where: { roleId: roles.PATIENT.id, organizationId: hospitalOrg.id }, limit: 8 });
  
  const today = new Date();
  const reasons = ['Chequeo general', 'Dolor torácico', 'Seguimiento', 'Control prenatal', 'Cita de rutina', 'Revisión cardíaca', 'Control anual', 'Consulta'];
  
  for (let i = 0; i < 10; i++) {
    const doc = doctorUsers[i % doctorUsers.length];
    const pat = patientUsers[i % patientUsers.length];
    const docProfile = await Doctor.findOne({ where: { userId: doc.id } });
    const patProfile = await Patient.findOne({ where: { userId: pat.id } });
    
    const aptDate = new Date(today);
    aptDate.setDate(aptDate.getDate() + i);
    aptDate.setHours(8 + (i * 2), 0, 0, 0);
    
    const status = i < 2 ? 'Completed' : (i < 6 ? 'Confirmed' : 'Pending');
    
    await Appointment.findOrCreate({
      where: { doctorId: docProfile.id, patientId: patProfile.id, date: aptDate },
      defaults: { doctorId: docProfile.id, patientId: patProfile.id, date: aptDate, reason: reasons[i % reasons.length], status, type: i % 3 === 0 ? 'Video' : 'In-Person' }
    });
  }
  console.log('  ✅ 10 citas creadas');
  
  for (let i = 0; i < 6; i++) {
    const pat = patientUsers[i % patientUsers.length];
    const patProfile = await Patient.findOne({ where: { userId: pat.id } });
    
    await Payment.create({
      patientId: patProfile.id,
      amount: (Math.random() * 100 + 50).toFixed(2),
      amountBs: (Math.random() * 500000 + 250000).toFixed(2),
      concept: 'Consulta médica',
      status: i < 4 ? 'Paid' : 'Pending',
      paymentMethod: 'Transferencia',
      organizationId: hospitalOrg.id
    });
  }
  console.log('  ✅ 6 pagos registrados');
  
  console.log('\n🏥 Clínica Salud Integral');
  
  const clinicPatients = [
    { name: 'Fernando Díaz', doc: 'V-20000001' },
    { name: 'Gloria Torres', doc: 'V-20000002' },
    { name: 'Miguel Santos', doc: 'V-20000003' },
    { name: 'Rosa Ortega', doc: 'V-20000004' },
    { name: 'Antonio Vargas', doc: 'V-20000005' },
    { name: 'Isabel Reyes', doc: 'V-20000006' },
    { name: 'David Castro', doc: 'V-20000007' },
    { name: 'Patricia Ruiz', doc: 'V-20000008' }
  ];
  
  for (const p of clinicPatients) {
    const [firstName, lastName] = p.name.split(' ');
    let u = await User.findOne({ where: { email: p.doc.toLowerCase() + '@email.com' } });
    if (!u) u = await User.create({ username: p.doc, email: p.doc.toLowerCase() + '@email.com', password: SEED_PASSWORD, firstName, lastName, roleId: roles.PATIENT.id, organizationId: clinicOrg.id });
    
    let patient = await Patient.findOne({ where: { userId: u.id } });
    if (!patient) patient = await Patient.create({ userId: u.id, documentId: p.doc, organizationId: clinicOrg.id });
  }
  console.log('  ✅ 8 pacientes');
  
  const clinicDocUsers = await User.findAll({ where: { roleId: roles.DOCTOR.id, organizationId: clinicOrg.id } });
  const clinicPatUsers = await User.findAll({ where: { roleId: roles.PATIENT.id, organizationId: clinicOrg.id } });
  
  for (let i = 0; i < 6; i++) {
    const doc = clinicDocUsers[i % clinicDocUsers.length];
    const pat = clinicPatUsers[i % clinicPatUsers.length];
    const docProfile = await Doctor.findOne({ where: { userId: doc.id } });
    const patProfile = await Patient.findOne({ where: { userId: pat.id } });
    
    const aptDate = new Date(today);
    aptDate.setDate(aptDate.getDate() + i);
    aptDate.setHours(9 + i, 0, 0, 0);
    
    await Appointment.findOrCreate({
      where: { doctorId: docProfile.id, patientId: patProfile.id, date: aptDate },
      defaults: { doctorId: docProfile.id, patientId: patProfile.id, date: aptDate, reason: 'Consulta', status: i < 2 ? 'Completed' : 'Confirmed', type: 'In-Person' }
    });
  }
  console.log('  ✅ 6 citas');
  
  for (let i = 0; i < 5; i++) {
    const pat = clinicPatUsers[i % clinicPatUsers.length];
    const patProfile = await Patient.findOne({ where: { userId: pat.id } });
    
    await Payment.create({
      patientId: patProfile.id,
      amount: (Math.random() * 80 + 30).toFixed(2),
      amountBs: (Math.random() * 400000 + 150000).toFixed(2),
      concept: 'Consulta + tratamientos',
      status: 'Paid',
      paymentMethod: 'Efectivo',
      organizationId: clinicOrg.id
    });
  }
  console.log('  ✅ 5 pagos');
  
  console.log('\n👨‍⚕️ Dr. Andrés Cárdenas (Professional)');
  
  const proPatients = [
    { name: 'Eduardo Navarro', doc: 'V-30000001' },
    { name: 'Sandra Contreras', doc: 'V-30000002' },
    { name: 'Marco Delgado', doc: 'V-30000003' }
  ];
  
  for (const p of proPatients) {
    const [firstName, lastName] = p.name.split(' ');
    let u = await User.findOne({ where: { email: p.doc.toLowerCase() + '@email.com' } });
    if (!u) u = await User.create({ username: p.doc, email: p.doc.toLowerCase() + '@email.com', password: SEED_PASSWORD, firstName, lastName, roleId: roles.PATIENT.id, organizationId: proOrg.id });
    
    let patient = await Patient.findOne({ where: { userId: u.id } });
    if (!patient) patient = await Patient.create({ userId: u.id, documentId: p.doc, organizationId: proOrg.id });
  }
  console.log('  ✅ 3 pacientes');
  
  const proDocUser = await User.findOne({ where: { email: 'dr.cardenas@clinicasaas.com' } });
  const proDoc = await Doctor.findOne({ where: { userId: proDocUser.id } });
  const proPatUsers = await User.findAll({ where: { roleId: roles.PATIENT.id, organizationId: proOrg.id } });
  
  for (let i = 0; i < 3; i++) {
    const pat = proPatUsers[i];
    const patProfile = await Patient.findOne({ where: { userId: pat.id } });
    
    const aptDate = new Date(today);
    aptDate.setDate(aptDate.getDate() + i + 1);
    aptDate.setHours(10 + i, 0, 0, 0);
    
    await Appointment.findOrCreate({
      where: { doctorId: proDoc.id, patientId: patProfile.id, date: aptDate },
      defaults: { doctorId: proDoc.id, patientId: patProfile.id, date: aptDate, reason: 'Chequeo', status: 'Confirmed', type: 'Video' }
    });
  }
  console.log('  ✅ 3 videoconsultas');
  
  console.log('\n========================================');
  console.log('🎉 Datos para presentación creados!');
  console.log('========================================\n');
  console.log('Cuentas de acceso:');
  console.log('  Password: ' + SEED_PASSWORD);
  console.log('\n');
  
  process.exit(0);
}

seedPresentation();
