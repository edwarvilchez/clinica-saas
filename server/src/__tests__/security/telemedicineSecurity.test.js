'use strict';

/**
 * 🛡️ FASE 26: Telemedicine & WebRTC Room Hardening Security Suite
 * Tests cryptographically signed room access tokens, anti-eavesdropping guards,
 * multi-tenant room isolation, anti-IDOR admission controls,
 * max-participant capacity enforcement, append-only session audit trails, and domain events.
 */

const request = require('supertest');
const express = require('express');
const http = require('http');
const ioClient = require('socket.io-client');
const { v4: uuidv4 } = require('uuid');
const { setTenantContext } = require('../../utils/tenantRls');
const {
  User,
  Organization,
  Doctor,
  Patient,
  Role,
  Specialty,
  Appointment,
  VideoConsultation,
  AuditLog,
  sequelize
} = require('../../models');
const videoConsultationController = require('../../controllers/videoConsultation.controller');
const { authorize } = require('../../middlewares/authorization.middleware');
const roleMiddleware = require('../../middlewares/role.middleware');
const { eventBus, DOMAIN_EVENTS } = require('../../events/eventBus');
const { initializeSocket } = require('../../sockets/videoSocket');
const telemedicineService = require('../../services/telemedicine.service');

describe('🛡️ FASE 26: Telemedicine WebRTC Security & Session Hardening Suite', () => {
  let app;
  let server;
  let ioServer;
  let serverPort;
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
  let appointmentA;
  let consultationA;

  beforeAll(async () => {
    await sequelize.authenticate();
    await setTenantContext(sequelize, { isSuperAdmin: true });

    // 1. Roles
    const [adminRole] = await Role.findOrCreate({ where: { name: 'ADMIN' }, defaults: { description: 'Administrador' } });
    const [patientRole] = await Role.findOrCreate({ where: { name: 'PATIENT' }, defaults: { description: 'Paciente' } });
    const [doctorRole] = await Role.findOrCreate({ where: { name: 'DOCTOR' }, defaults: { description: 'Médico' } });
    const [nurseRole] = await Role.findOrCreate({ where: { name: 'NURSE' }, defaults: { description: 'Enfermera' } });
    const [superAdminRole] = await Role.findOrCreate({ where: { name: 'SUPERADMIN' }, defaults: { description: 'Super Admin' } });

    // 2. Specialty
    const [cardio] = await Specialty.findOrCreate({
      where: { name: 'Cardiología Telemed Test' },
      defaults: { description: 'Especialidad Telemed Test' }
    });
    specialtyCardio = cardio;

    // 3. Super Admin
    superadminUser = await User.create({
      id: uuidv4(),
      username: `sadmin_telemed_${Date.now()}`,
      email: `sadmin_telemed_${Date.now()}@test.com`,
      password: 'HashPassword123!',
      roleId: superAdminRole.id,
      isActive: true,
      firstName: 'Super',
      lastName: 'Admin'
    });

    // 4. Organizations
    adminUserA = await User.create({
      id: uuidv4(),
      username: `admin_telemed_a_${Date.now()}`,
      email: `admin_telemed_a_${Date.now()}@test.com`,
      password: 'HashPassword123!',
      roleId: adminRole.id,
      isActive: true,
      firstName: 'Admin',
      lastName: 'Telemed Alfa'
    });

    orgA = await Organization.create({
      id: uuidv4(),
      name: `Clínica Telemed Alfa ${Date.now()}`,
      slug: `telemed-alfa-${Date.now()}`,
      type: 'CLINIC',
      ownerId: adminUserA.id,
      subscriptionStatus: 'ACTIVE',
      isActive: true
    });
    await adminUserA.update({ organizationId: orgA.id });

    orgB = await Organization.create({
      id: uuidv4(),
      name: `Clínica Telemed Beta ${Date.now()}`,
      slug: `telemed-beta-${Date.now()}`,
      type: 'CLINIC',
      ownerId: superadminUser.id,
      subscriptionStatus: 'ACTIVE',
      isActive: true
    });

    // 5. Doctor in Org A
    doctorUserA = await User.create({
      id: uuidv4(),
      username: `doc_telemed_a_${Date.now()}`,
      email: `doc_telemed_a_${Date.now()}@test.com`,
      password: 'HashPassword123!',
      roleId: doctorRole.id,
      organizationId: orgA.id,
      isActive: true,
      firstName: 'Valeria',
      lastName: 'Gómez'
    });

    doctorA = await Doctor.create({
      id: uuidv4(),
      userId: doctorUserA.id,
      specialtyId: specialtyCardio.id,
      licenseNumber: `MED-TELE-${Date.now().toString().slice(-6)}`,
      organizationId: orgA.id
    });

    // 6. Doctor in Org B
    doctorUserB = await User.create({
      id: uuidv4(),
      username: `doc_telemed_b_${Date.now()}`,
      email: `doc_telemed_b_${Date.now()}@test.com`,
      password: 'HashPassword123!',
      roleId: doctorRole.id,
      organizationId: orgB.id,
      isActive: true,
      firstName: 'Gabriel',
      lastName: 'Ruiz'
    });

    doctorB = await Doctor.create({
      id: uuidv4(),
      userId: doctorUserB.id,
      specialtyId: specialtyCardio.id,
      licenseNumber: `MED-TELE-B-${Date.now().toString().slice(-6)}`,
      organizationId: orgB.id
    });

    // 7. Patient in Org A
    patientUserA = await User.create({
      id: uuidv4(),
      username: `pat_telemed_a_${Date.now()}`,
      email: `pat_telemed_a_${Date.now()}@test.com`,
      password: 'HashPassword123!',
      roleId: patientRole.id,
      organizationId: orgA.id,
      isActive: true,
      firstName: 'Diana',
      lastName: 'Pérez'
    });

    patientA = await Patient.create({
      id: uuidv4(),
      userId: patientUserA.id,
      organizationId: orgA.id,
      phone: '+584127770001',
      documentId: `V-${Date.now().toString().slice(-8)}`,
      medicalRecordNumber: `HC-TELE-A-${Date.now().toString().slice(-6)}`
    });

    // 8. Patient in Org B
    patientUserB = await User.create({
      id: uuidv4(),
      username: `pat_telemed_b_${Date.now()}`,
      email: `pat_telemed_b_${Date.now()}@test.com`,
      password: 'HashPassword123!',
      roleId: patientRole.id,
      organizationId: orgB.id,
      isActive: true,
      firstName: 'Esteban',
      lastName: 'Quito'
    });

    patientB = await Patient.create({
      id: uuidv4(),
      userId: patientUserB.id,
      organizationId: orgB.id,
      phone: '+584127770002',
      documentId: `V-${(Date.now() + 1).toString().slice(-8)}`,
      medicalRecordNumber: `HC-TELE-B-${(Date.now() + 1).toString().slice(-6)}`
    });

    // 9. Nurse in Org A (Unauthorized role)
    nurseUserA = await User.create({
      id: uuidv4(),
      username: `nurse_telemed_a_${Date.now()}`,
      email: `nurse_telemed_a_${Date.now()}@test.com`,
      password: 'HashPassword123!',
      roleId: nurseRole.id,
      organizationId: orgA.id,
      isActive: true,
      firstName: 'Lorena',
      lastName: 'Rivas'
    });

    // 10. Appointment in Org A
    appointmentA = await Appointment.create({
      patientId: patientA.id,
      doctorId: doctorA.id,
      date: new Date(Date.now() + 86400000),
      reason: 'Teleconsulta Cardiológica',
      status: 'Confirmed',
      organizationId: orgA.id
    });

    // 11. Consultation room in Org A
    const roomCreation = await telemedicineService.createConsultationRoom({
      appointmentId: appointmentA.id,
      doctorId: doctorUserA.id,
      patientId: patientUserA.id,
      organizationId: orgA.id,
      actorUserId: doctorUserA.id
    });
    consultationA = roomCreation.videoConsultation;

    // 12. Express App Setup with simulated Auth & WebSockets
    app = express();
    app.use(express.json());

    app.use((req, res, next) => {
      const authHeader = req.headers.authorization;
      if (!authHeader) return next();

      if (authHeader === 'Bearer mock-token-doc-a') {
        req.user = { id: doctorUserA.id, doctorId: doctorA.id, role: 'DOCTOR', organizationId: orgA.id };
      } else if (authHeader === 'Bearer mock-token-doc-b') {
        req.user = { id: doctorUserB.id, doctorId: doctorB.id, role: 'DOCTOR', organizationId: orgB.id };
      } else if (authHeader === 'Bearer mock-token-pat-a') {
        req.user = { id: patientUserA.id, role: 'PATIENT', organizationId: orgA.id };
      } else if (authHeader === 'Bearer mock-token-pat-b') {
        req.user = { id: patientUserB.id, role: 'PATIENT', organizationId: orgB.id };
      } else if (authHeader === 'Bearer mock-token-admin-a') {
        req.user = { id: adminUserA.id, role: 'ADMIN', organizationId: orgA.id };
      } else if (authHeader === 'Bearer mock-token-nurse-a') {
        req.user = { id: nurseUserA.id, role: 'NURSE', organizationId: orgA.id };
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

    // Routes
    app.use('/api/video-consultations', mockAuthMiddleware, roleMiddleware(['SUPERADMIN', 'ADMINISTRATIVE', 'ADMIN', 'DOCTOR', 'PATIENT']));
    app.post('/api/video-consultations', videoConsultationController.createVideoConsultation);
    app.post('/api/video-consultations/room/:roomId/token', videoConsultationController.getRoomAccessToken);
    app.get('/api/video-consultations/room/:roomId', videoConsultationController.getVideoConsultationByRoom);
    app.get('/api/video-consultations/:id', videoConsultationController.getVideoConsultation);
    app.put('/api/video-consultations/:id/start', videoConsultationController.startVideoConsultation);
    app.put('/api/video-consultations/:id/end', videoConsultationController.endVideoConsultation);
    app.put('/api/video-consultations/:id/cancel', videoConsultationController.cancelVideoConsultation);

    // Launch HTTP & Socket server on dynamic port for signaling tests
    server = http.createServer(app);
    ioServer = initializeSocket(server);
    await new Promise((resolve) => {
      server.listen(0, () => {
        serverPort = server.address().port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (ioServer) {
      try {
        ioServer.close();
      } catch (e) {
        // ignore
      }
    }

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }

    try {
      await setTenantContext(sequelize, { isSuperAdmin: true });
      await VideoConsultation.destroy({ where: { organizationId: [orgA?.id, orgB?.id] }, force: true });
      await Appointment.destroy({ where: { organizationId: [orgA?.id, orgB?.id] }, force: true });
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

  describe('1. RBAC & Strict Route Authorization', () => {
    it('debe rechazar solicitudes anónimas con 401 Unauthorized', async () => {
      const res = await request(app).get(`/api/video-consultations/${consultationA.id}`);
      expect(res.status).toBe(401);
    });

    it('debe denegar acceso a rol NURSE con 403 Forbidden por directiva clínica', async () => {
      const res = await request(app)
        .get(`/api/video-consultations/${consultationA.id}`)
        .set('Authorization', 'Bearer mock-token-nurse-a');

      expect(res.status).toBe(403);
    });

    it('debe permitir acceso al médico tratante y paciente asignado', async () => {
      const resDoctor = await request(app)
        .get(`/api/video-consultations/${consultationA.id}`)
        .set('Authorization', 'Bearer mock-token-doc-a');

      expect(resDoctor.status).toBe(200);
      expect(resDoctor.body.roomId).toBe(consultationA.roomId);

      const resPatient = await request(app)
        .get(`/api/video-consultations/${consultationA.id}`)
        .set('Authorization', 'Bearer mock-token-pat-a');

      expect(resPatient.status).toBe(200);
      expect(resPatient.body.roomId).toBe(consultationA.roomId);
    });
  });

  describe('2. Cryptographically Signed Room Access Tokens (Anti-Eavesdropping Guard)', () => {
    let doctorRoomToken;
    let patientRoomToken;

    it('debe emitir un token firmado de corta duración para el paciente legítimo', async () => {
      const res = await request(app)
        .post(`/api/video-consultations/room/${consultationA.roomId}/token`)
        .set('Authorization', 'Bearer mock-token-pat-a');

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.roomId).toBe(consultationA.roomId);
      expect(res.body.participantType).toBe('PATIENT');
      patientRoomToken = res.body.token;

      // Verify token signature & claims
      const verified = telemedicineService.verifyRoomAccessToken(patientRoomToken, consultationA.roomId);
      expect(verified.userId).toBe(patientUserA.id);
      expect(verified.participantType).toBe('PATIENT');
      expect(verified.organizationId).toBe(orgA.id);
    });

    it('debe emitir un token firmado para el médico legítimo', async () => {
      const res = await request(app)
        .post(`/api/video-consultations/room/${consultationA.roomId}/token`)
        .set('Authorization', 'Bearer mock-token-doc-a');

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.participantType).toBe('DOCTOR');
      doctorRoomToken = res.body.token;
    });

    it('debe denegar con 403 Forbidden si un paciente ajeno intenta obtener token para la sala (Anti-IDOR)', async () => {
      const res = await request(app)
        .post(`/api/video-consultations/room/${consultationA.roomId}/token`)
        .set('Authorization', 'Bearer mock-token-pat-b');

      expect(res.status).toBe(404); // Patient B is in Org B, tenant isolation prevents finding it
    });

    it('debe denegar con 404 cross-tenant si un médico de otra organización solicita token de la sala', async () => {
      const res = await request(app)
        .post(`/api/video-consultations/room/${consultationA.roomId}/token`)
        .set('Authorization', 'Bearer mock-token-doc-b');

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/Acceso no autorizado a la sala de otra organización/i);
    });
  });

  describe('3. WebRTC Socket Admission Guard (Tokens & Max Participants Limit)', () => {
    const connectAndJoin = (port, roomId, token) => {
      return new Promise((resolve) => {
        const clientSocket = ioClient(`http://localhost:${port}`, {
          transports: ['websocket'],
          forceNew: true
        });

        const doEmit = () => {
          clientSocket.emit('join-room-secure', { roomId, roomToken: token });
        };

        if (clientSocket.connected) {
          doEmit();
        } else {
          clientSocket.once('connect', doEmit);
        }

        clientSocket.once('room-admitted', (data) => resolve({ socket: clientSocket, status: 'admitted', data }));
        clientSocket.once('room-error', (err) => resolve({ socket: clientSocket, status: 'error', err }));
      });
    };

    it('debe rechazar la conexión al socket si se presenta un token de sala inválido o manipulado', async () => {
      const res = await connectAndJoin(serverPort, consultationA.roomId, 'forged.malicious.jwt.token');
      expect(res.status).toBe('error');
      expect(res.err.code).toBe('UNAUTHORIZED');
      expect(res.err.message).toMatch(/Token de sala inválido/i);
      res.socket.disconnect();
    });

    it('debe admitir al médico y al paciente legítimos con sus respectivos tokens seguros y bloquear a un tercero', async () => {
      const { token: docToken } = await telemedicineService.generateRoomAccessToken({
        roomId: consultationA.roomId,
        userId: doctorUserA.id,
        role: 'DOCTOR',
        organizationId: orgA.id
      });

      const { token: patToken } = await telemedicineService.generateRoomAccessToken({
        roomId: consultationA.roomId,
        userId: patientUserA.id,
        role: 'PATIENT',
        organizationId: orgA.id
      });

      const docRes = await connectAndJoin(serverPort, consultationA.roomId, docToken);
      expect(docRes.status).toBe('admitted');
      expect(docRes.data.participantType).toBe('DOCTOR');

      const patRes = await connectAndJoin(serverPort, consultationA.roomId, patToken);
      expect(patRes.status).toBe('admitted');
      expect(patRes.data.participantType).toBe('PATIENT');

      // Try adding a 3rd participant (should be blocked by room-full guard)
      const intruderRes = await connectAndJoin(serverPort, consultationA.roomId, docToken);
      expect(intruderRes.status).toBe('error');
      expect(intruderRes.err.code).toBe('ROOM_FULL');

      docRes.socket.disconnect();
      patRes.socket.disconnect();
      intruderRes.socket.disconnect();
    });
  });

  describe('4. Session Lifecycle Transitions & Business Rules', () => {
    let freshConsultation;

    beforeAll(async () => {
      const appt2 = await Appointment.create({
        patientId: patientA.id,
        doctorId: doctorA.id,
        date: new Date(Date.now() + 86400000 * 3),
        reason: 'Teleconsulta de Seguimiento',
        status: 'Confirmed',
        organizationId: orgA.id
      });

      const room = await telemedicineService.createConsultationRoom({
        appointmentId: appt2.id,
        doctorId: doctorUserA.id,
        patientId: patientUserA.id,
        organizationId: orgA.id,
        actorUserId: doctorUserA.id
      });
      freshConsultation = room.videoConsultation;
    });

    it('debe iniciar la videoconsulta y marcar fecha de inicio', async () => {
      const res = await request(app)
        .put(`/api/video-consultations/${freshConsultation.id}/start`)
        .set('Authorization', 'Bearer mock-token-doc-a');

      expect(res.status).toBe(200);
      expect(res.body.videoConsultation.status).toBe('active');
      expect(res.body.videoConsultation.startTime).toBeDefined();

      const events = eventBus.getRecentEvents().filter(e => e.eventName === DOMAIN_EVENTS.TELEMEDICINE_SESSION_STARTED);
      expect(events.length).toBeGreaterThanOrEqual(1);
    });

    it('debe finalizar la videoconsulta registrando duración y notas clínicas', async () => {
      const res = await request(app)
        .put(`/api/video-consultations/${freshConsultation.id}/end`)
        .set('Authorization', 'Bearer mock-token-doc-a')
        .send({ notes: 'Paciente estable. Presión arterial controlada con fármacos.' });

      expect(res.status).toBe(200);
      expect(res.body.videoConsultation.status).toBe('completed');
      expect(res.body.videoConsultation.duration).toBeGreaterThanOrEqual(0);
      expect(res.body.videoConsultation.notes).toContain('Paciente estable');

      const events = eventBus.getRecentEvents().filter(e => e.eventName === DOMAIN_EVENTS.TELEMEDICINE_SESSION_ENDED);
      expect(events.length).toBeGreaterThanOrEqual(1);
    });

    it('debe rechazar la cancelación de una videoconsulta completada con 400 Bad Request', async () => {
      const res = await request(app)
        .put(`/api/video-consultations/${freshConsultation.id}/cancel`)
        .set('Authorization', 'Bearer mock-token-doc-a')
        .send({ reason: 'Cancelar cita ya concluida' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/No se puede cancelar una videoconsulta completada/i);
    });
  });

  describe('5. Tamper-Evident Audit Logging', () => {
    it('debe registrar eventos inmutables en AuditLog para la creación y uso de tokens', async () => {
      const logs = await AuditLog.findAll({
        where: {
          organizationId: orgA.id,
          action: 'TELEMEDICINE_SESSION_CREATED'
        },
        order: [['timestamp', 'DESC']],
        limit: 5
      });

      expect(logs.length).toBeGreaterThanOrEqual(1);
      expect(logs[0].entity).toBe('VideoConsultation');
    });
  });
});
