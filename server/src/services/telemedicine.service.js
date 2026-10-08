'use strict';

/**
 * 📹 TelemedicineService - WebRTC Video Consultation Hardening & Security
 * Implements Phase 26: Cryptographically signed Room Access Tokens, Anti-IDOR protection,
 * multi-tenant room isolation, session lifecycle audit trail, and domain event bus integration.
 */

const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { VideoConsultation, Appointment, User, Doctor, Patient, sequelize } = require('../models');
const auditService = require('./audit.service');
const { eventBus, DOMAIN_EVENTS } = require('../events/eventBus');
const logger = require('../utils/logger');

const TOKEN_EXPIRY = '60m';

class TelemedicineService {
  /**
   * Helper: Get secret key for WebRTC tokens
   */
  _getSecret() {
    return process.env.JWT_SECRET || 'clinica_saas_telemed_fallback_secret_32_chars';
  }

  /**
   * 1. Create a secure video consultation room linked to an appointment
   */
  async createConsultationRoom({
    appointmentId,
    doctorId = null,
    patientId = null,
    organizationId = null,
    actorUserId = null,
    ip = null
  }) {
    if (!appointmentId) {
      const err = new Error('appointmentId es requerido para crear una videoconsulta');
      err.statusCode = 400;
      throw err;
    }

    const appointment = await Appointment.findByPk(appointmentId, {
      include: [
        { model: Patient, include: [{ model: User, attributes: ['id', 'organizationId'] }] },
        { model: Doctor, include: [{ model: User, attributes: ['id', 'organizationId'] }] }
      ]
    });

    if (!appointment) {
      const err = new Error('Cita médica no encontrada');
      err.statusCode = 404;
      throw err;
    }

    // Verify tenant isolation
    if (organizationId && appointment.organizationId && appointment.organizationId !== organizationId) {
      const err = new Error('No tienes acceso a esta cita');
      err.statusCode = 403;
      throw err;
    }

    const effectiveOrgId = organizationId || appointment.organizationId;
    const resolvedDoctorUserId = doctorId || appointment.Doctor?.User?.id;
    const resolvedPatientUserId = patientId || appointment.Patient?.User?.id;

    if (!resolvedDoctorUserId || !resolvedPatientUserId) {
      const err = new Error('La cita no tiene asociados correctamente al paciente o doctor');
      err.statusCode = 400;
      throw err;
    }

    // Check if consultation room already exists
    const existing = await VideoConsultation.findOne({
      where: { appointmentId: appointmentId.toString() }
    });

    if (existing) {
      return {
        created: false,
        videoConsultation: existing
      };
    }

    const roomId = uuidv4();
    const videoConsultation = await VideoConsultation.create({
      appointmentId,
      doctorId: resolvedDoctorUserId,
      patientId: resolvedPatientUserId,
      roomId,
      status: 'scheduled',
      organizationId: effectiveOrgId
    });

    // Audit Log
    await auditService.logEvent({
      action: 'TELEMEDICINE_SESSION_CREATED',
      entity: 'VideoConsultation',
      entityId: videoConsultation.id.toString(),
      organizationId: effectiveOrgId,
      actorUserId,
      newValues: { roomId, appointmentId, status: 'scheduled' },
      ip
    }).catch(e => logger.warn({ err: e.message, msg: '[TelemedicineService] Audit create failed' }));

    // Domain Event
    eventBus.publish(DOMAIN_EVENTS.TELEMEDICINE_SESSION_CREATED, {
      consultationId: videoConsultation.id,
      roomId,
      appointmentId,
      doctorId: resolvedDoctorUserId,
      patientId: resolvedPatientUserId
    }, {
      organizationId: effectiveOrgId,
      userId: actorUserId
    });

    return {
      created: true,
      videoConsultation
    };
  }

  /**
   * 2. Issue a cryptographically signed, short-lived Room Access Token (Anti-Eavesdropping Guard)
   */
  async generateRoomAccessToken({
    roomId,
    userId,
    role,
    organizationId = null,
    actorUserId = null,
    ip = null
  }) {
    if (!roomId) {
      const err = new Error('roomId es requerido para generar token de acceso');
      err.statusCode = 400;
      throw err;
    }

    const consultation = await VideoConsultation.findOne({
      where: { roomId }
    });

    if (!consultation) {
      const err = new Error('Sala de videoconsulta no encontrada');
      err.statusCode = 404;
      throw err;
    }

    // Verify tenant isolation
    if (organizationId && consultation.organizationId && consultation.organizationId !== organizationId) {
      const err = new Error('Acceso no autorizado a la sala de otra organización');
      err.statusCode = 404;
      throw err;
    }

    // Verify participant authorization (Anti-IDOR)
    const isDoctor = consultation.doctorId === userId;
    const isPatient = consultation.patientId === userId;
    const isStaff = ['SUPERADMIN', 'ADMIN', 'PLATFORM_ADMIN', 'ADMINISTRATIVE'].includes(role);

    if (!isDoctor && !isPatient && !isStaff) {
      // Record unauthorized attempt
      await auditService.logEvent({
        action: 'SECURITY_ANOMALY_DETECTED',
        entity: 'VideoConsultation',
        entityId: consultation.id.toString(),
        organizationId: consultation.organizationId,
        actorUserId: userId,
        newValues: { attempt: 'UNAUTHORIZED_ROOM_ACCESS', roomId },
        ip
      }).catch(e => logger.warn({ err: e.message, msg: '[TelemedicineService] Audit anomaly failed' }));

      const err = new Error('Acceso denegado: no estás autorizado para ingresar a esta sala de videoconsulta');
      err.statusCode = 403;
      throw err;
    }

    // Generate signed JWT room token
    const tokenPayload = {
      sub: 'webrtc_room_access',
      roomId,
      userId,
      userRole: role,
      consultationId: consultation.id,
      organizationId: consultation.organizationId,
      participantType: isDoctor ? 'DOCTOR' : (isPatient ? 'PATIENT' : 'OBSERVER')
    };

    const token = jwt.sign(tokenPayload, this._getSecret(), {
      expiresIn: TOKEN_EXPIRY
    });

    // Audit Log
    await auditService.logEvent({
      action: 'TELEMEDICINE_TOKEN_ISSUED',
      entity: 'VideoConsultation',
      entityId: consultation.id.toString(),
      organizationId: consultation.organizationId,
      actorUserId: userId,
      newValues: { roomId, participantType: tokenPayload.participantType },
      ip
    }).catch(e => logger.warn({ err: e.message, msg: '[TelemedicineService] Audit token failed' }));

    return {
      token,
      roomId,
      expiresIn: 3600,
      participantType: tokenPayload.participantType,
      consultation
    };
  }

  /**
   * 3. Verify Room Access Token (Used by WebSocket Signaling Guard)
   */
  verifyRoomAccessToken(token, requestedRoomId = null) {
    if (!token) {
      const err = new Error('Token de acceso a sala ausente');
      err.statusCode = 401;
      throw err;
    }

    try {
      const decoded = jwt.verify(token, this._getSecret());

      if (decoded.sub !== 'webrtc_room_access') {
        const err = new Error('Tipo de token no válido para videoconsulta');
        err.statusCode = 403;
        throw err;
      }

      if (requestedRoomId && decoded.roomId !== requestedRoomId) {
        const err = new Error('El token no corresponde a la sala solicitada');
        err.statusCode = 403;
        throw err;
      }

      return decoded;
    } catch (jwtErr) {
      const err = new Error('Token de sala inválido o expirado: ' + jwtErr.message);
      err.statusCode = 401;
      throw err;
    }
  }

  /**
   * 4. Start consultation session
   */
  async startSession({
    id,
    organizationId = null,
    actorUserId = null,
    ip = null
  }) {
    const consultation = await this._findConsultation(id, organizationId);

    if (consultation.status === 'completed') {
      const err = new Error('La videoconsulta ya fue completada');
      err.statusCode = 400;
      throw err;
    }

    if (consultation.status === 'cancelled') {
      const err = new Error('La videoconsulta se encuentra cancelada');
      err.statusCode = 400;
      throw err;
    }

    if (consultation.status !== 'active') {
      consultation.status = 'active';
      consultation.startTime = new Date();
      await consultation.save();

      // Audit Log
      await auditService.logEvent({
        action: 'TELEMEDICINE_SESSION_STARTED',
        entity: 'VideoConsultation',
        entityId: consultation.id.toString(),
        organizationId: consultation.organizationId,
        actorUserId,
        newValues: { status: 'active', startTime: consultation.startTime },
        ip
      }).catch(e => logger.warn({ err: e.message, msg: '[TelemedicineService] Audit start failed' }));

      // Domain Event
      eventBus.publish(DOMAIN_EVENTS.TELEMEDICINE_SESSION_STARTED, {
        consultationId: consultation.id,
        roomId: consultation.roomId,
        startTime: consultation.startTime
      }, {
        organizationId: consultation.organizationId,
        userId: actorUserId
      });
    }

    return consultation;
  }

  /**
   * 5. End consultation session
   */
  async endSession({
    id,
    notes = null,
    organizationId = null,
    actorUserId = null,
    ip = null
  }) {
    const consultation = await this._findConsultation(id, organizationId);

    if (consultation.status === 'completed') {
      return consultation;
    }

    const endTime = new Date();
    const startTime = consultation.startTime ? new Date(consultation.startTime) : endTime;
    const duration = Math.max(1, Math.round((endTime - startTime) / 60000));

    consultation.status = 'completed';
    consultation.endTime = endTime;
    consultation.duration = duration;
    if (notes) consultation.notes = notes;
    await consultation.save();

    // Audit Log
    await auditService.logEvent({
      action: 'TELEMEDICINE_SESSION_ENDED',
      entity: 'VideoConsultation',
      entityId: consultation.id.toString(),
      organizationId: consultation.organizationId,
      actorUserId,
      newValues: { status: 'completed', duration, endTime },
      ip
    }).catch(e => logger.warn({ err: e.message, msg: '[TelemedicineService] Audit end failed' }));

    // Domain Event
    eventBus.publish(DOMAIN_EVENTS.TELEMEDICINE_SESSION_ENDED, {
      consultationId: consultation.id,
      roomId: consultation.roomId,
      duration,
      endTime
    }, {
      organizationId: consultation.organizationId,
      userId: actorUserId
    });

    return consultation;
  }

  /**
   * 6. Cancel consultation session
   */
  async cancelSession({
    id,
    reason = 'Cancelado por usuario o médico',
    organizationId = null,
    actorUserId = null,
    ip = null
  }) {
    const consultation = await this._findConsultation(id, organizationId);

    if (consultation.status === 'completed') {
      const err = new Error('No se puede cancelar una videoconsulta completada');
      err.statusCode = 400;
      throw err;
    }

    consultation.status = 'cancelled';
    consultation.notes = consultation.notes ? `${consultation.notes} | Cancelada: ${reason}` : `Cancelada: ${reason}`;
    await consultation.save();

    // Audit Log
    await auditService.logEvent({
      action: 'TELEMEDICINE_SESSION_CANCELLED',
      entity: 'VideoConsultation',
      entityId: consultation.id.toString(),
      organizationId: consultation.organizationId,
      actorUserId,
      newValues: { status: 'cancelled', reason },
      ip
    }).catch(e => logger.warn({ err: e.message, msg: '[TelemedicineService] Audit cancel failed' }));

    // Domain Event
    eventBus.publish(DOMAIN_EVENTS.TELEMEDICINE_SESSION_CANCELLED, {
      consultationId: consultation.id,
      roomId: consultation.roomId,
      reason
    }, {
      organizationId: consultation.organizationId,
      userId: actorUserId
    });

    return consultation;
  }

  /**
   * 7. Get Consultation with Anti-IDOR check
   */
  async getConsultation({
    id,
    organizationId = null,
    userId = null,
    role = null
  }) {
    const consultation = await this._findConsultation(id, organizationId);

    if (userId && role) {
      const isDoctor = consultation.doctorId === userId;
      const isPatient = consultation.patientId === userId;
      const isStaff = ['SUPERADMIN', 'ADMIN', 'PLATFORM_ADMIN', 'ADMINISTRATIVE'].includes(role);

      if (!isDoctor && !isPatient && !isStaff) {
        const err = new Error('Acceso denegado a esta videoconsulta');
        err.statusCode = 403;
        throw err;
      }
    }

    return consultation;
  }

  /**
   * 8. List consultations with multi-tenant and role scoping
   */
  async listConsultations({
    organizationId = null,
    userId = null,
    role = null,
    isDoctorFilter = false,
    isPatientFilter = false
  }) {
    const isStaff = ['SUPERADMIN', 'PLATFORM_ADMIN'].includes(role);
    const where = {};

    if (!isStaff && organizationId) {
      where.organizationId = organizationId;
    }

    if (isDoctorFilter && userId) {
      where.doctorId = userId;
    } else if (isPatientFilter && userId) {
      where.patientId = userId;
    }

    return await VideoConsultation.findAll({
      where,
      include: [
        { model: User, as: 'doctor', attributes: ['id', 'firstName', 'lastName', 'email'] },
        { model: User, as: 'patient', attributes: ['id', 'firstName', 'lastName', 'email'] },
        { model: Appointment, attributes: ['id', 'date', 'status', 'reason'] }
      ],
      order: [['createdAt', 'DESC']]
    });
  }

  /**
   * Internal helper: Find consultation by numeric ID or roomId
   */
  async _findConsultation(id, organizationId = null) {
    if (!id || id === 'NaN' || id === 'undefined') {
      const err = new Error('ID de videoconsulta inválido');
      err.statusCode = 400;
      throw err;
    }

    const isNumericId = /^\d+$/.test(String(id));
    const where = isNumericId ? { id: parseInt(id) } : { roomId: String(id) };
    if (organizationId) where.organizationId = organizationId;

    const consultation = await VideoConsultation.findOne({
      where,
      include: [
        { model: User, as: 'doctor', attributes: ['id', 'firstName', 'lastName', 'email'] },
        { model: User, as: 'patient', attributes: ['id', 'firstName', 'lastName', 'email'] },
        { model: Appointment, attributes: ['id', 'date', 'reason', 'status'] }
      ]
    });

    if (!consultation) {
      const err = new Error('Videoconsulta no encontrada');
      err.statusCode = 404;
      throw err;
    }

    return consultation;
  }
}

module.exports = new TelemedicineService();
