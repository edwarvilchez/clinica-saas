const { Appointment, Patient, Doctor, User, sequelize } = require('../models');
const { Op } = require('sequelize');
const whatsapp = require('../utils/whatsapp.service');
const { validateAppointment } = require('../utils/appointmentValidator');
const auditService = require('../services/audit.service');
const { getTenantTransaction } = require('../utils/tenantRls');

exports.createAppointment = async (req, res) => {
  try {
    const { patientId, doctorId, date, reason, notes } = req.body;
    
    const conflictCheck = await validateAppointment(doctorId, patientId, date);
    if (!conflictCheck.valid) {
      return res.status(409).json({
        message: 'Conflicto de horario detectado',
        errors: conflictCheck.errors
      });
    }
    
    const organizationId = req.user?.organizationId || req.body.organizationId;
    const withTx = getTenantTransaction(req);

    const result = await withTx(async (t) => {
      const appointment = await Appointment.create({
        patientId,
        doctorId,
        date,
        reason,
        notes,
        status: 'Confirmed',
        organizationId
      }, { transaction: t });

      // Fetch details for WhatsApp
      const appointmentDetails = await Appointment.findByPk(appointment.id, {
        include: [
          { model: Patient, include: [User] },
          { model: Doctor, include: [User] }
        ],
        transaction: t
      });

      return { appointment, appointmentDetails };
    });

    const { appointment, appointmentDetails } = result;

    const patientPhone = appointmentDetails?.Patient?.phone;
    const patientName = `${appointmentDetails?.Patient?.User?.firstName || ''} ${appointmentDetails?.Patient?.User?.lastName || ''}`.trim() || 'Paciente';
    const doctorName = `${appointmentDetails?.Doctor?.User?.firstName || ''} ${appointmentDetails?.Doctor?.User?.lastName || ''}`.trim() || 'Médico';
    const appointmentDate = new Date(date);
    
    // Send WhatsApp with Calendar Link
    if (patientPhone) {
      whatsapp.sendAppointmentConfirmation(patientPhone, {
        patientName,
        doctorName,
        date: appointmentDate.toLocaleDateString(),
        time: appointmentDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        appointmentId: appointment.id,
        rawDate: appointmentDate
      }).catch(err => console.error('WhatsApp Error:', err));
    }

    // Tamper-evident Audit Log: Appointment creation
    auditService.logEvent({
      action: 'CREATE_APPOINTMENT',
      entity: 'Appointment',
      entityId: appointment.id,
      organizationId,
      actorUserId: req.user?.id,
      newValues: {
        patientId,
        doctorId,
        date,
        reason,
        status: 'Confirmed'
      },
      ip: req.ip
    }).catch(err => console.error('Audit create appointment error:', err));

    // Domain Event Bus Dispatch
    try {
      const { eventBus, DOMAIN_EVENTS } = require('../events/eventBus');
      eventBus.publish(DOMAIN_EVENTS.APPOINTMENT_SCHEDULED, {
        appointmentId: appointment.id,
        patientId,
        doctorId,
        date,
        reason
      }, {
        organizationId,
        userId: req.user?.id,
        requestId: req.headers ? req.headers['x-request-id'] : null
      });
    } catch (busErr) {
      // Non-blocking event dispatch
    }

    res.status(201).json(appointmentDetails);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getAppointments = async (req, res) => {
  try {
    const userRole = req.user.role ? req.user.role.toUpperCase() : '';
    const userId = req.user.id;
    const organizationId = req.user.organizationId;

    // Paginación
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    let whereClause = {};
    const adminRoles = ['SUPERADMIN', 'ADMINISTRATIVE', 'NURSE', 'RECEPTIONIST'];

    // Dynamic Include for Doctor to filter by Organization
    let doctorUserInclude = { model: User, attributes: ['id', 'firstName', 'lastName', 'email', 'organizationId'] };

    // If not SUPERADMIN / PLATFORM_ADMIN and belongs to an Organization, filter Doctors by that Organization
    const isSuperAdmin = userRole === 'SUPERADMIN' || userRole === 'PLATFORM_ADMIN';
    if (organizationId && !isSuperAdmin) {
        doctorUserInclude.where = { organizationId };
    }

    const withTx = getTenantTransaction(req);
    const result = await withTx(async (t) => {
      if (adminRoles.includes(userRole)) {
          // Admin Roles: See all appointments in their Organization
          whereClause = {};
          if (organizationId && !isSuperAdmin) {
            whereClause.organizationId = organizationId;
          }
      } else {
          // Doctor or Patient: Specific filtering
          const conditions = [];

          if (userRole === 'PATIENT') {
               const patient = await Patient.findOne({ where: { userId }, transaction: t });
               if (patient) conditions.push({ patientId: patient.id });
          } else if (userRole === 'DOCTOR') {
               const doctor = await Doctor.findOne({ where: { userId }, transaction: t });
               if (doctor) conditions.push({ doctorId: doctor.id });
          }

          if (conditions.length > 0) {
              whereClause = { [Op.or]: conditions };
              if (organizationId && !isSuperAdmin) {
                whereClause.organizationId = organizationId;
              }
          } else {
              return { empty: true };
          }
      }

      const { count, rows } = await Appointment.findAndCountAll({
        where: whereClause,
        limit,
        offset,
        include: [
          { model: Patient, include: [User] },
          {
              model: Doctor,
              include: [doctorUserInclude],
              required: true // Inner join to ensure Organization filter applies
          }
        ],
        order: [['date', 'ASC']],
        distinct: true,
        transaction: t
      });

      return { count, rows };
    });

    if (result.empty) {
      return res.json({ appointments: [], totalPages: 0, currentPage: 1, total: 0 });
    }

    res.json({
      appointments: result.rows,
      totalPages: Math.ceil(result.count / limit),
      currentPage: page,
      total: result.count,
    });
  } catch (error) {
    const logger = require('../utils/logger');
    logger.error({ err: error }, 'Error fetching appointments');
    res.status(500).json({ error: error.message });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const organizationId = req.user?.organizationId;
    const isSuperAdmin = req.user?.role === 'SUPERADMIN' || req.user?.role === 'PLATFORM_ADMIN';
    
    const whereClause = { id };
    if (!isSuperAdmin && organizationId) {
      whereClause.organizationId = organizationId;
    }

    const withTx = getTenantTransaction(req);
    const result = await withTx(async (t) => {
      const oldAppointment = await Appointment.findOne({ where: whereClause, transaction: t });
      if (!oldAppointment) return { status: 404, payload: { error: 'Cita no encontrada o acceso no autorizado' } };

      await Appointment.update({ status }, { where: whereClause, transaction: t });
      
      let patientPhone = null;
      let patientFirstName = null;
      let appointmentDate = null;

      if (status === 'Cancelled') {
          const appointment = await Appointment.findOne({
              where: whereClause,
              include: [{ model: Patient, include: [User] }],
              transaction: t
          });
          
          if (appointment) {
              appointmentDate = new Date(appointment.date);
              patientPhone = appointment.Patient?.User?.phone;
              patientFirstName = appointment.Patient?.User?.firstName;
          }
      }

      return {
        status: 200,
        payload: { message: 'Status updated' },
        oldStatus: oldAppointment.status,
        patientPhone,
        patientFirstName,
        appointmentDate
      };
    });

    if (result.status !== 200) {
      return res.status(result.status).json(result.payload);
    }

    if (result.patientPhone && result.patientFirstName) {
      whatsapp.sendCancellationNotice(result.patientPhone, {
          patientName: result.patientFirstName,
          date: result.appointmentDate.toLocaleDateString(),
          time: result.appointmentDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }).catch(e => console.error(e));
    }

    // Tamper-evident Audit Log: Status update
    auditService.logEvent({
      action: 'UPDATE_APPOINTMENT_STATUS',
      entity: 'Appointment',
      entityId: id,
      organizationId,
      actorUserId: req.user?.id,
      oldValues: { status: result.oldStatus },
      newValues: { status },
      ip: req.ip
    }).catch(err => console.error('Audit update appointment error:', err));

    res.json(result.payload);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.cancelAppointment = async (req, res) => {
    try {
        const { id } = req.params;
        const organizationId = req.user?.organizationId;
        const isSuperAdmin = req.user?.role === 'SUPERADMIN' || req.user?.role === 'PLATFORM_ADMIN';
        
        const whereClause = { id };
        if (!isSuperAdmin && organizationId) {
          whereClause.organizationId = organizationId;
        }

        const withTx = getTenantTransaction(req);
        const result = await withTx(async (t) => {
          const appointment = await Appointment.findOne({
              where: whereClause,
              include: [{ model: Patient, include: [User] }],
              transaction: t
          });
          if (!appointment) return { status: 404, payload: { error: 'Cita no encontrada o acceso no autorizado' } };

          const oldValues = appointment.toJSON();
          appointment.status = 'Cancelled';
          await appointment.save({ transaction: t });

          const dateObj = new Date(appointment.date);
          const patientPhone = appointment.Patient?.User?.phone;
          const patientName = appointment.Patient?.User?.firstName;

          return {
            status: 200,
            payload: { message: 'Cita cancelada con éxito' },
            oldValues,
            dateObj,
            patientPhone,
            patientName
          };
        });

        if (result.status !== 200) {
          return res.status(result.status).json(result.payload);
        }
        
        // Notify patient
        if (result.patientPhone && result.patientName) {
          whatsapp.sendCancellationNotice(result.patientPhone, {
              patientName: result.patientName,
              date: result.dateObj.toLocaleDateString(),
              time: result.dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }).catch(e => console.error(e));
        }

        // Tamper-evident Audit Log: Appointment cancellation
        auditService.logEvent({
          action: 'CANCEL_APPOINTMENT',
          entity: 'Appointment',
          entityId: id,
          organizationId,
          actorUserId: req.user?.id,
          oldValues: { status: result.oldValues.status },
          newValues: { status: 'Cancelled' },
          ip: req.ip
        }).catch(err => console.error('Audit cancel appointment error:', err));

        res.json(result.payload);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.rescheduleAppointment = async (req, res) => {
    try {
        const { id } = req.params;
        const { newDate } = req.body;
        const organizationId = req.user?.organizationId;
        const isSuperAdmin = req.user?.role === 'SUPERADMIN' || req.user?.role === 'PLATFORM_ADMIN';
        const withTx = getTenantTransaction(req);
        
        const result = await withTx(async (t) => {
          const appointment = await Appointment.findByPk(id, {
               include: [
                  { model: Patient, include: [User] },
                  { model: Doctor, include: [User] }
              ],
              transaction: t
          });

          if (!appointment) return { status: 404, payload: { error: 'Cita no encontrada' } };
          if (!isSuperAdmin && organizationId && appointment.organizationId && appointment.organizationId !== organizationId) {
            return { status: 403, payload: { error: 'Acceso no autorizado a cita de otra organización' } };
          }

          const oldValues = appointment.toJSON();
          appointment.date = newDate;
          appointment.status = 'Confirmed';
          appointment.reminderSent = false;
          await appointment.save({ transaction: t });

          const patientName = `${appointment.Patient?.User?.firstName || ''} ${appointment.Patient?.User?.lastName || ''}`.trim() || 'Paciente';
          const doctorName = `${appointment.Doctor?.User?.firstName || ''} ${appointment.Doctor?.User?.lastName || ''}`.trim() || 'Médico';
          const patientPhone = appointment.Patient?.User?.phone;
          const appointmentDate = new Date(newDate);

          return {
            status: 200,
            payload: { message: 'Cita reagendada con éxito', appointment },
            appointment,
            patientPhone,
            patientName,
            doctorName,
            appointmentDate
          };
        });

        if (result.status !== 200) {
          return res.status(result.status).json(result.payload);
        }

        // Send new confirmation
        if (result.patientPhone) {
          whatsapp.sendAppointmentConfirmation(result.patientPhone, {
              patientName: result.patientName,
              doctorName: result.doctorName,
              date: result.appointmentDate.toLocaleDateString(),
              time: result.appointmentDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              appointmentId: result.appointment.id,
              rawDate: result.appointmentDate
          }).catch(e => console.error(e));
        }

        res.json(result.payload);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const noShowAutomationService = require('../services/noShowAutomation.service');

exports.processUpcomingReminders = async (req, res) => {
  try {
    const isSuperAdmin = req.user?.role === 'SUPERADMIN' || req.user?.role === 'PLATFORM_ADMIN';
    const organizationId = isSuperAdmin ? (req.query?.organizationId || req.body?.organizationId || req.user?.organizationId) : req.user?.organizationId;
    const windowHours = parseInt(req.body?.windowHours || req.query?.windowHours) || 24;

    const result = await noShowAutomationService.processUpcomingReminders({
      organizationId,
      windowHours
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.reconcileOverdueNoShows = async (req, res) => {
  try {
    const isSuperAdmin = req.user?.role === 'SUPERADMIN' || req.user?.role === 'PLATFORM_ADMIN';
    const organizationId = isSuperAdmin ? (req.query?.organizationId || req.body?.organizationId || req.user?.organizationId) : req.user?.organizationId;
    const gracePeriodMinutes = parseInt(req.body?.gracePeriodMinutes || req.query?.gracePeriodMinutes) || 30;
    const sendNotice = req.body?.sendNotice === true;

    const result = await noShowAutomationService.reconcileOverdueAppointments({
      organizationId,
      gracePeriodMinutes,
      actorUserId: req.user?.id,
      ip: req.ip,
      sendNotice
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.markAppointmentAsNoShow = async (req, res) => {
  try {
    const { id } = req.params;
    const isSuperAdmin = req.user?.role === 'SUPERADMIN' || req.user?.role === 'PLATFORM_ADMIN';
    const organizationId = isSuperAdmin ? null : req.user?.organizationId;
    const { reason, sendNotice } = req.body || {};

    const appointment = await noShowAutomationService.markAppointmentAsNoShow({
      appointmentId: id,
      organizationId,
      reason: reason || 'PATIENT_DID_NOT_ARRIVE',
      actorUserId: req.user?.id,
      ip: req.ip,
      sendNotice: sendNotice === true
    });

    res.json({
      message: 'Cita marcada como No-Show exitosamente',
      appointment
    });
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({ error: error.message });
  }
};

exports.getNoShowStats = async (req, res) => {
  try {
    const role = (req.user?.role || '').toUpperCase();
    if (role === 'PATIENT') {
      return res.status(403).json({ error: 'Acceso no autorizado a estadísticas operacionales de la clínica' });
    }

    const isSuperAdmin = role === 'SUPERADMIN' || role === 'PLATFORM_ADMIN';
    const organizationId = isSuperAdmin ? (req.query?.organizationId || req.user?.organizationId) : req.user?.organizationId;
    const { startDate, endDate } = req.query;

    const stats = await noShowAutomationService.getNoShowStats({
      organizationId,
      startDate,
      endDate
    });

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

