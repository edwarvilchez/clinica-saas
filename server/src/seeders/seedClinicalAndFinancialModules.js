const {
  Specialty,
  Department,
  InsuranceCompany,
  AccountChart,
  ClinicalService,
  HospitalBed,
  Organization,
  Doctor,
  Employee,
  User,
  sequelize
} = require('../models');

async function seedClinicalAndFinancial() {
  console.log('🌱 Poblando datos maestros clínicos, hospitalarios, seguros y contabilidad VEN-NIF...\n');

  const org = await Organization.findOne();
  const orgId = org ? org.id : null;

  // 1. Departamentos y Especialidades Médicas
  const departmentsData = [
    { name: 'Medicina Clínica', description: 'Atención clínica y diagnóstica' },
    { name: 'Cirugía y Quirófano', description: 'Servicios quirúrgicos e intervencionistas' },
    { name: 'Materno Infantil', description: 'Pediatría, obstetricia y ginecología' },
    { name: 'Emergencia y Cuidados Críticos', description: 'Atención 24/7 y terapia intensiva' },
    { name: 'Diagnóstico y Apoyo', description: 'Laboratorio, imágenes y farmacia' }
  ];

  const deptMap = {};
  for (const d of departmentsData) {
    const [dept] = await Department.findOrCreate({
      where: { name: d.name },
      defaults: d
    });
    deptMap[d.name] = dept.id;
  }

  const specialtiesData = [
    { code: 'ESP-MED-01', name: 'Medicina General', nameEn: 'General Medicine', baseFeeUSD: 30.00, dept: 'Medicina Clínica' },
    { code: 'ESP-CAR-02', name: 'Cardiología', nameEn: 'Cardiology', baseFeeUSD: 50.00, dept: 'Medicina Clínica' },
    { code: 'ESP-PED-03', name: 'Pediatría', nameEn: 'Pediatrics', baseFeeUSD: 40.00, dept: 'Materno Infantil' },
    { code: 'ESP-GIN-04', name: 'Ginecología y Obstetricia', nameEn: 'Gynecology & Obstetrics', baseFeeUSD: 50.00, dept: 'Materno Infantil' },
    { code: 'ESP-CIR-05', name: 'Cirugía General', nameEn: 'General Surgery', baseFeeUSD: 60.00, dept: 'Cirugía y Quirófano' },
    { code: 'ESP-TRA-06', name: 'Traumatología y Ortopedia', nameEn: 'Traumatology & Orthopedics', baseFeeUSD: 50.00, dept: 'Cirugía y Quirófano' },
    { code: 'ESP-OFT-07', name: 'Oftalmología', nameEn: 'Ophthalmology', baseFeeUSD: 45.00, dept: 'Medicina Clínica' },
    { code: 'ESP-DER-08', name: 'Dermatología', nameEn: 'Dermatology', baseFeeUSD: 45.00, dept: 'Medicina Clínica' },
    { code: 'ESP-ANE-09', name: 'Anestesiología', nameEn: 'Anesthesiology', baseFeeUSD: 55.00, dept: 'Cirugía y Quirófano' },
    { code: 'ESP-INT-10', name: 'Medicina Interna', nameEn: 'Internal Medicine', baseFeeUSD: 45.00, dept: 'Medicina Clínica' },
    { code: 'ESP-URO-11', name: 'Urología', nameEn: 'Urology', baseFeeUSD: 50.00, dept: 'Cirugía y Quirófano' },
    { code: 'ESP-EME-12', name: 'Medicina de Emergencia', nameEn: 'Emergency Medicine', baseFeeUSD: 35.00, dept: 'Emergencia y Cuidados Críticos' }
  ];

  for (const s of specialtiesData) {
    const [spec, created] = await Specialty.findOrCreate({
      where: { name: s.name },
      defaults: {
        code: s.code,
        name: s.name,
        nameEn: s.nameEn,
        baseFeeUSD: s.baseFeeUSD,
        departmentId: deptMap[s.dept],
        isActive: true
      }
    });
    if (!created) {
      await spec.update({
        code: s.code,
        nameEn: s.nameEn,
        baseFeeUSD: s.baseFeeUSD,
        departmentId: deptMap[s.dept]
      });
    }
  }
  console.log('✅ Especialidades Médicas inicializadas.');

  // 2. Aseguradoras de Venezuela
  const insuranceCompaniesData = [
    { name: 'Seguros Caracas, C.A.', rif: 'J-00038234-0', phone: '+58 212-2092111', email: 'siniestros@seguroscaracas.com', contactPerson: 'Lcda. María Elena Rivas', defaultCoveragePercent: 85.00 },
    { name: 'Mercantil Seguros, S.A.', rif: 'J-00090234-2', phone: '+58 212-2762000', email: 'atencionmedica@mercantilseguros.com', contactPerson: 'Dr. Alejandro Peña', defaultCoveragePercent: 80.00 },
    { name: 'Mapfre La Seguridad, C.A.', rif: 'J-00012389-4', phone: '+58 212-9011111', email: 'salud@mapfre.com.ve', contactPerson: 'Ing. Carlos Mendoza', defaultCoveragePercent: 80.00 },
    { name: 'Seguros Pirámide, C.A.', rif: 'J-00102938-1', phone: '+58 212-2015555', email: 'cartasavales@segurospiramide.com', contactPerson: 'Lcda. Diana Solórzano', defaultCoveragePercent: 75.00 },
    { name: 'Sanitas Venezuela, S.A.', rif: 'J-30495882-9', phone: '+58 212-9095000', email: 'convenios@sanitasvenezuela.com', contactPerson: 'Dra. Patricia Blanco', defaultCoveragePercent: 90.00 },
    { name: 'Banesco Seguros, C.A.', rif: 'J-30129845-0', phone: '+58 212-5011111', email: 'salud@banescoseguros.com', contactPerson: 'Lic. Roberto Gómez', defaultCoveragePercent: 80.00 }
  ];

  for (const ins of insuranceCompaniesData) {
    await InsuranceCompany.findOrCreate({
      where: { rif: ins.rif },
      defaults: { ...ins, organizationId: orgId }
    });
  }
  console.log('✅ Aseguradoras venezolanas registradas.');

  // 3. Plan Único de Cuentas Contables (VEN-NIF)
  const chartOfAccounts = [
    // ACTIVO
    { code: '1', name: 'ACTIVO', accountType: 'ASSET', category: 'CURRENT', level: 1, allowsMovement: false },
    { code: '1.1', name: 'ACTIVO CORRIENTE', accountType: 'ASSET', category: 'CURRENT', level: 2, allowsMovement: false, parentCode: '1' },
    { code: '1.1.01', name: 'Efectivo y Equivalentes de Efectivo', accountType: 'ASSET', category: 'CURRENT', level: 3, allowsMovement: false, parentCode: '1.1' },
    { code: '1.1.01.01', name: 'Caja Principal (USD)', accountType: 'ASSET', category: 'CURRENT', level: 4, allowsMovement: true, parentCode: '1.1.01' },
    { code: '1.1.01.02', name: 'Caja Principal (Bolívares - VES)', accountType: 'ASSET', category: 'CURRENT', level: 4, allowsMovement: true, parentCode: '1.1.01' },
    { code: '1.1.01.03', name: 'Banco Nacional Banesco (VES)', accountType: 'ASSET', category: 'CURRENT', level: 4, allowsMovement: true, parentCode: '1.1.01' },
    { code: '1.1.01.04', name: 'Banco Custodia Internacional (USD / Zelle)', accountType: 'ASSET', category: 'CURRENT', level: 4, allowsMovement: true, parentCode: '1.1.01' },
    { code: '1.1.02', name: 'Cuentas por Cobrar Médicas', accountType: 'ASSET', category: 'CURRENT', level: 3, allowsMovement: false, parentCode: '1.1' },
    { code: '1.1.02.01', name: 'Cuentas por Cobrar - Pacientes Particulares', accountType: 'ASSET', category: 'CURRENT', level: 4, allowsMovement: true, parentCode: '1.1.02' },
    { code: '1.1.02.02', name: 'Cuentas por Cobrar - Empresas Aseguradoras', accountType: 'ASSET', category: 'CURRENT', level: 4, allowsMovement: true, parentCode: '1.1.02' },
    { code: '1.1.03', name: 'Inventario Médico y Farmacia', accountType: 'ASSET', category: 'CURRENT', level: 3, allowsMovement: false, parentCode: '1.1' },
    { code: '1.1.03.01', name: 'Inventario de Medicamentos (FEFO)', accountType: 'ASSET', category: 'CURRENT', level: 4, allowsMovement: true, parentCode: '1.1.03' },
    { code: '1.1.03.02', name: 'Inventario de Material Quirúrgico e Insumos', accountType: 'ASSET', category: 'CURRENT', level: 4, allowsMovement: true, parentCode: '1.1.03' },
    
    // PASIVO
    { code: '2', name: 'PASIVO', accountType: 'LIABILITY', category: 'CURRENT', level: 1, allowsMovement: false },
    { code: '2.1', name: 'PASIVO CORRIENTE', accountType: 'LIABILITY', category: 'CURRENT', level: 2, allowsMovement: false, parentCode: '2' },
    { code: '2.1.01', name: 'Honorarios Profesionales Médicos por Pagar', accountType: 'LIABILITY', category: 'CURRENT', level: 3, allowsMovement: true, parentCode: '2.1' },
    { code: '2.1.02', name: 'Cuentas por Pagar Proveedores Farmacéuticos', accountType: 'LIABILITY', category: 'CURRENT', level: 3, allowsMovement: true, parentCode: '2.1' },
    { code: '2.1.03', name: 'Retenciones Fiscales por Enterar (SENIAT)', accountType: 'LIABILITY', category: 'TAX', level: 3, allowsMovement: false, parentCode: '2.1' },
    { code: '2.1.03.01', name: 'Retención de IVA por Enterar (75% / 100%)', accountType: 'LIABILITY', category: 'TAX', level: 4, allowsMovement: true, parentCode: '2.1.03' },
    { code: '2.1.03.02', name: 'Retención de ISLR Honorarios Profesionales (3%)', accountType: 'LIABILITY', category: 'TAX', level: 4, allowsMovement: true, parentCode: '2.1.03' },
    { code: '2.1.04', name: 'Nómina y Beneficios de Empleados por Pagar', accountType: 'LIABILITY', category: 'CURRENT', level: 3, allowsMovement: true, parentCode: '2.1' },

    // PATRIMONIO
    { code: '3', name: 'PATRIMONIO', accountType: 'EQUITY', category: 'NON_CURRENT', level: 1, allowsMovement: false },
    { code: '3.1.01', name: 'Capital Social Suscrito y Pagado', accountType: 'EQUITY', category: 'NON_CURRENT', level: 3, allowsMovement: true, parentCode: '3' },
    { code: '3.2.01', name: 'Resultados Acumulados / Ejercicios Anteriores', accountType: 'EQUITY', category: 'NON_CURRENT', level: 3, allowsMovement: true, parentCode: '3' },

    // INGRESOS
    { code: '4', name: 'INGRESOS', accountType: 'REVENUE', category: 'OPERATIONAL', level: 1, allowsMovement: false },
    { code: '4.1', name: 'INGRESOS OPERACIONALES CLÍNICOS', accountType: 'REVENUE', category: 'OPERATIONAL', level: 2, allowsMovement: false, parentCode: '4' },
    { code: '4.1.01', name: 'Ingresos por Consultas Médicas y Especialidades', accountType: 'REVENUE', category: 'OPERATIONAL', level: 3, allowsMovement: true, parentCode: '4.1' },
    { code: '4.1.02', name: 'Ingresos por Quirófano y Procedimientos Quirúrgicos', accountType: 'REVENUE', category: 'OPERATIONAL', level: 3, allowsMovement: true, parentCode: '4.1' },
    { code: '4.1.03', name: 'Ingresos por Hospitalización y Uso de Camas', accountType: 'REVENUE', category: 'OPERATIONAL', level: 3, allowsMovement: true, parentCode: '4.1' },
    { code: '4.1.04', name: 'Ingresos por Emergencias y Triaje', accountType: 'REVENUE', category: 'OPERATIONAL', level: 3, allowsMovement: true, parentCode: '4.1' },
    { code: '4.1.05', name: 'Ingresos por Laboratorio Clínico y Diagnóstico', accountType: 'REVENUE', category: 'OPERATIONAL', level: 3, allowsMovement: true, parentCode: '4.1' },

    // COSTOS
    { code: '5', name: 'COSTOS', accountType: 'COST', category: 'OPERATIONAL', level: 1, allowsMovement: false },
    { code: '5.1.01', name: 'Costo por Liquidación de Honorarios Médicos', accountType: 'COST', category: 'OPERATIONAL', level: 3, allowsMovement: true, parentCode: '5' },
    { code: '5.1.02', name: 'Costo de Medicamentos e Insumos Utilizados', accountType: 'COST', category: 'OPERATIONAL', level: 3, allowsMovement: true, parentCode: '5' },

    // GASTOS
    { code: '6', name: 'GASTOS', accountType: 'EXPENSE', category: 'OPERATIONAL', level: 1, allowsMovement: false },
    { code: '6.1.01', name: 'Gastos de Sueldos y Salarios Personal de Planta', accountType: 'EXPENSE', category: 'OPERATIONAL', level: 3, allowsMovement: true, parentCode: '6' },
    { code: '6.1.02', name: 'Gastos de Servicios Básicos y Mantenimiento', accountType: 'EXPENSE', category: 'OPERATIONAL', level: 3, allowsMovement: true, parentCode: '6' }
  ];

  for (const acc of chartOfAccounts) {
    const [account, created] = await AccountChart.findOrCreate({
      where: { code: acc.code },
      defaults: { ...acc, organizationId: orgId }
    });
    if (!created) {
      await account.update(acc);
    }
  }
  console.log('✅ Plan Único de Cuentas VEN-NIF estructurado.');

  // 4. Catálogo de Servicios Clínicos
  const clinicalServices = [
    { code: 'SRV-CON-01', name: 'Consulta Médica General', category: 'CONSULTATION', priceUSD: 30.00, isTaxExempt: true, requiresDoctor: true },
    { code: 'SRV-CON-02', name: 'Consulta de Especialidad Cardiológica', category: 'CONSULTATION', priceUSD: 50.00, isTaxExempt: true, requiresDoctor: true },
    { code: 'SRV-CON-03', name: 'Consulta Pediátrica Integral', category: 'CONSULTATION', priceUSD: 40.00, isTaxExempt: true, requiresDoctor: true },
    { code: 'SRV-LAB-01', name: 'Perfil 20 Completo (Laboratorio)', category: 'LABORATORY', priceUSD: 25.00, isTaxExempt: true, requiresDoctor: false },
    { code: 'SRV-LAB-02', name: 'Perfil Lipídico y Glucosa', category: 'LABORATORY', priceUSD: 15.00, isTaxExempt: true, requiresDoctor: false },
    { code: 'SRV-IMG-01', name: 'Radiografía de Tórax Digital', category: 'IMAGING', priceUSD: 20.00, isTaxExempt: true, requiresDoctor: false },
    { code: 'SRV-IMG-02', name: 'Ecografía Abdominal y Pélvica', category: 'IMAGING', priceUSD: 35.00, isTaxExempt: true, requiresDoctor: true },
    { code: 'SRV-EME-01', name: 'Atención de Emergencia y Triaje', category: 'EMERGENCY', priceUSD: 40.00, isTaxExempt: true, requiresDoctor: true },
    { code: 'SRV-HOS-01', name: 'Día de Hospitalización (Habitación Individual)', category: 'HOSPITALIZATION', priceUSD: 150.00, isTaxExempt: true, requiresDoctor: false },
    { code: 'SRV-HOS-02', name: 'Día de Cuidados Intensivos (UCI)', category: 'HOSPITALIZATION', priceUSD: 450.00, isTaxExempt: true, requiresDoctor: false },
    { code: 'SRV-CIR-01', name: 'Uso de Quirófano Mayor (por hora)', category: 'SURGERY', priceUSD: 200.00, isTaxExempt: true, requiresDoctor: false },
    { code: 'SRV-CIR-02', name: 'Cirugía de Apendicectomía Laparoscópica (Paquete Clínico)', category: 'SURGERY', priceUSD: 1200.00, isTaxExempt: true, requiresDoctor: true },
    { code: 'SRV-CIR-03', name: 'Cirugía de Colecistectomía (Paquete Clínico)', category: 'SURGERY', priceUSD: 1400.00, isTaxExempt: true, requiresDoctor: true }
  ];

  for (const srv of clinicalServices) {
    await ClinicalService.findOrCreate({
      where: { code: srv.code },
      defaults: { ...srv, organizationId: orgId }
    });
  }
  console.log('✅ Catálogo de Servicios y Procedimientos clínicos registrado.');

  // 5. Camas Hospitalarias y Quirófanos
  const hospitalBeds = [
    { bedNumber: 'HAB-101-A', roomNumber: '101', floor: 'Piso 1', wing: 'Ala Este', roomType: 'INDIVIDUAL', dailyRateUSD: 150.00, status: 'AVAILABLE', features: 'Baño privado, cama eléctrica, TV, oxígeno' },
    { bedNumber: 'HAB-102-A', roomNumber: '102', floor: 'Piso 1', wing: 'Ala Este', roomType: 'INDIVIDUAL', dailyRateUSD: 150.00, status: 'AVAILABLE', features: 'Baño privado, cama eléctrica, TV, oxígeno' },
    { bedNumber: 'HAB-103-A', roomNumber: '103', floor: 'Piso 1', wing: 'Ala Oeste', roomType: 'SHARED', dailyRateUSD: 90.00, status: 'AVAILABLE', features: 'Habitación compartida, cortina divisoria, toma de O2' },
    { bedNumber: 'HAB-103-B', roomNumber: '103', floor: 'Piso 1', wing: 'Ala Oeste', roomType: 'SHARED', dailyRateUSD: 90.00, status: 'AVAILABLE', features: 'Habitación compartida, cortina divisoria, toma de O2' },
    { bedNumber: 'UCI-201', roomNumber: 'UCI-1', floor: 'Piso 2', wing: 'Terapia Intensiva', roomType: 'ICU', dailyRateUSD: 450.00, status: 'AVAILABLE', features: 'Monitor multiparamétrico, ventilador mecánico, bombas de infusión' },
    { bedNumber: 'UCI-202', roomNumber: 'UCI-2', floor: 'Piso 2', wing: 'Terapia Intensiva', roomType: 'ICU', dailyRateUSD: 450.00, status: 'AVAILABLE', features: 'Monitor multiparamétrico, ventilador mecánico, bombas de infusión' },
    { bedNumber: 'OBS-01', roomNumber: 'EMERG-1', floor: 'Planta Baja', wing: 'Emergencias', roomType: 'EMERGENCY_OBSERVATION', dailyRateUSD: 80.00, status: 'AVAILABLE', features: 'Cama de observación corta estancia, monitoreo básico' },
    { bedNumber: 'OBS-02', roomNumber: 'EMERG-2', floor: 'Planta Baja', wing: 'Emergencias', roomType: 'EMERGENCY_OBSERVATION', dailyRateUSD: 80.00, status: 'AVAILABLE', features: 'Cama de observación corta estancia, monitoreo básico' }
  ];

  for (const bed of hospitalBeds) {
    await HospitalBed.findOrCreate({
      where: { bedNumber: bed.bedNumber },
      defaults: { ...bed, organizationId: orgId }
    });
  }
  console.log('✅ Camas hospitalarias y unidades de cuidados registradas.');

  // 6. Empleados de Planta y Sincronización con Médicos
  const existingDocs = await Doctor.findAll({ include: [User] });
  for (const doc of existingDocs) {
    if (doc.User) {
      const code = `EMP-DOC-${doc.id.substring(0, 4).toUpperCase()}`;
      await Employee.findOrCreate({
        where: { documentId: doc.licenseNumber || 'V-10000000' },
        defaults: {
          organizationId: orgId,
          userId: doc.userId,
          doctorId: doc.id,
          employeeCode: code,
          documentId: doc.licenseNumber || 'V-10000000',
          firstName: doc.User.firstName || 'Dr.',
          lastName: doc.User.lastName || 'Médico',
          email: doc.User.email,
          phone: doc.phone || '+58 412-0000000',
          jobTitle: 'Médico Especialista',
          departmentId: deptMap['Medicina Clínica'],
          specialtyId: doc.specialtyId,
          isDoctor: true,
          medicalLicense: doc.licenseNumber,
          contractType: 'PROFESSIONAL_FEES',
          baseSalaryUSD: 1200.00,
          status: 'ACTIVE'
        }
      });
    }
  }
  console.log('✅ Empleados sincronizados con perfiles médicos.');

  console.log('\n🎉 ¡Población de datos iniciales completada con éxito!');
}

if (require.main === module) {
  seedClinicalAndFinancial()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Error seeding data:', err);
      process.exit(1);
    });
}

module.exports = seedClinicalAndFinancial;
