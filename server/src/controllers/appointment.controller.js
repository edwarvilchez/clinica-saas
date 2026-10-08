const { Appointment, Patient, Doctor, User } = require('../models');
const { Op } = require('sequelize');
const whatsapp = require('../utils/whatsapp.service');
const { validateAppointment } = require('../utils/appointmentValidator');
const auditService = require('../services/audit.service');

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

    const appointment = await Appointment.create({
      patientId,
      doctorId,
      date,
      reason,
      notes,
      status: 'Confirmed',
      organizationId
    });

    // Fetch details for WhatsApp
    const appointmentDetails = await Appointment.findByPk(appointment.id, {
      include: [
        { model: Patient, include: [User] },
        { model: Doctor, include: [User] }
      ]
    });

    const patientPhone = appointmentDetails.Patient.phone;
    const patientName = `${appointmentDetails.Patient.User.firstName} ${appointmentDetails.Patient.User.lastName}`;
    const doctorName = `${appointmentDetails.Doctor.User.firstName} ${appointmentDetails.Doctor.User.lastName}`;
    const appointmentDate = new Date(date);
    
    // Send WhatsApp with Calendar Link
    whatsapp.sendAppointmentConfirmation(patientPhone, {
      patientName,
      doctorName,
      date: appointmentDate.toLocaleDateString(),
      time: appointmentDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      appointmentId: appointment.id,
      rawDate: appointmentDate
    }).catch(err => console.error('WhatsApp Error:', err));

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
    const adminRoles = ['SUPERADMIN', 'SUPERADMIN', 'ADMINISTRATIVE', 'NURSE', 'RECEPTIONIST'];

    // Dynamic Include for Doctor to filter by Organization
    let doctorUserInclude = { model: User, attributes: ['id', 'firstName', 'lastName', 'email', 'organizationId'] };

    // If not SUPERADMIN / PLATFORM_ADMIN and belongs to an Organization, filter Doctors by that Organization
    const isSuperAdmin = userRole === 'SUPERADMIN' || userRole === 'PLATFORM_ADMIN';
    if (organizationId && !isSuperAdmin) {
        doctorUserInclude.where = { organizationId };
    }

    if (adminRoles.includes(userRole)) {
        // Admin Roles: See all appointments in their Organization (via Doctor filter above)
        whereClause = {};
    } else {
        // Doctor or Patient: Specific filtering
        const conditions = [];

        if (userRole === 'PATIENT') {
             const patient = await Patient.findOne({ where: { userId } });
             if (patient) conditions.push({ patientId: patient.id });
        } else if (userRole === 'DOCTOR') {
             const doctor = await Doctor.findOne({ where: { userId } });
             if (doctor) conditions.push({ doctorId: doctor.id });
        }

        if (conditions.length > 0) {
            whereClause = { [Op.or]: conditions };
        } else {
            return res.json({ appointments: [], totalPages: 0, currentPage: 1, total: 0 });
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
      distinct: true // Para contar correctamente con includes
    });

    res.json({
      appointments: rows,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      total: count,
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
    
    // Get old data for audit with organization check
    const whereClause = { id };
    if (!isSuperAdmin && organizationId) {
      whereClause.organizationId = organizationId;
    }

    const oldAppointment = await Appointment.findOne({ where: whereClause });
    if (!oldAppointment) return res.status(404).json({ error: 'Cita no encontrada o acceso no autorizado' });

    await Appointment.update({ status }, { where: whereClause });
    
    const updatedAppointment = await Appointment.findOne({ where: whereClause });

    // Handle specific status updates (like cancellation) if done via this generic endpoint
    if (status === 'Cancelled') {
        const appointment = await Appointment.findOne({
            where: whereClause,
            include: [{ model: Patient, include: [User] }]
        });
        
        if (appointment) {
            const dateObj = new Date(appointment.date);
            whatsapp.sendCancellationNotice(appointment.Patient.User.phone, {
                patientName: appointment.Patient.User.firstName,
                date: dateObj.toLocaleDateString(),
                time: dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }).catch(e => console.error(e));
        }
    }

    // Tamper-evident Audit Log: Status update
    auditService.logEvent({
      action: 'UPDATE_APPOINTMENT_STATUS',
      entity: 'Appointment',
      entityId: id,
      organizationId,
      actorUserId: req.user?.id,
      oldValues: { status: oldAppointment.status },
      newValues: { status },
      ip: req.ip
    }).catch(err => console.error('Audit update appointment error:', err));

    res.json({ message: 'Status updated' });
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

        const appointment = await Appointment.findOne({
            where: whereClause,
            include: [{ model: Patient, include: [User] }]
        });
        if (!appointment) return res.status(404).json({ error: 'Cita no encontrada o acceso no autorizado' });

        const oldValues = appointment.toJSON();
        appointment.status = 'Cancelled';
        await appointment.save();

        const dateObj = new Date(appointment.date);
        
        // Notify patient
        whatsapp.sendCancellationNotice(appointment.Patient.User.phone, {
            patientName: appointment.Patient.User.firstName,
            date: dateObj.toLocaleDateString(),
            time: dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });

        // Tamper-evident Audit Log: Appointment cancellation
        auditService.logEvent({
          action: 'CANCEL_APPOINTMENT',
          entity: 'Appointment',
          entityId: id,
          organizationId,
          actorUserId: req.user?.id,
          oldValues: { status: oldValues.status },
          newValues: { status: 'Cancelled' },
          ip: req.ip
        }).catch(err => console.error('Audit cancel appointment error:', err));

        res.json({ message: 'Cita cancelada con éxito' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.rescheduleAppointment = async (req, res) => {
    try {
        const { id } = req.params;
        const { newDate } = req.body;
        
        const appointment = await Appointment.findByPk(id, {
             include: [
                { model: Patient, include: [User] },
                { model: Doctor, include: [User] }
            ]
        });

        if (!appointment) return res.status(404).json({ error: 'Cita no encontrada' });

        const oldValues = appointment.toJSON();
        appointment.date = newDate;
        appointment.status = 'Confirmed'; // Re-confirm if it was cancelled
        appointment.reminderSent = false; // Reset reminder
        await appointment.save();

        const patientName = `${appointment.Patient.User.firstName} ${appointment.Patient.User.lastName}`;
        const doctorName = `${appointment.Doctor.User.firstName} ${appointment.Doctor.User.lastName}`;
        const appointmentDate = new Date(newDate);

        // Send new confirmation
        whatsapp.sendAppointmentConfirmation(appointment.Patient.User.phone, {
            patientName,
            doctorName,
            date: appointmentDate.toLocaleDateString(),
            time: appointmentDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            appointmentId: appointment.id,
            rawDate: appointmentDate
        });

        res.json({ message: 'Cita reagendada con éxito', appointment });
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

