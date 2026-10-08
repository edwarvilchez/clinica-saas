'use strict';

/**
 * 🤖 NoShowAutomationService - Clinical No-Show Detection, Reminders & Reconciliation
 * Implements Phase 20: multi-channel reminders, overdue reconciliation, audit logging,
 * and domain event dispatch with strict multi-tenant isolation.
 */

const { Op } = require('sequelize');
const { Appointment, Patient, Doctor, User, Specialty } = require('../models');
const notificationService = require('./notification.service');
const auditService = require('./audit.service');
const { eventBus, DOMAIN_EVENTS } = require('../events/eventBus');
const logger = require('../utils/logger');

class NoShowAutomationService {
  /**
   * Process and dispatch upcoming reminders (default 24h window)
   */
  async processUpcomingReminders({ organizationId = null, windowHours = 24 } = {}) {
    const now = new Date();
    const futureWindow = new Date(now.getTime() + windowHours * 60 * 60 * 1000);

    const whereClause = {
      date: {
        [Op.gte]: now,
        [Op.lte]: futureWindow
      },
      status: {
        [Op.in]: ['Pending', 'Confirmed']
      },
      reminder24hSent: false
    };

    if (organizationId) {
      whereClause.organizationId = organizationId;
    }

    const appointments = await Appointment.findAll({
      where: whereClause,
      include: [
        { model: Patient, include: [User] },
        { model: Doctor, include: [User] }
      ],
      order: [['date', 'ASC']]
    });

    let successfulCount = 0;
    let failedCount = 0;
    const processedAppointments = [];

    for (const appt of appointments) {
      try {
        const notifResult = await notificationService.sendAppointmentReminder(appt, { type: '24h' });

        // Update reminder flags atomically
        appt.reminder24hSent = true;
        appt.reminderSent = true;
        await appt.save();

        successfulCount++;
        processedAppointments.push({
          id: appt.id,
          patientId: appt.patientId,
          doctorId: appt.doctorId,
          date: appt.date,
          status: appt.status,
          notification: notifResult
        });

        // Publish domain event
        eventBus.publish(DOMAIN_EVENTS.APPOINTMENT_REMINDER_SENT, {
          appointmentId: appt.id,
          patientId: appt.patientId,
          doctorId: appt.doctorId,
          date: appt.date,
          reminderType: '24h'
        }, {
          organizationId: appt.organizationId
        });
      } catch (err) {
        failedCount++;
        logger.error({
          err: err.message,
          appointmentId: appt.id,
          msg: '[NoShowAutomation] Failed processing reminder for appointment'
        });
      }
    }

    return {
      totalFound: appointments.length,
      processedCount: successfulCount + failedCount,
      successfulCount,
      failedCount,
      appointments: processedAppointments
    };
  }

  /**
   * Reconcile past appointments that passed grace period without completion/cancellation
   */
  async reconcileOverdueAppointments({ organizationId = null, gracePeriodMinutes = 30, actorUserId = null, ip = null, sendNotice = false } = {}) {
    const cutoffDate = new Date(Date.now() - gracePeriodMinutes * 60 * 1000);

    const whereClause = {
      date: {
        [Op.lt]: cutoffDate
      },
      status: {
        [Op.in]: ['Pending', 'Confirmed']
      }
    };

    if (organizationId) {
      whereClause.organizationId = organizationId;
    }

    const overdueAppointments = await Appointment.findAll({
      where: whereClause,
      include: [
        { model: Patient, include: [User] },
        { model: Doctor, include: [User] }
      ],
      order: [['date', 'ASC']]
    });

    const reconciled = [];

    for (const appt of overdueAppointments) {
      const oldStatus = appt.status;
      appt.status = 'NoShow';
      await appt.save();

      // Audit log entry (tamper-evident SHA-256)
      await auditService.logEvent({
        action: 'APPOINTMENT_MARKED_NO_SHOW',
        entity: 'Appointment',
        entityId: appt.id,
        organizationId: appt.organizationId,
        actorUserId: actorUserId || null,
        metadata: { reconciler: 'SYSTEM_NO_SHOW_RECONCILER' },
        oldValues: { status: oldStatus },
        newValues: { status: 'NoShow', autoReconciled: true, gracePeriodMinutes },
        ip: ip || '127.0.0.1'
      }).catch(auditErr => {
        logger.warn({ err: auditErr.message, msg: '[NoShowAutomation] Failed to write audit log' });
      });

      // Domain Event
      eventBus.publish(DOMAIN_EVENTS.APPOINTMENT_NO_SHOW, {
        appointmentId: appt.id,
        patientId: appt.patientId,
        doctorId: appt.doctorId,
        date: appt.date,
        reason: 'OVERDUE_AUTO_RECONCILIATION'
      }, {
        organizationId: appt.organizationId,
        userId: actorUserId
      });

      // Optional rescheduling notice
      if (sendNotice) {
        notificationService.sendNoShowNotice(appt).catch(noticeErr => {
          logger.warn({ err: noticeErr.message, msg: '[NoShowAutomation] Notice send failed' });
        });
      }

      reconciled.push({
        id: appt.id,
        patientId: appt.patientId,
        doctorId: appt.doctorId,
        date: appt.date,
        previousStatus: oldStatus,
        newStatus: 'NoShow'
      });
    }

    return {
      reconciledCount: reconciled.length,
      appointments: reconciled
    };
  }

  /**
   * Explicitly mark a single appointment as No-Show by clinic staff
   */
  async markAppointmentAsNoShow({ appointmentId, organizationId = null, reason = 'PATIENT_DID_NOT_ARRIVE', actorUserId = null, ip = null, sendNotice = false }) {
    const whereClause = { id: appointmentId };
    if (organizationId) {
      whereClause.organizationId = organizationId;
    }

    const appointment = await Appointment.findOne({
      where: whereClause,
      include: [
        { model: Patient, include: [User] },
        { model: Doctor, include: [User] }
      ]
    });

    if (!appointment) {
      const notFoundError = new Error('Cita no encontrada o acceso denegado');
      notFoundError.statusCode = 404;
      throw notFoundError;
    }

    if (appointment.status === 'Cancelled') {
      const conflictError = new Error('No se puede marcar como No-Show una cita cancelada previamente');
      conflictError.statusCode = 400;
      throw conflictError;
    }

    if (appointment.status === 'Completed') {
      const conflictError = new Error('No se puede marcar como No-Show una cita ya completada');
      conflictError.statusCode = 400;
      throw conflictError;
    }

    const previousStatus = appointment.status;
    appointment.status = 'NoShow';
    await appointment.save();

    // Audit Log
    await auditService.logEvent({
      action: 'APPOINTMENT_MARKED_NO_SHOW',
      entity: 'Appointment',
      entityId: appointment.id,
      organizationId: appointment.organizationId,
      actorUserId: actorUserId || null,
      oldValues: { status: previousStatus },
      newValues: { status: 'NoShow', reason },
      ip: ip || '127.0.0.1'
    }).catch(auditErr => {
      logger.warn({ err: auditErr.message, msg: '[NoShowAutomation] Failed to write audit log' });
    });

    // Domain Event Bus
    eventBus.publish(DOMAIN_EVENTS.APPOINTMENT_NO_SHOW, {
      appointmentId: appointment.id,
      patientId: appointment.patientId,
      doctorId: appointment.doctorId,
      date: appointment.date,
      reason
    }, {
      organizationId: appointment.organizationId,
      userId: actorUserId
    });

    // Optional notification
    if (sendNotice) {
      notificationService.sendNoShowNotice(appointment).catch(noticeErr => {
        logger.warn({ err: noticeErr.message, msg: '[NoShowAutomation] Notice send failed' });
      });
    }

    return appointment;
  }

  /**
   * Aggregate clinic no-show operational metrics
   */
  async getNoShowStats({ organizationId = null, startDate = null, endDate = null } = {}) {
    const whereClause = {};

    if (organizationId) {
      whereClause.organizationId = organizationId;
    }

    if (startDate || endDate) {
      whereClause.date = {};
      if (startDate) whereClause.date[Op.gte] = new Date(startDate);
      if (endDate) whereClause.date[Op.lte] = new Date(endDate);
    }

    const appointments = await Appointment.findAll({
      where: whereClause,
      include: [
        { model: Doctor, include: [User] }
      ],
      attributes: ['id', 'status', 'date', 'doctorId', 'organizationId']
    });

    const total = appointments.length;
    let noShowCount = 0;
    let completedCount = 0;
    let cancelledCount = 0;
    let confirmedCount = 0;
    let pendingCount = 0;

    const doctorMap = {};

    for (const appt of appointments) {
      const status = appt.status;
      if (status === 'NoShow') noShowCount++;
      else if (status === 'Completed') completedCount++;
      else if (status === 'Cancelled') cancelledCount++;
      else if (status === 'Confirmed') confirmedCount++;
      else if (status === 'Pending') pendingCount++;

      if (appt.doctorId) {
        const docUser = appt.Doctor?.User;
        const docName = docUser ? `${docUser.firstName} ${docUser.lastName}` : `Doctor ${appt.doctorId}`;
        if (!doctorMap[appt.doctorId]) {
          doctorMap[appt.doctorId] = {
            doctorId: appt.doctorId,
            doctorName: docName,
            totalAppointments: 0,
            noShowCount: 0
          };
        }
        doctorMap[appt.doctorId].totalAppointments++;
        if (status === 'NoShow') {
          doctorMap[appt.doctorId].noShowCount++;
        }
      }
    }

    const noShowRate = total > 0 ? parseFloat(((noShowCount / total) * 100).toFixed(2)) : 0;

    const byDoctor = Object.values(doctorMap).map(doc => ({
      ...doc,
      noShowRate: doc.totalAppointments > 0 ? parseFloat(((doc.noShowCount / doc.totalAppointments) * 100).toFixed(2)) : 0
    }));

    return {
      totalAppointments: total,
      noShowCount,
      completedCount,
      cancelledCount,
      confirmedCount,
      pendingCount,
      noShowRatePercentage: noShowRate,
      byDoctor
    };
  }
}

module.exports = new NoShowAutomationService();
