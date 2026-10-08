'use strict';

/**
 * ⚡ SmartWaitlistService - Clinical Smart Waitlist & Automated Slot Reassignment
 * Implements Phase 21: FIFO-prioritized waitlist, slot matching on cancellations,
 * interactive offers, transactional conversion to appointments, and domain events.
 */

const { Op } = require('sequelize');
const {
  WaitlistEntry,
  Patient,
  Doctor,
  User,
  Specialty,
  Appointment,
  sequelize
} = require('../models');
const notificationService = require('./notification.service');
const auditService = require('./audit.service');
const { eventBus, DOMAIN_EVENTS } = require('../events/eventBus');
const { validateAppointment } = require('../utils/appointmentValidator');
const logger = require('../utils/logger');

class SmartWaitlistService {
  /**
   * Helper to build prioritized SQL order clause (URGENT > HIGH > MEDIUM > LOW)
   */
  _getPriorityOrder() {
    return [
      [sequelize.literal(`CASE "WaitlistEntry"."priority" WHEN 'URGENT' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 WHEN 'LOW' THEN 4 ELSE 5 END`), 'ASC'],
      ['createdAt', 'ASC']
    ];
  }

  /**
   * Add a patient to the waitlist
   */
  async addToWaitlist({
    organizationId,
    patientId,
    doctorId = null,
    specialtyId = null,
    priority = 'MEDIUM',
    preferredDays = [],
    preferredTimeRange = 'ANY',
    notes = null,
    actorUserId = null,
    ip = null
  }) {
    if (!organizationId || !patientId) {
      const err = new Error('organizationId y patientId son requeridos para la lista de espera');
      err.statusCode = 400;
      throw err;
    }

    // Verify patient belongs to organization
    const patient = await Patient.findOne({
      where: { id: patientId, organizationId },
      include: [User]
    });

    if (!patient) {
      const err = new Error('Paciente no encontrado en esta organización');
      err.statusCode = 404;
      throw err;
    }

    // Check if patient already has an active WAITING entry for this doctor/specialty
    const duplicateWhere = {
      organizationId,
      patientId,
      status: 'WAITING'
    };
    if (doctorId) duplicateWhere.doctorId = doctorId;
    if (specialtyId) duplicateWhere.specialtyId = specialtyId;

    const existingWaiting = await WaitlistEntry.findOne({ where: duplicateWhere });
    if (existingWaiting) {
      const err = new Error('El paciente ya tiene una solicitud activa en lista de espera');
      err.statusCode = 409;
      throw err;
    }

    const entry = await WaitlistEntry.create({
      organizationId,
      patientId,
      doctorId,
      specialtyId,
      priority,
      preferredDays: Array.isArray(preferredDays) ? preferredDays : [],
      preferredTimeRange,
      notes,
      status: 'WAITING'
    });

    // Tamper-evident Audit Log
    await auditService.logEvent({
      action: 'WAITLIST_ENTRY_CREATED',
      entity: 'WaitlistEntry',
      entityId: entry.id,
      organizationId,
      actorUserId,
      newValues: {
        patientId,
        doctorId,
        specialtyId,
        priority,
        status: 'WAITING'
      },
      ip
    }).catch(e => logger.warn({ err: e.message, msg: '[SmartWaitlist] Audit log failed' }));

    // Domain Event Bus
    eventBus.publish(DOMAIN_EVENTS.WAITLIST_ENTRY_CREATED, {
      waitlistEntryId: entry.id,
      patientId,
      doctorId,
      specialtyId,
      priority
    }, {
      organizationId,
      userId: actorUserId
    });

    return await this.getWaitlistById({ id: entry.id, organizationId });
  }

  /**
   * Get single waitlist entry by ID with multi-tenant check
   */
  async getWaitlistById({ id, organizationId = null }) {
    const where = { id };
    if (organizationId) where.organizationId = organizationId;

    const entry = await WaitlistEntry.findOne({
      where,
      include: [
        { model: Patient, include: [User] },
        { model: Doctor, include: [User] },
        { model: Specialty }
      ]
    });

    if (!entry) {
      const err = new Error('Entrada de lista de espera no encontrada');
      err.statusCode = 404;
      throw err;
    }

    return entry;
  }

  /**
   * Get paginated waitlist entries with filters
   */
  async getWaitlist({
    organizationId = null,
    status = null,
    specialtyId = null,
    doctorId = null,
    patientId = null,
    page = 1,
    limit = 20
  } = {}) {
    const where = {};
    if (organizationId) where.organizationId = organizationId;
    if (status) where.status = status;
    if (specialtyId) where.specialtyId = specialtyId;
    if (doctorId) where.doctorId = doctorId;
    if (patientId) where.patientId = patientId;

    const offset = (Math.max(1, page) - 1) * limit;

    const { count, rows } = await WaitlistEntry.findAndCountAll({
      where,
      limit,
      offset,
      include: [
        { model: Patient, include: [User] },
        { model: Doctor, include: [User] },
        { model: Specialty }
      ],
      order: this._getPriorityOrder()
    });

    return {
      entries: rows,
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / limit)
    };
  }

  /**
   * Find eligible candidate entries for an available time slot
   */
  async findEligibleCandidates({ organizationId, doctorId = null, specialtyId = null, limit = 5 }) {
    const where = {
      organizationId,
      status: 'WAITING'
    };

    if (doctorId && specialtyId) {
      where[Op.or] = [
        { doctorId },
        { doctorId: null, specialtyId }
      ];
    } else if (doctorId) {
      where[Op.or] = [
        { doctorId },
        { doctorId: null }
      ];
    } else if (specialtyId) {
      where.specialtyId = specialtyId;
    }

    return await WaitlistEntry.findAll({
      where,
      limit,
      include: [
        { model: Patient, include: [User] },
        { model: Doctor, include: [User] },
        { model: Specialty }
      ],
      order: this._getPriorityOrder()
    });
  }

  /**
   * Offer an open slot to a specific candidate
   */
  async offerSlotToCandidate({
    waitlistEntryId,
    organizationId = null,
    slotDate,
    expirationMinutes = 120,
    actorUserId = null,
    ip = null
  }) {
    const where = { id: waitlistEntryId };
    if (organizationId) where.organizationId = organizationId;

    const entry = await WaitlistEntry.findOne({
      where,
      include: [
        { model: Patient, include: [User] },
        { model: Doctor, include: [User] },
        { model: Specialty }
      ]
    });

    if (!entry) {
      const err = new Error('Entrada de lista de espera no encontrada');
      err.statusCode = 404;
      throw err;
    }

    if (entry.status !== 'WAITING') {
      const err = new Error(`No se puede ofrecer turno a una entrada con estado ${entry.status}`);
      err.statusCode = 400;
      throw err;
    }

    const offerExpiresAt = new Date(Date.now() + expirationMinutes * 60 * 1000);
    const oldStatus = entry.status;

    entry.status = 'OFFERED';
    entry.offeredAppointmentDate = new Date(slotDate);
    entry.offeredAt = new Date();
    entry.offerExpiresAt = offerExpiresAt;
    await entry.save();

    // Audit log
    await auditService.logEvent({
      action: 'WAITLIST_OFFER_SENT',
      entity: 'WaitlistEntry',
      entityId: entry.id,
      organizationId: entry.organizationId,
      actorUserId,
      oldValues: { status: oldStatus },
      newValues: {
        status: 'OFFERED',
        offeredAppointmentDate: entry.offeredAppointmentDate,
        offerExpiresAt
      },
      ip
    }).catch(e => logger.warn({ err: e.message, msg: '[SmartWaitlist] Audit log failed' }));

    // Domain Event
    eventBus.publish(DOMAIN_EVENTS.WAITLIST_OFFER_SENT, {
      waitlistEntryId: entry.id,
      patientId: entry.patientId,
      doctorId: entry.doctorId,
      offeredDate: entry.offeredAppointmentDate,
      offerExpiresAt
    }, {
      organizationId: entry.organizationId,
      userId: actorUserId
    });

    // Send multi-channel notification
    notificationService.sendWaitlistOfferNotice(entry).catch(err => {
      logger.warn({ err: err.message, waitlistEntryId: entry.id, msg: '[SmartWaitlist] Offer notification failed' });
    });

    return entry;
  }

  /**
   * Accept an offered slot and convert it into a confirmed appointment
   */
  async acceptOffer({
    waitlistEntryId,
    organizationId = null,
    patientUserId = null,
    actorUserId = null,
    ip = null
  }) {
    // Preliminary check to persist EXPIRED state if deadline has passed
    const wherePre = { id: waitlistEntryId };
    if (organizationId) wherePre.organizationId = organizationId;
    const preCheck = await WaitlistEntry.findOne({ where: wherePre });
    if (preCheck && preCheck.offerExpiresAt && new Date() > new Date(preCheck.offerExpiresAt)) {
      preCheck.status = 'EXPIRED';
      await preCheck.save();
      const err = new Error('La oferta de turno ha expirado. Por favor solicita un nuevo espacio.');
      err.statusCode = 400;
      throw err;
    }

    return await sequelize.transaction(async (t) => {
      const where = { id: waitlistEntryId };
      if (organizationId) where.organizationId = organizationId;

      const entry = await WaitlistEntry.findOne({
        where,
        transaction: t,
        lock: t.LOCK.UPDATE
      });

      if (!entry) {
        const err = new Error('Entrada de lista de espera no encontrada');
        err.statusCode = 404;
        throw err;
      }

      await entry.reload({
        include: [
          { model: Patient, include: [User] },
          { model: Doctor, include: [User] },
          { model: Specialty }
        ],
        transaction: t
      });

      // Anti-IDOR: If called by patient, verify patient owns this entry
      if (patientUserId && entry.Patient?.userId !== patientUserId) {
        const err = new Error('Acceso denegado: no puedes aceptar ofertas de otros pacientes');
        err.statusCode = 403;
        throw err;
      }

      if (entry.status !== 'OFFERED') {
        const err = new Error(`La oferta no está disponible para aceptación (estado actual: ${entry.status})`);
        err.statusCode = 400;
        throw err;
      }

      // Verify expiration
      if (entry.offerExpiresAt && new Date() > new Date(entry.offerExpiresAt)) {
        entry.status = 'EXPIRED';
        await entry.save({ transaction: t });
        const err = new Error('La oferta de turno ha expirado. Por favor solicita un nuevo espacio.');
        err.statusCode = 400;
        throw err;
      }

      // Validate scheduling conflict
      const appointmentDate = entry.offeredAppointmentDate;
      const targetDoctorId = entry.doctorId;
      if (targetDoctorId) {
        const conflict = await validateAppointment(targetDoctorId, entry.patientId, appointmentDate);
        if (!conflict.valid) {
          const err = new Error('Conflicto de horario detectado al confirmar la cita reasignada');
          err.statusCode = 409;
          throw err;
        }
      }

      // Create confirmed Appointment
      const appointment = await Appointment.create({
        patientId: entry.patientId,
        doctorId: targetDoctorId,
        date: appointmentDate,
        reason: entry.notes || 'Cita programada vía Smart Waitlist',
        notes: `Reasignado desde lista de espera (ID: ${entry.id})`,
        status: 'Confirmed',
        organizationId: entry.organizationId
      }, { transaction: t });

      // Update WaitlistEntry
      const oldStatus = entry.status;
      entry.status = 'ACCEPTED';
      entry.convertedAppointmentId = appointment.id;
      await entry.save({ transaction: t });

      // Audit Log
      await auditService.logEvent({
        action: 'WAITLIST_OFFER_ACCEPTED',
        entity: 'WaitlistEntry',
        entityId: entry.id,
        organizationId: entry.organizationId,
        actorUserId: actorUserId || entry.Patient?.userId,
        oldValues: { status: oldStatus },
        newValues: {
          status: 'ACCEPTED',
          convertedAppointmentId: appointment.id
        },
        ip,
        transaction: t
      }).catch(e => logger.warn({ err: e.message, msg: '[SmartWaitlist] Audit log failed' }));

      // Domain Events
      eventBus.publish(DOMAIN_EVENTS.WAITLIST_OFFER_ACCEPTED, {
        waitlistEntryId: entry.id,
        patientId: entry.patientId,
        doctorId: targetDoctorId,
        appointmentId: appointment.id,
        date: appointmentDate
      }, {
        organizationId: entry.organizationId,
        userId: actorUserId || entry.Patient?.userId
      });

      eventBus.publish(DOMAIN_EVENTS.APPOINTMENT_SCHEDULED, {
        appointmentId: appointment.id,
        patientId: entry.patientId,
        doctorId: targetDoctorId,
        date: appointmentDate,
        reason: appointment.reason
      }, {
        organizationId: entry.organizationId,
        userId: actorUserId || entry.Patient?.userId
      });

      return {
        entry,
        appointment
      };
    });
  }

  /**
   * Decline an offer or cancel waitlist entry
   */
  async declineOffer({
    waitlistEntryId,
    organizationId = null,
    patientUserId = null,
    reason = 'PATIENT_DECLINED',
    keepInWaitlist = false,
    actorUserId = null,
    ip = null
  }) {
    const where = { id: waitlistEntryId };
    if (organizationId) where.organizationId = organizationId;

    const entry = await WaitlistEntry.findOne({
      where,
      include: [{ model: Patient, include: [User] }]
    });

    if (!entry) {
      const err = new Error('Entrada de lista de espera no encontrada');
      err.statusCode = 404;
      throw err;
    }

    if (patientUserId && entry.Patient?.userId !== patientUserId) {
      const err = new Error('Acceso denegado: no puedes rechazar ofertas de otros pacientes');
      err.statusCode = 403;
      throw err;
    }

    const oldStatus = entry.status;
    entry.status = keepInWaitlist ? 'WAITING' : 'CANCELLED';
    entry.offeredAppointmentDate = null;
    entry.offeredAt = null;
    entry.offerExpiresAt = null;
    await entry.save();

    // Audit Log
    await auditService.logEvent({
      action: 'WAITLIST_OFFER_DECLINED',
      entity: 'WaitlistEntry',
      entityId: entry.id,
      organizationId: entry.organizationId,
      actorUserId,
      oldValues: { status: oldStatus },
      newValues: { status: entry.status, reason },
      ip
    }).catch(e => logger.warn({ err: e.message, msg: '[SmartWaitlist] Audit log failed' }));

    // Domain Event
    eventBus.publish(DOMAIN_EVENTS.WAITLIST_OFFER_DECLINED, {
      waitlistEntryId: entry.id,
      patientId: entry.patientId,
      reason,
      newStatus: entry.status
    }, {
      organizationId: entry.organizationId,
      userId: actorUserId
    });

    return entry;
  }

  /**
   * Expire stale offers that passed deadline
   */
  async expireStaleOffers({ organizationId = null } = {}) {
    const where = {
      status: 'OFFERED',
      offerExpiresAt: {
        [Op.lt]: new Date()
      }
    };
    if (organizationId) where.organizationId = organizationId;

    const expiredEntries = await WaitlistEntry.findAll({ where });

    for (const entry of expiredEntries) {
      entry.status = 'EXPIRED';
      await entry.save();
    }

    return {
      expiredCount: expiredEntries.length,
      entries: expiredEntries
    };
  }

  /**
   * Smart matching listener when an appointment is cancelled or marked as NoShow
   */
  async autoMatchOnSlotReleased({ organizationId, doctorId, specialtyId = null, slotDate, expirationMinutes = 120 }) {
    try {
      const candidates = await this.findEligibleCandidates({
        organizationId,
        doctorId,
        specialtyId,
        limit: 1
      });

      if (candidates.length === 0) {
        return { matched: false, reason: 'No eligible candidates in waitlist' };
      }

      const topCandidate = candidates[0];
      const offered = await this.offerSlotToCandidate({
        waitlistEntryId: topCandidate.id,
        organizationId,
        slotDate,
        expirationMinutes
      });

      return {
        matched: true,
        candidateId: topCandidate.id,
        offered
      };
    } catch (err) {
      logger.error({ err: err.message, msg: '[SmartWaitlist] autoMatchOnSlotReleased failed' });
      return { matched: false, error: err.message };
    }
  }

  /**
   * Aggregate waitlist metrics for clinic administrators
   */
  async getWaitlistStats({ organizationId = null } = {}) {
    const where = {};
    if (organizationId) where.organizationId = organizationId;

    const entries = await WaitlistEntry.findAll({
      where,
      attributes: ['id', 'status', 'priority', 'organizationId']
    });

    const total = entries.length;
    let waitingCount = 0;
    let offeredCount = 0;
    let acceptedCount = 0;
    let expiredCount = 0;
    let cancelledCount = 0;

    const priorityBreakdown = { URGENT: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };

    for (const e of entries) {
      if (e.status === 'WAITING') waitingCount++;
      else if (e.status === 'OFFERED') offeredCount++;
      else if (e.status === 'ACCEPTED') acceptedCount++;
      else if (e.status === 'EXPIRED') expiredCount++;
      else if (e.status === 'CANCELLED') cancelledCount++;

      if (e.status === 'WAITING' && priorityBreakdown[e.priority] !== undefined) {
        priorityBreakdown[e.priority]++;
      }
    }

    const conversionRate = (waitingCount + offeredCount + acceptedCount) > 0
      ? parseFloat(((acceptedCount / (acceptedCount + expiredCount + cancelledCount || 1)) * 100).toFixed(2))
      : 0;

    return {
      totalEntries: total,
      waitingCount,
      offeredCount,
      acceptedCount,
      expiredCount,
      cancelledCount,
      priorityBreakdown,
      conversionRatePercentage: conversionRate
    };
  }
}

module.exports = new SmartWaitlistService();
