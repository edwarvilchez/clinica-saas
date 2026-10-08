'use strict';

/**
 * 🛡️ FASE 24: Clinical AI & CDSS Security & Decision Support Suite
 * Tests multi-tenant isolation, RBAC enforcement, strict "Doctor reviews & approves" paradigm,
 * non-autonomous diagnostics safeguards, mandatory CDSS legal disclaimers,
 * allergy conflict detection, append-only audit trail, and domain event bus integration.
 */

const request = require('supertest');
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { setTenantContext } = require('../../utils/tenantRls');
const {
  User,
  Organization,
  Patient,
  Doctor,
  Role,
  Specialty,
  MedicalRecord,
  Prescription,
  LabResult,
  ClinicalAiDraft,
  AuditLog,
  sequelize
} = require('../../models');
const clinicalAiController = require('../../controllers/clinicalAi.controller');
const { authorize } = require('../../middlewares/authorization.middleware');
const { eventBus, DOMAIN_EVENTS } = require('../../events/eventBus');

describe('🛡️ FASE 24: Clinical AI Decision Support & Safety Suite', () => {
  let app;
  let orgA;
  let orgB;
  let adminUserA;
  let doctorUserA;
  let doctorA;
  let doctorUserB;
  let doctorB;
  let patientUserA;
  let patientA;
  let patientUserB;
  let patientB;
  let nurseUserA;
  let superadminUser;
  let specialtyCardio;

  beforeAll(async () => {
    await sequelize.authenticate();
    await setTenantContext(sequelize, { isSuperAdmin: true });

    // Ensure table exists via sync
    await ClinicalAiDraft.sync();

    // 1. Roles
    const [adminRole] = await Role.findOrCreate({ where: { name: 'ADMIN' }, defaults: { description: 'Administrador' } });
    const [patientRole] = await Role.findOrCreate({ where: { name: 'PATIENT' }, defaults: { description: 'Paciente' } });
    const [doctorRole] = await Role.findOrCreate({ where: { name: 'DOCTOR' }, defaults: { description: 'Médico' } });
    const [nurseRole] = await Role.findOrCreate({ where: { name: 'NURSE' }, defaults: { description: 'Enfermera' } });
    const [superAdminRole] = await Role.findOrCreate({ where: { name: 'SUPERADMIN' }, defaults: { description: 'Super Admin' } });

    // 2. Specialty
    const [cardio] = await Specialty.findOrCreate({
      where: { name: 'Cardiología AI Test' },
      defaults: { description: 'Especialidad AI Test' }
    });
    specialtyCardio = cardio;

    // 3. Super Admin User for audit logging FK
    superadminUser = await User.create({
      id: uuidv4(),
      username: `sadmin_ai_${Date.now()}`,
      email: `sadmin_ai_${Date.now()}@test.com`,
      password: 'HashPassword123!',
      roleId: superAdminRole.id,
      isActive: true,
      firstName: 'Super',
      lastName: 'Admin'
    });

    // 4. Organizations
    adminUserA = await User.create({
      id: uuidv4(),
      username: `admin_ai_a_${Date.now()}`,
      email: `admin_ai_a_${Date.now()}@test.com`,
      password: 'HashPassword123!',
      roleId: adminRole.id,
      isActive: true,
      firstName: 'Admin',
      lastName: 'AI Alfa'
    });

    orgA = await Organization.create({
      id: uuidv4(),
      name: `Clínica AI Alfa ${Date.now()}`,
      slug: `ai-alfa-${Date.now()}`,
      type: 'CLINIC',
      ownerId: adminUserA.id,
      subscriptionStatus: 'ACTIVE',
      isActive: true
    });
    await adminUserA.update({ organizationId: orgA.id });

    orgB = await Organization.create({
      id: uuidv4(),
      name: `Clínica AI Beta ${Date.now()}`,
      slug: `ai-beta-${Date.now()}`,
      type: 'CLINIC',
      ownerId: superadminUser.id,
      subscriptionStatus: 'ACTIVE',
      isActive: true
    });

    // 5. Doctor in Org A
    doctorUserA = await User.create({
      id: uuidv4(),
      username: `doc_ai_a_${Date.now()}`,
      email: `doc_ai_a_${Date.now()}@test.com`,
      password: 'HashPassword123!',
      roleId: doctorRole.id,
      organizationId: orgA.id,
      isActive: true,
      firstName: 'Elena',
      lastName: 'Rostova'
    });

    doctorA = await Doctor.create({
      id: uuidv4(),
      userId: doctorUserA.id,
      specialtyId: specialtyCardio.id,
      licenseNumber: `MED-AI-${Date.now().toString().slice(-6)}`,
      organizationId: orgA.id
    });

    // 6. Doctor in Org B (Cross-tenant actor)
    doctorUserB = await User.create({
      id: uuidv4(),
      username: `doc_ai_b_${Date.now()}`,
      email: `doc_ai_b_${Date.now()}@test.com`,
      password: 'HashPassword123!',
      roleId: doctorRole.id,
      organizationId: orgB.id,
      isActive: true,
      firstName: 'Viktor',
      lastName: 'Frank'
    });

    doctorB = await Doctor.create({
      id: uuidv4(),
      userId: doctorUserB.id,
      specialtyId: specialtyCardio.id,
      licenseNumber: `MED-BETA-${Date.now().toString().slice(-6)}`,
      organizationId: orgB.id
    });

    // 7. Nurse in Org A (Unauthorized clinical AI role)
    nurseUserA = await User.create({
      id: uuidv4(),
      username: `nurse_ai_a_${Date.now()}`,
      email: `nurse_ai_a_${Date.now()}@test.com`,
      password: 'HashPassword123!',
      roleId: nurseRole.id,
      organizationId: orgA.id,
      isActive: true,
      firstName: 'Nuria',
      lastName: 'Suárez'
    });

    // 8. Patient in Org A (with Penicillin Allergy and Hypertension)
    patientUserA = await User.create({
      id: uuidv4(),
      username: `pat_ai_a_${Date.now()}`,
      email: `pat_ai_a_${Date.now()}@test.com`,
      password: 'HashPassword123!',
      roleId: patientRole.id,
      organizationId: orgA.id,
      isActive: true,
      firstName: 'Rodrigo',
      lastName: 'Díaz'
    });

    patientA = await Patient.create({
      id: uuidv4(),
      userId: patientUserA.id,
      organizationId: orgA.id,
      phone: '+584128880001',
      documentId: `V-${Date.now().toString().slice(-8)}`,
      medicalRecordNumber: `HC-AI-A-${Date.now().toString().slice(-6)}`,
      bloodType: 'A+',
      allergies: 'Penicilina, Betalactámicos',
      preexistingDiseases: ['Hipertensión arterial primaria', 'Gastritis erosiva'],
      hasInsurance: true,
      insuranceProvider: 'Seguros Caracas'
    });

    // 9. Patient in Org B
    patientUserB = await User.create({
      id: uuidv4(),
      username: `pat_ai_b_${Date.now()}`,
      email: `pat_ai_b_${Date.now()}@test.com`,
      password: 'HashPassword123!',
      roleId: patientRole.id,
      organizationId: orgB.id,
      isActive: true,
      firstName: 'Valeria',
      lastName: 'Méndez'
    });

    patientB = await Patient.create({
      id: uuidv4(),
      userId: patientUserB.id,
      organizationId: orgB.id,
      phone: '+584128880002',
      documentId: `V-${(Date.now() + 1).toString().slice(-8)}`,
      medicalRecordNumber: `HC-AI-B-${(Date.now() + 1).toString().slice(-6)}`,
      bloodType: 'O-'
    });

    // 10. Express App Setup with simulated Auth
    app = express();
    app.use(express.json());

    app.use((req, res, next) => {
      const authHeader = req.headers.authorization;
      if (!authHeader) return next();

      if (authHeader === 'Bearer mock-token-doc-a') {
        req.user = { id: doctorUserA.id, doctorId: doctorA.id, role: 'DOCTOR', organizationId: orgA.id };
      } else if (authHeader === 'Bearer mock-token-doc-b') {
        req.user = { id: doctorUserB.id, doctorId: doctorB.id, role: 'DOCTOR', organizationId: orgB.id };
      } else if (authHeader === 'Bearer mock-token-admin-a') {
        req.user = { id: adminUserA.id, role: 'ADMIN', organizationId: orgA.id };
      } else if (authHeader === 'Bearer mock-token-nurse-a') {
        req.user = { id: nurseUserA.id, role: 'NURSE', organizationId: orgA.id };
      } else if (authHeader === 'Bearer mock-token-pat-a') {
        req.user = { id: patientUserA.id, role: 'PATIENT', organizationId: orgA.id };
      } else if (authHeader === 'Bearer mock-token-superadmin') {
        req.user = { id: superadminUser.id, role: 'SUPERADMIN', organizationId: null };
      }
      next();
    });

    const mockAuthMiddleware = (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Acceso no autorizado' });
      }
      next();
    };

    app.post('/api/clinical-ai/patients/:patientId/brief', mockAuthMiddleware, authorize('clinical-ai:write'), clinicalAiController.generateBrief);
    app.post('/api/clinical-ai/patients/:patientId/cie11', mockAuthMiddleware, authorize('clinical-ai:write'), clinicalAiController.suggestCie11);
    app.post('/api/clinical-ai/patients/:patientId/soap', mockAuthMiddleware, authorize('clinical-ai:write'), clinicalAiController.generateSoap);
    app.post('/api/clinical-ai/patients/:patientId/prescription-safety', mockAuthMiddleware, authorize('clinical-ai:write'), clinicalAiController.checkPrescriptionSafety);
    app.post('/api/clinical-ai/drafts/:draftId/review', mockAuthMiddleware, authorize('clinical-ai:review'), clinicalAiController.reviewDraft);
    app.get('/api/clinical-ai/patients/:patientId/drafts', mockAuthMiddleware, authorize('clinical-ai:read'), clinicalAiController.getDraftsForPatient);
    app.get('/api/clinical-ai/drafts/:draftId', mockAuthMiddleware, authorize('clinical-ai:read'), clinicalAiController.getDraftById);
  });

  afterAll(async () => {
    try {
      await setTenantContext(sequelize, { isSuperAdmin: true });
      await ClinicalAiDraft.destroy({ where: { organizationId: [orgA?.id, orgB?.id] }, force: true });
      await Prescription.destroy({ where: { organizationId: [orgA?.id, orgB?.id] }, force: true });
      await MedicalRecord.destroy({ where: { organizationId: [orgA?.id, orgB?.id] }, force: true });
      await LabResult.destroy({ where: { organizationId: [orgA?.id, orgB?.id] }, force: true });
      await Patient.destroy({ where: { organizationId: [orgA?.id, orgB?.id] }, force: true });
      await Doctor.destroy({ where: { organizationId: [orgA?.id, orgB?.id] }, force: true });
      await Organization.destroy({ where: { id: [orgA?.id, orgB?.id] }, force: true });
      await User.destroy({
        where: {
          id: [
            adminUserA?.id,
            doctorUserA?.id,
            doctorUserB?.id,
            patientUserA?.id,
            patientUserB?.id,
            nurseUserA?.id,
            superadminUser?.id
          ].filter(Boolean)
        },
        force: true
      });
      if (specialtyCardio) await Specialty.destroy({ where: { id: specialtyCardio.id } });
    } catch (e) {
      // Ignore append-only audit trigger on cascade
    }
  });

  beforeEach(() => {
    eventBus.clearHistory();
  });

  describe('1. RBAC & Strict Healthcare Authorization', () => {
    it('debe rechazar llamadas anónimas con 401 Unauthorized', async () => {
      const res = await request(app).post(`/api/clinical-ai/patients/${patientA.id}/brief`);
      expect(res.status).toBe(401);
    });

    it('debe rechazar acceso de rol PATIENT con 403 Forbidden (no diagnósticos autónomos a pacientes)', async () => {
      const res = await request(app)
        .post(`/api/clinical-ai/patients/${patientA.id}/brief`)
        .set('Authorization', 'Bearer mock-token-pat-a');

      expect(res.status).toBe(403);
    });

    it('debe denegar acceso de rol NURSE con 403 Forbidden a toma de decisiones asistidas', async () => {
      const res = await request(app)
        .post(`/api/clinical-ai/patients/${patientA.id}/soap`)
        .set('Authorization', 'Bearer mock-token-nurse-a')
        .send({ symptomsText: 'Fiebre y dolor' });

      expect(res.status).toBe(403);
    });

    it('debe permitir acceso al médico tratante y administradores autorizados', async () => {
      const res = await request(app)
        .post(`/api/clinical-ai/patients/${patientA.id}/cie11`)
        .set('Authorization', 'Bearer mock-token-doc-a')
        .send({ symptomsText: 'Cefalea' });

      expect(res.status).toBe(201);
    });
  });

  describe('2. Pre-Consultation Clinical Brief & Safety Disclaimers', () => {
    it('debe sintetizar el expediente médico previo con advertencias de riesgo y aviso médico legal obligatorio', async () => {
      const res = await request(app)
        .post(`/api/clinical-ai/patients/${patientA.id}/brief`)
        .set('Authorization', 'Bearer mock-token-doc-a');

      expect(res.status).toBe(201);
      const draft = res.body.draft;
      expect(draft.type).toBe('PRE_CONSULTATION_BRIEF');
      expect(draft.status).toBe('PROPOSED');
      expect(draft.isAiGenerated).toBe(true);

      // Mandatory Medical Legal Disclaimer verification
      expect(draft.disclaimer).toMatch(/AVISO MÉDICO LEGAL OBLIGATORIO/i);
      expect(draft.disclaimer).toMatch(/Doctor reviews & approves/i);

      // Clinical risk flags verification
      const riskFlags = draft.aiOutput.riskFlags;
      expect(riskFlags.some(r => r.type === 'ALLERGIES' && r.description.includes('Penicilina'))).toBe(true);
      expect(riskFlags.some(r => r.type === 'COMORBIDITIES' && r.description.includes('Hipertensión'))).toBe(true);
    });

    it('debe rechazar con 404 cross-tenant si un médico de Org B intenta solicitar resumen de paciente en Org A', async () => {
      const res = await request(app)
        .post(`/api/clinical-ai/patients/${patientA.id}/brief`)
        .set('Authorization', 'Bearer mock-token-doc-b');

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/Paciente no encontrado en esta organización/i);
    });
  });

  describe('3. Differential Diagnoses & CIE-11 Non-Autonomous Hypotheses', () => {
    it('debe proponer hipótesis diagnósticas con fundamentación clínica y conducta complementaria requerida', async () => {
      const res = await request(app)
        .post(`/api/clinical-ai/patients/${patientA.id}/cie11`)
        .set('Authorization', 'Bearer mock-token-doc-a')
        .send({
          symptomsText: 'Paciente refiere cefalea intensa pulsátil de hemicráneo derecho, fotofobia marcada y náuseas.',
          physicalExamText: 'Sin signos meníngeos. Fondo de ojo normal.'
        });

      expect(res.status).toBe(201);
      const draft = res.body.draft;
      expect(draft.type).toBe('CIE11_DIFFERENTIAL');
      expect(draft.status).toBe('PROPOSED');

      const hypotheses = draft.aiOutput.hypotheses;
      expect(hypotheses.length).toBeGreaterThan(0);
      expect(hypotheses[0].code).toBe('8A80.0'); // Migraña sin aura
      expect(hypotheses[0].requiresDoctorEvaluation).toBe(true);
      expect(hypotheses[0].clinicalRationale).toBeDefined();
      expect(hypotheses[0].recommendedWorkup.length).toBeGreaterThan(0);
    });
  });

  describe('4. SOAP Clinical Note Generator', () => {
    let soapDraftId;

    it('debe generar borrador estructurado SOAP con signos vitales e impresión preliminar', async () => {
      const res = await request(app)
        .post(`/api/clinical-ai/patients/${patientA.id}/soap`)
        .set('Authorization', 'Bearer mock-token-doc-a')
        .send({
          symptomsText: 'Epigastralgia urente nocturna, pirosis y reflujo gastroesofágico postprandial.',
          vitalSigns: {
            bloodPressure: '130/85',
            heartRate: 78,
            temperature: '36.7',
            oxygenSaturation: 98
          },
          observations: 'Abdomen blando, doloroso a la palpación profunda en epigastrio sin defensa muscular.'
        });

      expect(res.status).toBe(201);
      const draft = res.body.draft;
      soapDraftId = draft.id;
      expect(draft.type).toBe('SOAP_NOTE');
      expect(draft.status).toBe('PROPOSED');

      const soap = draft.aiOutput.soap;
      expect(soap.subjective).toContain('Epigastralgia');
      expect(soap.objective).toContain('PA: 130/85 mmHg');
      expect(soap.assessment).toContain('Gastritis aguda');
      expect(soap.plan).toBeDefined();
    });
  });

  describe('5. Prescription Drug Safety, Allergy Cross-Reactivity & Interactions', () => {
    it('debe detectar colisiones críticas de alergias ante fármacos contraindicados', async () => {
      // Patient A has documented Penicillin allergy
      const res = await request(app)
        .post(`/api/clinical-ai/patients/${patientA.id}/prescription-safety`)
        .set('Authorization', 'Bearer mock-token-doc-a')
        .send({
          proposedDrugs: ['Amoxicilina 875mg', 'Ibuprofeno 400mg']
        });

      expect(res.status).toBe(201);
      const draft = res.body.draft;
      expect(draft.type).toBe('PRESCRIPTION_SAFETY_CHECK');
      expect(draft.aiOutput.hasCriticalConflicts).toBe(true);
      expect(draft.aiOutput.safetyStatus).toBe('CONTRAINDICATED');

      const alerts = draft.aiOutput.alerts;
      const penicillinAlert = alerts.find(a => a.drug.includes('Amoxicilina'));
      expect(penicillinAlert).toBeDefined();
      expect(penicillinAlert.severity).toBe('CRITICAL');
      expect(penicillinAlert.message).toMatch(/alergia a penicilinas/i);
    });

    it('debe reportar estado SAFE cuando la medicación no presenta contraindicaciones conocidas', async () => {
      const res = await request(app)
        .post(`/api/clinical-ai/patients/${patientA.id}/prescription-safety`)
        .set('Authorization', 'Bearer mock-token-doc-a')
        .send({
          proposedDrugs: ['Paracetamol 500mg']
        });

      expect(res.status).toBe(201);
      expect(res.body.draft.aiOutput.safetyStatus).toBe('SAFE');
      expect(res.body.draft.aiOutput.hasCriticalConflicts).toBe(false);
    });
  });

  describe('6. Paradigma "Doctor reviews & approves" - Formal Decision Lifecycle', () => {
    let testDraft;

    beforeEach(async () => {
      // Create a fresh proposed draft for testing review transitions
      testDraft = await ClinicalAiDraft.create({
        patientId: patientA.id,
        doctorId: doctorA.id,
        organizationId: orgA.id,
        type: 'SOAP_NOTE',
        status: 'PROPOSED',
        aiOutput: {
          soap: {
            subjective: 'Dolor precordial atípico',
            objective: 'PA: 120/80 mmHg',
            assessment: 'Descarte osteocondritis vs angina',
            plan: 'Reposo y analgésicos suaves'
          },
          suggestedCie11: {
            title: 'Osteocondritis costal'
          }
        }
      });
    });

    it('debe permitir al médico aprobar formalmente la sugerencia y generar la historia médica oficial', async () => {
      const res = await request(app)
        .post(`/api/clinical-ai/drafts/${testDraft.id}/review`)
        .set('Authorization', 'Bearer mock-token-doc-a')
        .send({
          action: 'APPROVE',
          doctorFeedback: 'Evaluación clínica coincidente. Se valida y firma.',
          createMedicalRecord: true
        });

      expect(res.status).toBe(200);
      expect(res.body.draft.status).toBe('DOCTOR_APPROVED');
      expect(res.body.draft.reviewedBy).toBe(doctorUserA.id);
      expect(res.body.createdMedicalRecord).toBeDefined();
      expect(res.body.createdMedicalRecord.patientId).toBe(patientA.id);
      expect(res.body.createdMedicalRecord.doctorId).toBe(doctorA.id);

      // Verify domain event
      const events = eventBus.getRecentEvents().filter(e => e.eventName === DOMAIN_EVENTS.AI_CLINICAL_DRAFT_APPROVED);
      expect(events.length).toBeGreaterThanOrEqual(1);
    });

    it('debe rechazar un segundo intento de revisión sobre un borrador ya procesado (inmutabilidad de ciclo de vida)', async () => {
      // First review
      await request(app)
        .post(`/api/clinical-ai/drafts/${testDraft.id}/review`)
        .set('Authorization', 'Bearer mock-token-doc-a')
        .send({ action: 'APPROVE' });

      // Second review attempt
      const res2 = await request(app)
        .post(`/api/clinical-ai/drafts/${testDraft.id}/review`)
        .set('Authorization', 'Bearer mock-token-doc-a')
        .send({ action: 'REJECT' });

      expect(res2.status).toBe(400);
      expect(res2.body.error).toMatch(/ya fue procesado previamente/i);
    });

    it('debe permitir al médico modificar y adaptar el borrador bajo su criterio profesional', async () => {
      const res = await request(app)
        .post(`/api/clinical-ai/drafts/${testDraft.id}/review`)
        .set('Authorization', 'Bearer mock-token-doc-a')
        .send({
          action: 'MODIFY',
          doctorFeedback: 'Ajuste de dosis y diagnóstico definitivo según ECG.',
          modifiedContent: {
            diagnosis: 'Espasmo esofágico difuso',
            treatment: 'Antiespasmódico oral cada 8h',
            indications: 'Evitar alimentos irritantes',
            physicalExam: 'Tórax normal'
          },
          createMedicalRecord: true
        });

      expect(res.status).toBe(200);
      expect(res.body.draft.status).toBe('DOCTOR_MODIFIED');
      expect(res.body.createdMedicalRecord.diagnosis).toBe('Espasmo esofágico difuso');
    });

    it('debe permitir al médico rechazar terminantemente la sugerencia de la IA sin crear historia médica', async () => {
      const res = await request(app)
        .post(`/api/clinical-ai/drafts/${testDraft.id}/review`)
        .set('Authorization', 'Bearer mock-token-doc-a')
        .send({
          action: 'REJECT',
          doctorFeedback: 'Descartado: el cuadro clínico no corresponde a la hipótesis computacional.'
        });

      expect(res.status).toBe(200);
      expect(res.body.draft.status).toBe('DOCTOR_REJECTED');
      expect(res.body.createdMedicalRecord).toBeNull();

      // Verify domain event
      const rejectEvents = eventBus.getRecentEvents().filter(e => e.eventName === DOMAIN_EVENTS.AI_CLINICAL_DRAFT_REJECTED);
      expect(rejectEvents.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('7. Multi-Tenant Isolation & Anti-IDOR en Borradores de IA', () => {
    let draftOrgA;

    beforeAll(async () => {
      draftOrgA = await ClinicalAiDraft.create({
        patientId: patientA.id,
        doctorId: doctorA.id,
        organizationId: orgA.id,
        type: 'CIE11_DIFFERENTIAL',
        status: 'PROPOSED'
      });
    });

    it('debe denegar con 404 a un médico de Org B que intente acceder a un borrador de IA de Org A', async () => {
      const res = await request(app)
        .get(`/api/clinical-ai/drafts/${draftOrgA.id}`)
        .set('Authorization', 'Bearer mock-token-doc-b');

      expect(res.status).toBe(404);
    });

    it('debe denegar con 404 a un médico de Org B que intente revisar o alterar un borrador de Org A', async () => {
      const res = await request(app)
        .post(`/api/clinical-ai/drafts/${draftOrgA.id}/review`)
        .set('Authorization', 'Bearer mock-token-doc-b')
        .send({ action: 'APPROVE' });

      expect(res.status).toBe(404);
    });
  });

  describe('8. Tamper-Evident Audit Logging', () => {
    it('debe registrar eventos inmutables en AuditLog para la generación y aprobación de borradores clínicos', async () => {
      const logs = await AuditLog.findAll({
        where: {
          organizationId: orgA.id,
          action: 'AI_CLINICAL_BRIEF_GENERATED'
        },
        order: [['timestamp', 'DESC']],
        limit: 5
      });

      expect(logs.length).toBeGreaterThanOrEqual(1);
      expect(logs[0].entity).toBe('ClinicalAiDraft');
    });
  });
});
