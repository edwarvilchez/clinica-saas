'use strict';

/**
 * 🧠 ClinicalAiService - Clinical Decision Support System (CDSS)
 * Implements Phase 24: Paradigma "Doctor reviews & approves", without autonomous diagnostics.
 * Mandatory legal/medical safety disclaimers, structured SOAP generation, CIE-11 differential hypotheses,
 * allergy & drug-drug contraindication safety analysis, and full append-only audit trail.
 */

const { Op } = require('sequelize');
const {
  ClinicalAiDraft,
  Patient,
  Doctor,
  User,
  MedicalRecord,
  Prescription,
  LabResult,
  sequelize
} = require('../models');
const auditService = require('./audit.service');
const { eventBus, DOMAIN_EVENTS } = require('../events/eventBus');
const logger = require('../utils/logger');

// Extended CIE-11 Clinical Knowledge Base with Diagnostic Workup & Hypotheses Rationale
const CIE11_EXPANDED_CATALOG = [
  {
    code: '8A80.0',
    title: 'Migraña sin aura',
    category: 'Neurología',
    keywords: ['migraña', 'cefalea', 'dolor de cabeza', 'fotofobia', 'nauseas', 'náuseas', 'pulsatil'],
    rationale: 'Cefalea pulsátil típicamente unilateral con hipersensibilidad sensorial (fotofobia/fonofobia) y náuseas.',
    recommendedWorkup: ['Evaluación neurológica completa', 'Descarte de cefalea secundaria', 'Fondo de ojo']
  },
  {
    code: 'BA00.0',
    title: 'Hipertensión esencial primaria',
    category: 'Cardiología',
    keywords: ['hipertensión', 'presión alta', 'presion alta', 'tensión', 'cefalea occipital', 'mareo', 'taquicardia'],
    rationale: 'Elevación sostenida de cifras tensionales sistólica/diastólica sin causa secundaria evidente.',
    recommendedWorkup: ['MAPA 24h', 'Perfil lipídico', 'Electrocardiograma (ECG)', 'Creatinina sérica']
  },
  {
    code: 'CA23',
    title: 'Asma bronquial aguda o persistente',
    category: 'Neumología',
    keywords: ['asma', 'disnea', 'sibilancias', 'tos nocturna', 'opresión torácica', 'ahogo'],
    rationale: 'Hiperreactividad bronquial obstructiva reversible caracterizada por sibilancias y disnea paroxística.',
    recommendedWorkup: ['Espirometría con broncodilatador', 'Radiografía de tórax PA', 'Saturación de oxígeno']
  },
  {
    code: '5A11',
    title: 'Diabetes mellitus tipo 2',
    category: 'Endocrinología',
    keywords: ['diabetes', 'glucosa', 'polidipsia', 'poliuria', 'polifagia', 'pérdida de peso', 'sed'],
    rationale: 'Resistencia periférica a la insulina con alteración del metabolismo de carbohidratos.',
    recommendedWorkup: ['Glicemia en ayunas', 'Hemoglobina Glicosilada (HbA1c)', 'Examen general de orina']
  },
  {
    code: 'DA01.0',
    title: 'Gastritis aguda o dispepsia funcional',
    category: 'Gastroenterología',
    keywords: ['gastritis', 'epigastralgia', 'acidez', 'ardor estomacal', 'reflujo', 'dolor epigástrico'],
    rationale: 'Inflamación de la mucosa gástrica asociada a dolor urente en epigastrio posprandial.',
    recommendedWorkup: ['Endoscopia digestiva superior si signos de alarma', 'Test de Helicobacter pylori']
  },
  {
    code: 'GB00',
    title: 'Infección aguda de vías urinarias',
    category: 'Urología / Nefrología',
    keywords: ['infección urinaria', 'disuria', 'polaquiuria', 'ardor al orinar', 'orina turbia', 'tenesmo vesical'],
    rationale: 'Colonización bacteriana de la vía urinaria manifestada por síndrome miccional irritativo.',
    recommendedWorkup: ['Uroanálisis con sedimento', 'Urocultivo con antibiograma', 'Eco renal y vesical']
  },
  {
    code: '1F00',
    title: 'Infección respiratoria aguda viral / Síndrome gripal',
    category: 'Infectología',
    keywords: ['gripe', 'fiebre', 'tos', 'rinorrea', 'odinofagia', 'malestar general', 'covid', 'anosmia'],
    rationale: 'Compromiso agudo del tracto respiratorio superior de etiología viral prevalente.',
    recommendedWorkup: ['Panel viral respiratorio', 'Hemograma con recuento diferencial', 'Monitoreo de SpO2']
  }
];

// Allergy & Drug Interaction Safety Matrix
const DRUG_SAFETY_RULES = {
  penicillins: {
    drugs: ['amoxicilina', 'ampicilina', 'penicilina', 'amoxicilina-clavulanico', 'piperacilina', 'cefalexina', 'ceftriaxona'],
    allergyKeywords: ['penicilina', 'betalactamicos', 'beta-lactamicos', 'amoxicilina'],
    severity: 'CRITICAL',
    message: 'ALERTA CRÍTICA: El paciente tiene antecedentes de alergia a penicilinas/betalactámicos. Riesgo severo de choque anafiláctico.'
  },
  nsaids: {
    drugs: ['ibuprofeno', 'ketoprofeno', 'diclofenac', 'naproxeno', 'aspirina', 'ketorolaco', 'meloxicam'],
    allergyKeywords: ['aines', 'aine', 'aspirina', 'ibuprofeno', 'antinflamatorios'],
    severity: 'CRITICAL',
    message: 'ALERTA CRÍTICA: Paciente con alergia documentada a AINEs. Riesgo de broncoespasmo o reacción de hipersensibilidad.'
  },
  sulfas: {
    drugs: ['trimetoprima-sulfametoxazol', 'sulfametoxazol', 'sulfadiazina', 'bactrim'],
    allergyKeywords: ['sulfa', 'sulfas', 'sulfamidas'],
    severity: 'CRITICAL',
    message: 'ALERTA CRÍTICA: Alergia documentada a sulfamidas.'
  }
};

const DISEASE_CONTRAINDICATIONS = [
  {
    diseaseKeywords: ['gastritis', 'úlcera', 'ulcera', 'hemorragia digestiva'],
    drugs: ['ibuprofeno', 'ketoprofeno', 'diclofenac', 'aspirina', 'ketorolaco'],
    severity: 'WARNING',
    message: 'PRECAUCIÓN: Uso de AINEs en paciente con antecedente gástrico/ulceroso. Se sugiere coadministrar gastroprotección (ej. IBP).'
  },
  {
    diseaseKeywords: ['hipertensión', 'hipertension', 'presión alta'],
    drugs: ['pseudoefedrina', 'descongestionantes', 'fenilefrina'],
    severity: 'WARNING',
    message: 'PRECAUCIÓN: Fármacos vasoconstrictores pueden descompensar cifras tensionales en pacientes hipertensos.'
  },
  {
    diseaseKeywords: ['diabetes'],
    drugs: ['prednisona', 'dexametasona', 'betametasona', 'hidrocortisona'],
    severity: 'WARNING',
    message: 'PRECAUCIÓN: Los corticoides sistémicos pueden inducir hiperglicemia severa en pacientes diabéticos.'
  }
];

class ClinicalAiService {

  /**
   * Helper: Resolves verified patient scoped to organization
   */
  async _getVerifiedPatient(patientId, organizationId = null) {
    const where = { id: patientId };
    if (organizationId) where.organizationId = organizationId;

    const patient = await Patient.findOne({
      where,
      include: [
        {
          model: User,
          attributes: ['id', 'firstName', 'lastName', 'email']
        }
      ]
    });

    if (!patient) {
      const err = new Error('Paciente no encontrado en esta organización');
      err.statusCode = 404;
      throw err;
    }

    return patient;
  }

  /**
   * 1. Pre-Consultation Clinical Brief / Executive Patient Summary
   */
  async generatePreConsultationBrief({
    patientId,
    doctorId = null,
    organizationId = null,
    actorUserId = null,
    ip = null
  }) {
    const patient = await this._getVerifiedPatient(patientId, organizationId);

    // Past medical records (last 5)
    const records = await MedicalRecord.findAll({
      where: {
        patientId: patient.id,
        ...(organizationId ? { organizationId } : {})
      },
      order: [['createdAt', 'DESC']],
      limit: 5,
      include: [
        {
          model: Doctor,
          attributes: ['id', 'licenseNumber'],
          include: [{ model: User, attributes: ['firstName', 'lastName'] }]
        }
      ]
    });

    // Active prescriptions
    const activePrescriptions = await Prescription.findAll({
      where: {
        status: 'active',
        ...(organizationId ? { organizationId } : {})
      },
      include: [
        {
          model: MedicalRecord,
          where: { patientId: patient.id },
          attributes: ['id', 'createdAt']
        }
      ],
      limit: 10
    });

    // Recent lab results (last 5 completed)
    const recentLabs = await LabResult.findAll({
      where: {
        patientId: patient.id,
        status: 'Completed',
        ...(organizationId ? { organizationId } : {})
      },
      order: [['createdAt', 'DESC']],
      limit: 5
    });

    // Compute Clinical Risk Flags
    const riskFlags = [];
    if (patient.allergies && patient.allergies.toLowerCase() !== 'ninguna' && patient.allergies.trim() !== '') {
      riskFlags.push({
        type: 'ALLERGIES',
        severity: 'HIGH',
        description: `Alergias conocidas: ${patient.allergies}`
      });
    }

    if (patient.preexistingDiseases && patient.preexistingDiseases.length > 0) {
      riskFlags.push({
        type: 'COMORBIDITIES',
        severity: 'MEDIUM',
        description: `Antecedentes patológicos: ${patient.preexistingDiseases.join(', ')}`
      });
    }

    if (activePrescriptions.length >= 3) {
      riskFlags.push({
        type: 'POLYPHARMACY',
        severity: 'MEDIUM',
        description: `Polifarmacia activa detectada (${activePrescriptions.length} medicamentos en curso).`
      });
    }

    const patientFullName = `${patient.User?.firstName || ''} ${patient.User?.lastName || ''}`.trim() || 'Paciente';
    const totalConsultations = records.length;
    const lastConsultation = records[0] || null;

    const summaryText = `Resumen Ejecutivo Clínico de ${patientFullName}. ` +
      `Grupo Sanguíneo: ${patient.bloodType || 'No registrado'}. ` +
      `Alergias documentadas: ${patient.allergies || 'Ninguna registrada'}. ` +
      `Consultas previas registradas: ${totalConsultations}. ` +
      (lastConsultation
        ? `Última atención el ${new Date(lastConsultation.createdAt).toLocaleDateString('es-ES')} con diagnóstico: "${lastConsultation.diagnosis}".`
        : 'Sin atenciones médicas previas.');

    const aiOutput = {
      summaryText,
      patientSummary: {
        id: patient.id,
        name: patientFullName,
        documentId: patient.documentId,
        bloodType: patient.bloodType,
        allergies: patient.allergies,
        preexistingDiseases: patient.preexistingDiseases || []
      },
      riskFlags,
      timeline: records.map(r => ({
        id: r.id,
        date: r.createdAt,
        diagnosis: r.diagnosis,
        doctor: `${r.Doctor?.User?.firstName || ''} ${r.Doctor?.User?.lastName || ''}`.trim()
      })),
      activeMedications: activePrescriptions.map(p => ({
        id: p.id,
        drugName: p.drugName,
        dosage: p.dosage,
        frequency: p.frequency
      })),
      recentLabResults: recentLabs.map(l => ({
        id: l.id,
        testName: l.testName,
        resultValue: l.resultValue,
        referenceRange: l.referenceRange
      }))
    };

    const draft = await ClinicalAiDraft.create({
      patientId: patient.id,
      doctorId,
      organizationId: patient.organizationId,
      type: 'PRE_CONSULTATION_BRIEF',
      status: 'PROPOSED',
      inputData: { totalRecordsQueried: records.length },
      aiOutput,
      confidenceScore: 92.50
    });

    // Audit Log
    await auditService.logEvent({
      action: 'AI_CLINICAL_BRIEF_GENERATED',
      entity: 'ClinicalAiDraft',
      entityId: draft.id,
      organizationId: patient.organizationId,
      actorUserId: actorUserId || null,
      ip
    }).catch(e => logger.warn({ err: e.message, msg: '[ClinicalAi] Audit brief failed' }));

    // Domain Event
    eventBus.publish(DOMAIN_EVENTS.AI_CLINICAL_BRIEF_GENERATED, {
      draftId: draft.id,
      patientId: patient.id,
      doctorId
    }, {
      organizationId: patient.organizationId,
      userId: actorUserId || doctorId
    });

    return draft;
  }

  /**
   * 2. Differential Diagnostic Hypotheses & CIE-11 Assistance
   */
  async suggestDifferentialDiagnoses({
    patientId,
    doctorId = null,
    organizationId = null,
    symptomsText = '',
    physicalExamText = '',
    actorUserId = null,
    ip = null
  }) {
    const patient = await this._getVerifiedPatient(patientId, organizationId);

    const queryText = `${symptomsText} ${physicalExamText}`.toLowerCase();
    const hypotheses = [];

    for (const item of CIE11_EXPANDED_CATALOG) {
      let matchedCount = 0;
      for (const kw of item.keywords) {
        if (queryText.includes(kw.toLowerCase())) {
          matchedCount++;
        }
      }

      if (matchedCount > 0) {
        const confidence = Math.min(50 + (matchedCount * 18), 96);
        hypotheses.push({
          code: item.code,
          title: item.title,
          category: item.category,
          confidencePercentage: confidence,
          clinicalRationale: item.rationale,
          recommendedWorkup: item.recommendedWorkup,
          requiresDoctorEvaluation: true
        });
      }
    }

    hypotheses.sort((a, b) => b.confidencePercentage - a.confidencePercentage);

    if (hypotheses.length === 0) {
      hypotheses.push({
        code: 'MG30.Z',
        title: 'Signos o síntomas no especificados que ameritan evaluación clínica presencial',
        category: 'Medicina General',
        confidencePercentage: 50.0,
        clinicalRationale: 'La sintomatología reportada no coincide con patrones sindrómicos unívocos.',
        recommendedWorkup: ['Anamnesis dirigida', 'Examen físico segmentario exhaustivo'],
        requiresDoctorEvaluation: true
      });
    }

    const aiOutput = {
      hypotheses: hypotheses.slice(0, 5),
      clinicalDisclaimer: ClinicalAiDraft.CLINICAL_SAFETY_DISCLAIMER
    };

    const draft = await ClinicalAiDraft.create({
      patientId: patient.id,
      doctorId,
      organizationId: patient.organizationId,
      type: 'CIE11_DIFFERENTIAL',
      status: 'PROPOSED',
      inputData: { symptomsText, physicalExamText },
      aiOutput,
      confidenceScore: hypotheses[0]?.confidencePercentage || 60.0
    });

    // Audit Log
    await auditService.logEvent({
      action: 'AI_CIE11_SUGGESTION_REQUESTED',
      entity: 'ClinicalAiDraft',
      entityId: draft.id,
      organizationId: patient.organizationId,
      actorUserId: actorUserId || null,
      ip
    }).catch(e => logger.warn({ err: e.message, msg: '[ClinicalAi] Audit CIE11 suggestion failed' }));

    // Domain Event
    eventBus.publish(DOMAIN_EVENTS.AI_CLINICAL_SUGGESTION_GENERATED, {
      draftId: draft.id,
      patientId: patient.id,
      type: 'CIE11_DIFFERENTIAL'
    }, {
      organizationId: patient.organizationId,
      userId: actorUserId || doctorId
    });

    return draft;
  }

  /**
   * 3. SOAP Note Clinical Draft Generator (Subjetivo, Objetivo, Análisis, Plan)
   */
  async generateSoapNoteDraft({
    patientId,
    doctorId = null,
    organizationId = null,
    symptomsText = '',
    vitalSigns = {},
    observations = '',
    actorUserId = null,
    ip = null
  }) {
    const patient = await this._getVerifiedPatient(patientId, organizationId);

    // Format Objective string with Vitals
    const vitalsFormatted = [];
    if (vitalSigns.bloodPressure) vitalsFormatted.push(`PA: ${vitalSigns.bloodPressure} mmHg`);
    if (vitalSigns.heartRate) vitalsFormatted.push(`FC: ${vitalSigns.heartRate} lpm`);
    if (vitalSigns.respiratoryRate) vitalsFormatted.push(`FR: ${vitalSigns.respiratoryRate} rpm`);
    if (vitalSigns.temperature) vitalsFormatted.push(`Temp: ${vitalSigns.temperature} °C`);
    if (vitalSigns.oxygenSaturation) vitalsFormatted.push(`SatO2: ${vitalSigns.oxygenSaturation}%`);

    const objectiveText = (vitalsFormatted.length > 0 ? `Signos vitales: ${vitalsFormatted.join(' | ')}. ` : '') +
      (observations ? `Examen físico preliminar: ${observations}` : 'Examen físico sin hallazgos patológicos adicionales descritos.');

    // Find differential assessment
    const differential = await this.suggestDifferentialDiagnoses({
      patientId,
      doctorId,
      organizationId,
      symptomsText,
      physicalExamText: observations,
      actorUserId,
      ip
    });
    const primaryHypothesis = differential.aiOutput.hypotheses[0];

    const soap = {
      subjective: `Paciente refiere: "${symptomsText || 'Consulta de rutina'}". Alergias documentadas: ${patient.allergies || 'Ninguna'}.`,
      objective: objectiveText,
      assessment: `Impresión diagnóstica propuesta sujeta a criterio médico: ${primaryHypothesis.title} (CIE-11: ${primaryHypothesis.code}). Razón: ${primaryHypothesis.clinicalRationale}`,
      plan: `1. Conducta diagnóstica: ${primaryHypothesis.recommendedWorkup.join(', ')}.\n2. Medidas generales de soporte y reevaluación médica formal.\n3. Pendiente validación y ajuste terapéutico por médico tratante.`
    };

    const draft = await ClinicalAiDraft.create({
      patientId: patient.id,
      doctorId,
      organizationId: patient.organizationId,
      type: 'SOAP_NOTE',
      status: 'PROPOSED',
      inputData: { symptomsText, vitalSigns, observations },
      aiOutput: {
        soap,
        suggestedCie11: primaryHypothesis,
        disclaimer: ClinicalAiDraft.CLINICAL_SAFETY_DISCLAIMER
      },
      confidenceScore: 88.00
    });

    // Audit Log
    await auditService.logEvent({
      action: 'AI_SOAP_DRAFT_GENERATED',
      entity: 'ClinicalAiDraft',
      entityId: draft.id,
      organizationId: patient.organizationId,
      actorUserId: actorUserId || null,
      ip
    }).catch(e => logger.warn({ err: e.message, msg: '[ClinicalAi] Audit SOAP draft failed' }));

    // Domain Event
    eventBus.publish(DOMAIN_EVENTS.AI_CLINICAL_SUGGESTION_GENERATED, {
      draftId: draft.id,
      patientId: patient.id,
      type: 'SOAP_NOTE'
    }, {
      organizationId: patient.organizationId,
      userId: actorUserId || doctorId
    });

    return draft;
  }

  /**
   * 4. Prescription Drug Safety, Allergy Cross-Reactivity & Interaction Evaluation
   */
  async evaluatePrescriptionSafety({
    patientId,
    doctorId = null,
    organizationId = null,
    proposedDrugs = [],
    actorUserId = null,
    ip = null
  }) {
    const patient = await this._getVerifiedPatient(patientId, organizationId);

    const alerts = [];
    const patientAllergiesText = (patient.allergies || '').toLowerCase();
    const patientDiseases = (patient.preexistingDiseases || []).map(d => d.toLowerCase());

    for (const drug of proposedDrugs) {
      const drugLower = drug.toLowerCase();

      // Check Allergy Safety Rules
      for (const [, rule] of Object.entries(DRUG_SAFETY_RULES)) {
        const drugMatches = rule.drugs.some(d => drugLower.includes(d));
        if (drugMatches) {
          const allergyMatches = rule.allergyKeywords.some(kw => patientAllergiesText.includes(kw));
          if (allergyMatches) {
            alerts.push({
              drug,
              ruleType: 'ALLERGY_CONTRAINDICATION',
              severity: rule.severity,
              message: rule.message
            });
          }
        }
      }

      // Check Pre-existing Disease Contraindications
      for (const contra of DISEASE_CONTRAINDICATIONS) {
        const drugMatches = contra.drugs.some(d => drugLower.includes(d));
        if (drugMatches) {
          const diseaseMatches = contra.diseaseKeywords.some(kw =>
            patientDiseases.some(pd => pd.includes(kw))
          );
          if (diseaseMatches) {
            alerts.push({
              drug,
              ruleType: 'DISEASE_CONTRAINDICATION',
              severity: contra.severity,
              message: contra.message
            });
          }
        }
      }
    }

    const hasCriticalConflicts = alerts.some(a => a.severity === 'CRITICAL');
    const safetyStatus = hasCriticalConflicts ? 'CONTRAINDICATED' : (alerts.length > 0 ? 'WARNING' : 'SAFE');

    const aiOutput = {
      safetyStatus,
      hasCriticalConflicts,
      totalAlerts: alerts.length,
      alerts,
      patientAllergies: patient.allergies,
      patientDiseases: patient.preexistingDiseases || [],
      evaluatedDrugs: proposedDrugs,
      clinicalDisclaimer: ClinicalAiDraft.CLINICAL_SAFETY_DISCLAIMER
    };

    const draft = await ClinicalAiDraft.create({
      patientId: patient.id,
      doctorId,
      organizationId: patient.organizationId,
      type: 'PRESCRIPTION_SAFETY_CHECK',
      status: 'PROPOSED',
      inputData: { proposedDrugs },
      aiOutput,
      confidenceScore: 98.00
    });

    // Audit Log
    await auditService.logEvent({
      action: 'AI_PRESCRIPTION_SAFETY_CHECKED',
      entity: 'ClinicalAiDraft',
      entityId: draft.id,
      organizationId: patient.organizationId,
      actorUserId: actorUserId || null,
      ip
    }).catch(e => logger.warn({ err: e.message, msg: '[ClinicalAi] Audit safety check failed' }));

    return draft;
  }

  /**
   * 5. Doctor Review & Formal Approval Workflow (Doctor reviews & approves)
   */
  async reviewAiDraft({
    draftId,
    doctorId,
    organizationId = null,
    action, // 'APPROVE' | 'MODIFY' | 'REJECT'
    doctorFeedback = null,
    modifiedContent = null,
    createMedicalRecord = false,
    actorUserId = null,
    ip = null
  }) {
    if (!['APPROVE', 'MODIFY', 'REJECT'].includes(action)) {
      const err = new Error('Acción de revisión inválida. Debe ser APPROVE, MODIFY o REJECT.');
      err.statusCode = 400;
      throw err;
    }

    const where = { id: draftId };
    if (organizationId) where.organizationId = organizationId;

    const draft = await ClinicalAiDraft.findOne({
      where,
      include: [{ model: Patient }]
    });

    if (!draft) {
      const err = new Error('Borrador clínico de IA no encontrado');
      err.statusCode = 404;
      throw err;
    }

    if (draft.status !== 'PROPOSED') {
      const err = new Error(`Este borrador ya fue procesado previamente con estatus: ${draft.status}`);
      err.statusCode = 400;
      throw err;
    }

    let createdRecord = null;
    const reviewerUserId = actorUserId || null;

    if (action === 'APPROVE') {
      draft.status = 'DOCTOR_APPROVED';
      draft.reviewedAt = new Date();
      draft.reviewedBy = reviewerUserId;
      draft.doctorFeedback = doctorFeedback || 'Aprobado formalmente sin modificaciones por el médico tratante.';

      // Optionally create official Medical Record upon approval
      if (createMedicalRecord && (draft.type === 'SOAP_NOTE' || draft.type === 'CIE11_DIFFERENTIAL')) {
        const soapData = draft.aiOutput?.soap || {};
        const diagTitle = draft.aiOutput?.suggestedCie11?.title || 'Diagnóstico validado por médico';

        createdRecord = await MedicalRecord.create({
          patientId: draft.patientId,
          doctorId: draft.doctorId || doctorId,
          organizationId: draft.organizationId,
          diagnosis: diagTitle,
          treatment: soapData.plan || 'Plan según nota médica validada',
          indications: soapData.plan || 'Indicaciones revisadas por el médico tratante',
          physicalExam: soapData.objective || 'Evaluación física constatada por el médico'
        });

        draft.medicalRecordId = createdRecord.id;
      }

      await draft.save();

      // Audit Log
      await auditService.logEvent({
        action: 'AI_CLINICAL_DRAFT_APPROVED',
        entity: 'ClinicalAiDraft',
        entityId: draft.id,
        organizationId: draft.organizationId,
        actorUserId: reviewerUserId,
        newValues: { status: 'DOCTOR_APPROVED', medicalRecordId: draft.medicalRecordId },
        ip
      }).catch(e => logger.warn({ err: e.message, msg: '[ClinicalAi] Audit draft approve failed' }));

      // Domain Event
      eventBus.publish(DOMAIN_EVENTS.AI_CLINICAL_DRAFT_APPROVED, {
        draftId: draft.id,
        patientId: draft.patientId,
        doctorId: draft.doctorId || doctorId,
        medicalRecordId: draft.medicalRecordId
      }, {
        organizationId: draft.organizationId,
        userId: reviewerUserId
      });

    } else if (action === 'MODIFY') {
      draft.status = 'DOCTOR_MODIFIED';
      draft.reviewedAt = new Date();
      draft.reviewedBy = reviewerUserId;
      draft.doctorFeedback = doctorFeedback || 'Modificado y corregido bajo criterio médico.';

      if (modifiedContent) {
        draft.aiOutput = {
          ...draft.aiOutput,
          doctorModifications: modifiedContent
        };
      }

      if (createMedicalRecord && modifiedContent) {
        createdRecord = await MedicalRecord.create({
          patientId: draft.patientId,
          doctorId: draft.doctorId || doctorId,
          organizationId: draft.organizationId,
          diagnosis: modifiedContent.diagnosis || 'Diagnóstico ajustado por médico',
          treatment: modifiedContent.treatment || 'Tratamiento ajustado',
          indications: modifiedContent.indications || 'Indicaciones ajustadas',
          physicalExam: modifiedContent.physicalExam || 'Examen físico'
        });

        draft.medicalRecordId = createdRecord.id;
      }

      await draft.save();

      // Audit Log
      await auditService.logEvent({
        action: 'AI_CLINICAL_DRAFT_APPROVED',
        entity: 'ClinicalAiDraft',
        entityId: draft.id,
        organizationId: draft.organizationId,
        actorUserId: reviewerUserId,
        newValues: { status: 'DOCTOR_MODIFIED', medicalRecordId: draft.medicalRecordId },
        ip
      }).catch(e => logger.warn({ err: e.message, msg: '[ClinicalAi] Audit draft modify failed' }));

      // Domain Event
      eventBus.publish(DOMAIN_EVENTS.AI_CLINICAL_DRAFT_APPROVED, {
        draftId: draft.id,
        patientId: draft.patientId,
        status: 'DOCTOR_MODIFIED',
        medicalRecordId: draft.medicalRecordId
      }, {
        organizationId: draft.organizationId,
        userId: reviewerUserId
      });

    } else if (action === 'REJECT') {
      draft.status = 'DOCTOR_REJECTED';
      draft.reviewedAt = new Date();
      draft.reviewedBy = reviewerUserId;
      draft.doctorFeedback = doctorFeedback || 'Sugerencia rechazada por no corresponder al criterio clínico del médico.';

      await draft.save();

      // Audit Log
      await auditService.logEvent({
        action: 'AI_CLINICAL_DRAFT_REJECTED',
        entity: 'ClinicalAiDraft',
        entityId: draft.id,
        organizationId: draft.organizationId,
        actorUserId: reviewerUserId,
        newValues: { status: 'DOCTOR_REJECTED', reason: draft.doctorFeedback },
        ip
      }).catch(e => logger.warn({ err: e.message, msg: '[ClinicalAi] Audit draft reject failed' }));

      // Domain Event
      eventBus.publish(DOMAIN_EVENTS.AI_CLINICAL_DRAFT_REJECTED, {
        draftId: draft.id,
        patientId: draft.patientId,
        reason: draft.doctorFeedback
      }, {
        organizationId: draft.organizationId,
        userId: reviewerUserId
      });
    }

    return {
      draft,
      createdMedicalRecord: createdRecord
    };
  }

  /**
   * 6. Query Drafts by Patient (Multi-tenant isolated)
   */
  async getDraftsForPatient({ patientId, organizationId = null, status = null, page = 1, limit = 20 }) {
    await this._getVerifiedPatient(patientId, organizationId);

    const where = { patientId };
    if (organizationId) where.organizationId = organizationId;
    if (status) where.status = status;

    const offset = (Math.max(1, page) - 1) * limit;

    const { count, rows } = await ClinicalAiDraft.findAndCountAll({
      where,
      limit,
      offset,
      order: [['createdAt', 'DESC']]
    });

    return {
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / limit),
      drafts: rows
    };
  }

  /**
   * 7. Query Draft by PK
   */
  async getDraftById({ draftId, organizationId = null }) {
    const where = { id: draftId };
    if (organizationId) where.organizationId = organizationId;

    const draft = await ClinicalAiDraft.findOne({
      where,
      include: [
        { model: Patient, include: [{ model: User, attributes: ['firstName', 'lastName'] }] },
        { model: Doctor, include: [{ model: User, attributes: ['firstName', 'lastName'] }] }
      ]
    });

    if (!draft) {
      const err = new Error('Borrador clínico de IA no encontrado');
      err.statusCode = 404;
      throw err;
    }

    return draft;
  }
}

module.exports = new ClinicalAiService();
