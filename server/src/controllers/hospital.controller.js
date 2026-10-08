const {
  Admission,
  EmergencyTriage,
  HospitalBed,
  HospitalStay,
  Surgery,
  Patient,
  Doctor,
  Specialty,
  InsuranceCompany,
  User,
  sequelize
} = require('../models');

const getOrgId = (req) => req.user?.organizationId || req.organizationId || null;
const isPlatformAdmin = (req) => req.user?.role === 'SUPERADMIN' || req.user?.role === 'PLATFORM_ADMIN';

// ── ADMISIONES ──────────────────────────────────
exports.getAdmissions = async (req, res) => {
  try {
    const { status, admissionType } = req.query;
    const where = {};
    if (status) where.status = status;
    if (admissionType) where.admissionType = admissionType;

    const orgId = getOrgId(req);
    const isSuperAdmin = isPlatformAdmin(req);
    if (!isSuperAdmin && orgId) {
      where.organizationId = orgId;
    }

    const admissions = await Admission.findAll({
      where,
      include: [
        { model: Patient, include: [{ model: User, attributes: ['firstName', 'lastName', 'email'] }] },
        { model: Doctor, include: [{ model: User, attributes: ['firstName', 'lastName'] }] },
        { model: InsuranceCompany, attributes: ['id', 'name', 'rif'] },
        { model: EmergencyTriage },
        { model: HospitalStay, include: [{ model: HospitalBed }] },
        { model: Surgery }
      ],
      order: [['admissionDate', 'DESC']]
    });

    res.json(admissions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createAdmission = async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const {
      patientId,
      medicalRecordNumber,
      attendingDoctorId,
      admissionType = 'HOSPITALIZATION',
      admissionDate,
      paymentType,
      hasInsurance,
      insuranceCompanyId,
      insurancePolicyNumber,
      insurancePlan,
      insuranceHolderType,
      insuranceCoverageAmountUSD,
      insuranceAuthorizationCode,
      insuranceClaimNumber,
      insuranceCartaAval,
      initialDiagnosis,
      companionName,
      companionPhone,
      titularData,
      guarantorData,
      insuredPatientData,
      initialArea = 'ADMISIÓN',
      performedBy,
      authorizedBy,
      notes
    } = req.body;

    // Find patient by patientId or medicalRecordNumber
    let patient = null;
    if (patientId) {
      patient = await Patient.findByPk(patientId, { include: [User, InsuranceCompany] });
    } else if (medicalRecordNumber) {
      const { Op } = require('sequelize');
      patient = await Patient.findOne({
        where: {
          [Op.or]: [
            { medicalRecordNumber: medicalRecordNumber.trim() },
            { documentId: medicalRecordNumber.replace(/[^A-Za-z0-9]/g, '').toUpperCase() }
          ]
        },
        include: [User, InsuranceCompany]
      });
    }

    if (!patient) {
      return res.status(400).json({ message: 'Paciente no encontrado. Ingrese un paciente válido o un número de historia médica existente.' });
    }

    const t = await sequelize.transaction();
    try {
      // Validar que el paciente NO tenga un episodio de admisión activo
      const { Op } = require('sequelize');
      const activeAdmission = await Admission.findOne({
        where: {
          patientId: patient.id,
          status: {
            [Op.notIn]: ['DISCHARGED', 'CLOSED', 'CANCELLED']
          }
        },
        transaction: t
      });

      if (activeAdmission) {
        await t.rollback();
        return res.status(400).json({
          message: `El paciente ya tiene un episodio de admisión ACTIVO (${activeAdmission.admissionNumber || activeAdmission.episodeNumber} en área "${activeAdmission.currentArea}" con estado "${activeAdmission.status}"). No se puede generar una nueva admisión sin procesar previamente el alta médica y administrativa o el cierre de la admisión anterior.`
        });
      }

      if (!initialDiagnosis) {
        await t.rollback();
        return res.status(400).json({ message: 'El diagnóstico inicial es obligatorio.' });
      }

      // Check Demographics completeness:
      const missingFields = [];
      if (!patient.phone && !patient.User?.phone) missingFields.push('Teléfono');
      if (!patient.address) missingFields.push('Dirección de habitación');
      if (!patient.birthDate) missingFields.push('Fecha de nacimiento');
      if (!patient.gender) missingFields.push('Género');

      const isEmergency = admissionType === 'EMERGENCY';
      let missingDemographicsWarning = false;

      if (missingFields.length > 0) {
        if (!isEmergency) {
          await t.rollback();
          return res.status(400).json({
            message: `En admisiones no urgentes (${admissionType}) es obligatorio completar los datos demográficos del paciente. Faltan: ${missingFields.join(', ')}.`
          });
        } else {
          // In Emergency, allow admission but flag warning for later completion
          missingDemographicsWarning = true;
        }
      }

      const year = new Date().getFullYear();
      const count = await Admission.count({ transaction: t });
      const seq = String(count + 1).padStart(5, '0');
      const admissionNumber = `ADM-${year}-${seq}`;
      const episodeNumber = `EP-${year}-${seq}`;

      // Compute patient snapshot
      let age = null;
      if (patient.birthDate) {
        const birth = new Date(patient.birthDate);
        const diff = Date.now() - birth.getTime();
        age = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
      }

      const patientDataSnapshot = {
        id: patient.id,
        medicalRecordNumber: patient.medicalRecordNumber || `HC-${patient.documentId}`,
        fullName: `${patient.User?.firstName || ''} ${patient.User?.lastName || ''}`.trim(),
        documentId: patient.documentId,
        documentType: patient.documentType || 'CEDULA',
        documentPrefix: patient.documentPrefix || 'V',
        documentNumber: patient.documentNumber || patient.documentId.replace(/[^0-9]/g, ''),
        birthDate: patient.birthDate,
        age,
        gender: patient.gender,
        bloodType: patient.bloodType,
        phone: patient.phone || patient.User?.phone,
        email: patient.User?.email,
        state: patient.state,
        city: patient.city,
        municipality: patient.municipality,
        address: patient.address,
        hasInsurance: hasInsurance !== undefined ? !!hasInsurance : patient.hasInsurance,
        insuranceCompany: patient.InsuranceCompany?.name || patient.insuranceProvider,
        policyNumber: patient.policyNumber || insurancePolicyNumber
      };

      const isInsured = hasInsurance !== undefined ? !!hasInsurance : patient.hasInsurance;
      const initialAreaName = isEmergency ? 'EMERGENCIA / TRIAJE' : (initialArea || 'ADMISIÓN GENERAL');

      const initialMovement = {
        id: require('uuid').v4(),
        fromArea: 'EXTERIOR / INGRESO',
        toArea: initialAreaName,
        timestamp: new Date().toISOString(),
        performedBy: performedBy || (req.user ? `${req.user.firstName} ${req.user.lastName}` : 'Personal de Admisión'),
        authorizedBy: authorizedBy || 'Médico de Guardia / Tratante',
        reason: isEmergency ? 'Ingreso Inmediato por Emergencia' : `Apertura de Episodio de Admisión (${admissionType})`,
        notes: notes || 'Admisión registrada en sistema'
      };

      const admission = await Admission.create({
        organizationId: orgId,
        admissionNumber,
        episodeNumber,
        patientId: patient.id,
        medicalRecordNumber: patient.medicalRecordNumber || `HC-${patient.documentId}`,
        attendingDoctorId: attendingDoctorId || null,
        admissionType,
        admissionDate: admissionDate || new Date(),
        paymentType: paymentType || (isInsured ? 'INSURANCE' : 'PRIVATE'),
        hasInsurance: isInsured,
        insuranceCompanyId: isInsured ? (insuranceCompanyId || patient.insuranceCompanyId || null) : null,
        insurancePolicyNumber: isInsured ? (insurancePolicyNumber || patient.policyNumber || null) : null,
        insurancePlan: isInsured ? insurancePlan : null,
        insuranceHolderType: isInsured ? (insuranceHolderType || 'TITULAR') : 'TITULAR',
        insuranceCoverageAmountUSD: isInsured ? (parseFloat(insuranceCoverageAmountUSD || 0)) : 0.00,
        insuranceAuthorizationCode: isInsured ? insuranceAuthorizationCode : null,
        insuranceClaimNumber: isInsured ? insuranceClaimNumber : null,
        insuranceCartaAval: isInsured ? insuranceCartaAval : null,
        initialDiagnosis,
        status: 'ADMITTED',
        currentArea: initialAreaName,
        areaMovements: [initialMovement],
        missingDemographicsWarning,
        missingDemographicsFields: missingFields,
        patientDataSnapshot,
        titularData: titularData || {},
        guarantorData: guarantorData || {},
        insuredPatientData: insuredPatientData || patientDataSnapshot,
        companionName,
        companionPhone,
        notes
      }, { transaction: t });

      await t.commit();

      const populated = await Admission.findByPk(admission.id, {
        include: [
          { model: Patient, include: [{ model: User }] },
          { model: Doctor, include: [{ model: User }] },
          { model: InsuranceCompany }
        ]
      });

      res.status(201).json({
        message: '¡Admisión registrada exitosamente!',
        admission: populated,
        missingDemographicsWarning,
        missingFields
      });
    } catch (error) {
      await t.rollback();
      console.error('Error in createAdmission:', error);
      res.status(500).json({ message: error.message });
    }
};

// ── ACTUALIZAR ADMISIÓN (SOLO SI NO ESTÁ CERRADA/DADA DE ALTA) ──
exports.updateAdmission = async (req, res) => {
  try {
    const { id } = req.params;
    const admission = await Admission.findByPk(id);
    if (!admission) {
      return res.status(404).json({ message: 'Episodio de admisión no encontrado' });
    }

    if (['DISCHARGED', 'CLOSED', 'CANCELLED'].includes(admission.status)) {
      return res.status(400).json({
        message: 'Esta admisión se encuentra cerrada por completo y no puede ser modificada. Todos sus registros son de solo lectura.'
      });
    }

    const {
      attendingDoctorId,
      admissionType,
      paymentType,
      hasInsurance,
      insuranceCompanyId,
      insurancePolicyNumber,
      insurancePlan,
      insuranceHolderType,
      insuranceCoverageAmountUSD,
      insuranceAuthorizationCode,
      insuranceClaimNumber,
      insuranceCartaAval,
      initialDiagnosis,
      companionName,
      companionPhone,
      titularData,
      guarantorData,
      insuredPatientData,
      notes
    } = req.body;

    await admission.update({
      attendingDoctorId: attendingDoctorId !== undefined ? attendingDoctorId : admission.attendingDoctorId,
      admissionType: admissionType || admission.admissionType,
      paymentType: paymentType || admission.paymentType,
      hasInsurance: hasInsurance !== undefined ? hasInsurance : admission.hasInsurance,
      insuranceCompanyId: insuranceCompanyId !== undefined ? insuranceCompanyId : admission.insuranceCompanyId,
      insurancePolicyNumber: insurancePolicyNumber !== undefined ? insurancePolicyNumber : admission.insurancePolicyNumber,
      insurancePlan: insurancePlan !== undefined ? insurancePlan : admission.insurancePlan,
      insuranceHolderType: insuranceHolderType || admission.insuranceHolderType,
      insuranceCoverageAmountUSD: insuranceCoverageAmountUSD !== undefined ? insuranceCoverageAmountUSD : admission.insuranceCoverageAmountUSD,
      insuranceAuthorizationCode: insuranceAuthorizationCode !== undefined ? insuranceAuthorizationCode : admission.insuranceAuthorizationCode,
      insuranceClaimNumber: insuranceClaimNumber !== undefined ? insuranceClaimNumber : admission.insuranceClaimNumber,
      insuranceCartaAval: insuranceCartaAval !== undefined ? insuranceCartaAval : admission.insuranceCartaAval,
      initialDiagnosis: initialDiagnosis || admission.initialDiagnosis,
      companionName: companionName !== undefined ? companionName : admission.companionName,
      companionPhone: companionPhone !== undefined ? companionPhone : admission.companionPhone,
      titularData: titularData || admission.titularData,
      guarantorData: guarantorData || admission.guarantorData,
      insuredPatientData: insuredPatientData || admission.insuredPatientData,
      notes: notes !== undefined ? notes : admission.notes
    });

    const updated = await Admission.findByPk(id, {
      include: [
        { model: Patient, include: [{ model: User }] },
        { model: Doctor, include: [{ model: User }] },
        { model: InsuranceCompany }
      ]
    });

    res.json({ message: 'Admisión actualizada correctamente', admission: updated });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── ALTA MÉDICA Y ADMINISTRATIVA (CIERRE COMPLETO E INMUTABILIDAD) ──
exports.dischargeAdmission = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { dischargeDiagnosis, dischargeNotes, authorizedBy, performedBy } = req.body;

    const admission = await Admission.findByPk(id, { transaction: t });
    if (!admission) {
      await t.rollback();
      return res.status(404).json({ message: 'Episodio de admisión no encontrado' });
    }

    if (['DISCHARGED', 'CLOSED', 'CANCELLED'].includes(admission.status)) {
      await t.rollback();
      return res.status(400).json({ message: 'Esta admisión ya se encuentra dada de alta y cerrada.' });
    }

    // Liberar cualquier cama activa ocupada por esta admisión
    const activeStays = await HospitalStay.findAll({
      where: { admissionId: id, status: 'ACTIVE' },
      transaction: t
    });

    for (const stay of activeStays) {
      await stay.update({
        dischargeDate: new Date(),
        status: 'COMPLETED'
      }, { transaction: t });

      if (stay.bedId) {
        await HospitalBed.update({
          status: 'AVAILABLE',
          currentPatientId: null
        }, {
          where: { id: stay.bedId },
          transaction: t
        });
      }
    }

    // Registrar traza de alta y egreso
    const dischargeMovement = {
      id: require('uuid').v4(),
      fromArea: admission.currentArea || 'HOSPITALIZACIÓN',
      toArea: 'ALTA MÉDICA Y ADMINISTRATIVA (EGRESO)',
      timestamp: new Date().toISOString(),
      performedBy: performedBy || (req.user ? `${req.user.firstName} ${req.user.lastName}` : 'Personal Administrativo / Caja'),
      authorizedBy: authorizedBy || 'Médico Tratante / Dirección Médica',
      reason: 'Alta médica completa y finiquito administrativo',
      notes: dischargeNotes || 'Paciente dado de alta médica y finiquitado administrativamente.'
    };

    const updatedMovements = Array.isArray(admission.areaMovements)
      ? [...admission.areaMovements, dischargeMovement]
      : [dischargeMovement];

    await admission.update({
      status: 'DISCHARGED',
      dischargeDate: new Date(),
      dischargeDiagnosis: dischargeDiagnosis || admission.initialDiagnosis,
      currentArea: 'ALTA MÉDICA Y ADMINISTRATIVA (EGRESO)',
      areaMovements: updatedMovements,
      notes: admission.notes ? `${admission.notes}\n[ALTA]: ${dischargeNotes || 'Alta procesada'}` : dischargeNotes
    }, { transaction: t });

    await t.commit();

    const populated = await Admission.findByPk(id, {
      include: [
        { model: Patient, include: [{ model: User }] },
        { model: Doctor, include: [{ model: User }] },
        { model: InsuranceCompany },
        { model: HospitalStay, include: [{ model: HospitalBed }] }
      ]
    });

    res.json({
      message: '¡Alta médica y administrativa procesada exitosamente! Cama liberada y admisión cerrada de forma inmutable.',
      admission: populated
    });
  } catch (error) {
    await t.rollback();
    console.error('Error in dischargeAdmission:', error);
    res.status(500).json({ message: error.message });
  }
};

// ── RECORD PATIENT AREA MOVEMENT (TRAZABILIDAD Y AUDITORÍA) ────────
exports.recordAreaMovement = async (req, res) => {
  try {
    const { id } = req.params;
    const { toArea, performedBy, authorizedBy, reason, notes } = req.body;

    if (!toArea) {
      return res.status(400).json({ message: 'El área de destino es obligatoria' });
    }

    const admission = await Admission.findByPk(id);
    if (!admission) {
      return res.status(404).json({ message: 'Episodio de admisión no encontrado' });
    }

    if (['DISCHARGED', 'CLOSED', 'CANCELLED'].includes(admission.status)) {
      return res.status(400).json({
        message: 'Esta admisión se encuentra cerrada por completo y no se pueden registrar nuevos movimientos ni cambios de área.'
      });
    }

    const fromArea = admission.currentArea || 'ADMISIÓN';
    const movement = {
      id: require('uuid').v4(),
      fromArea,
      toArea,
      timestamp: new Date().toISOString(),
      performedBy: performedBy || (req.user ? `${req.user.firstName} ${req.user.lastName}` : 'Personal Hospitalario'),
      authorizedBy: authorizedBy || 'Médico Tratante / Supervisor de Guardia',
      reason: reason || 'Traslado clínico de paciente',
      notes: notes || ''
    };

    const updatedMovements = Array.isArray(admission.areaMovements) ? [...admission.areaMovements, movement] : [movement];

    await admission.update({
      currentArea: toArea,
      areaMovements: updatedMovements
    });

    res.json({
      message: `Traslado registrado exitosamente: de ${fromArea} a ${toArea}`,
      currentArea: toArea,
      movement,
      areaMovements: updatedMovements
    });
  } catch (error) {
    console.error('Error in recordAreaMovement:', error);
    res.status(500).json({ message: error.message });
  }
};

// ── TRIAJE DE EMERGENCIAS (RAC) ─────────────────
exports.getTriages = async (req, res) => {
  try {
    const { status, triageLevel } = req.query;
    const where = {};
    if (status) where.status = status;
    if (triageLevel) where.triageLevel = triageLevel;

    const orgId = getOrgId(req);
    const isSuperAdmin = isPlatformAdmin(req);
    if (!isSuperAdmin && orgId) {
      where.organizationId = orgId;
    }

    const triages = await EmergencyTriage.findAll({
      where,
      include: [
        { model: Patient, include: [{ model: User, attributes: ['firstName', 'lastName', 'email', 'phone'] }] },
        { model: Doctor, include: [{ model: User, attributes: ['firstName', 'lastName'] }] },
        { model: Admission }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json(triages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createTriage = async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const {
      patientId,
      admissionId,
      assignedDoctorId,
      triageLevel,
      chiefComplaint,
      systolicBP,
      diastolicBP,
      heartRate,
      respiratoryRate,
      temperature,
      oxygenSaturation,
      painScale,
      assignedBox
    } = req.body;

    if (!patientId || !chiefComplaint) {
      return res.status(400).json({ message: 'Paciente y motivo principal de consulta son obligatorios' });
    }

    const count = await EmergencyTriage.count({ where: orgId ? { organizationId: orgId } : {} });
    const triageNumber = `TRI-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;

    const triage = await EmergencyTriage.create({
      organizationId: orgId,
      triageNumber,
      patientId,
      admissionId: admissionId || null,
      assignedDoctorId: assignedDoctorId || null,
      triageLevel: triageLevel || 'LEVEL_3_YELLOW',
      chiefComplaint,
      systolicBP,
      diastolicBP,
      heartRate,
      respiratoryRate,
      temperature,
      oxygenSaturation,
      painScale: painScale || 0,
      assignedBox: assignedBox || 'Box de Triaje',
      status: 'TRIAGED'
    });

    const populated = await EmergencyTriage.findByPk(triage.id, {
      include: [
        { model: Patient, include: [{ model: User }] },
        { model: Doctor, include: [{ model: User }] }
      ]
    });

    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── CAMAS & HOSPITALIZACIÓN ─────────────────────
exports.getBeds = async (req, res) => {
  try {
    const { roomType, status, floor } = req.query;
    const where = {};
    if (roomType) where.roomType = roomType;
    if (status) where.status = status;
    if (floor) where.floor = floor;

    const orgId = getOrgId(req);
    const isSuperAdmin = isPlatformAdmin(req);
    if (!isSuperAdmin && orgId) {
      where.organizationId = orgId;
    }

    const beds = await HospitalBed.findAll({
      where,
      include: [
        {
          model: Patient,
          as: 'currentPatient',
          include: [{ model: User, attributes: ['firstName', 'lastName', 'email'] }]
        }
      ],
      order: [['roomNumber', 'ASC'], ['bedNumber', 'ASC']]
    });

    res.json(beds);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.assignBed = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const orgId = getOrgId(req);
    const { admissionId, patientId, bedId, attendingDoctorId, dailyRateUSD, dietType, isolationType } = req.body;

    if (!admissionId || !patientId || !bedId || !attendingDoctorId) {
      await t.rollback();
      return res.status(400).json({ message: 'Admisión, paciente, cama y médico tratante son requeridos' });
    }

    const bed = await HospitalBed.findByPk(bedId, { transaction: t });
    if (!bed) {
      await t.rollback();
      return res.status(404).json({ message: 'Cama no encontrada' });
    }

    if (bed.status === 'OCCUPIED') {
      await t.rollback();
      return res.status(400).json({ message: 'La cama seleccionada ya se encuentra ocupada' });
    }

    await bed.update({
      status: 'OCCUPIED',
      currentPatientId: patientId
    }, { transaction: t });

    const stay = await HospitalStay.create({
      organizationId: orgId,
      admissionId,
      patientId,
      bedId,
      attendingDoctorId,
      entryDate: new Date(),
      dailyRateUSD: dailyRateUSD || bed.dailyRateUSD,
      dietType: dietType || 'Completa / Normal',
      isolationType: isolationType || 'Ninguno',
      status: 'ACTIVE'
    }, { transaction: t });

    await t.commit();

    const populated = await HospitalStay.findByPk(stay.id, {
      include: [
        { model: HospitalBed },
        { model: Patient, include: [{ model: User }] },
        { model: Doctor, include: [{ model: User }] }
      ]
    });

    res.status(201).json(populated);
  } catch (error) {
    await t.rollback();
    res.status(500).json({ message: error.message });
  }
};

// ── CIRUGÍAS & QUIRÓFANOS ───────────────────────
exports.getSurgeries = async (req, res) => {
  try {
    const { status, operatingRoom } = req.query;
    const where = {};
    if (status) where.status = status;
    if (operatingRoom) where.operatingRoom = operatingRoom;

    const orgId = getOrgId(req);
    const isSuperAdmin = isPlatformAdmin(req);
    if (!isSuperAdmin && orgId) {
      where.organizationId = orgId;
    }

    const surgeries = await Surgery.findAll({
      where,
      include: [
        { model: Patient, include: [{ model: User, attributes: ['firstName', 'lastName', 'email', 'phone'] }] },
        { model: Specialty, attributes: ['id', 'name'] },
        { model: Doctor, as: 'leadSurgeon', include: [{ model: User, attributes: ['firstName', 'lastName'] }] },
        { model: Doctor, as: 'assistantSurgeon', include: [{ model: User, attributes: ['firstName', 'lastName'] }] },
        { model: Doctor, as: 'anesthesiologist', include: [{ model: User, attributes: ['firstName', 'lastName'] }] }
      ],
      order: [['scheduledStartTime', 'DESC']]
    });

    res.json(surgeries);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createSurgery = async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const {
      patientId,
      admissionId,
      procedureName,
      specialtyId,
      leadSurgeonId,
      assistantSurgeonId,
      anesthesiologistId,
      operatingRoom,
      scheduledStartTime,
      scheduledEndTime,
      anesthesiaType,
      preOperativeDiagnosis,
      totalCostUSD
    } = req.body;

    if (!patientId || !procedureName || !leadSurgeonId || !scheduledStartTime || !scheduledEndTime) {
      return res.status(400).json({ message: 'Paciente, procedimiento, cirujano y horarios son requeridos' });
    }

    const count = await Surgery.count({ where: orgId ? { organizationId: orgId } : {} });
    const surgeryNumber = `CIR-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;

    const surgery = await Surgery.create({
      organizationId: orgId,
      surgeryNumber,
      patientId,
      admissionId: admissionId || null,
      procedureName,
      specialtyId: specialtyId || null,
      leadSurgeonId,
      assistantSurgeonId: assistantSurgeonId || null,
      anesthesiologistId: anesthesiologistId || null,
      operatingRoom: operatingRoom || 'Quirófano 1',
      scheduledStartTime,
      scheduledEndTime,
      anesthesiaType: anesthesiaType || 'GENERAL',
      preOperativeDiagnosis: preOperativeDiagnosis || procedureName,
      totalCostUSD: totalCostUSD || 0.00,
      status: 'SCHEDULED'
    });

    const populated = await Surgery.findByPk(surgery.id, {
      include: [
        { model: Patient, include: [{ model: User }] },
        { model: Specialty },
        { model: Doctor, as: 'leadSurgeon', include: [{ model: User }] }
      ]
    });

    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
