const { Appointment, Patient, Doctor, User } = require('../models');
const { Op } = require('sequelize');
const whatsapp = require('../utils/whatsapp.service');
const { validateAppointment } = require('../utils/appointmentValidator');

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
    
    const appointment = await Appointment.create({
      patientId,
      doctorId,
      date,
      reason,
      notes,
      status: 'Confirmed'
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
    const adminRoles = ['SUPER_ADMIN', 'SUPERADMIN', 'ADMINISTRATIVE', 'NURSE', 'RECEPTIONIST'];

    // Dynamic Include for Doctor to filter by Organization
    let doctorUserInclude = { model: User, attributes: ['id', 'firstName', 'lastName', 'email', 'organizationId'] };

    // If not SUPER_ADMIN and belongs to an Organization, filter Doctors by that Organization
    const isSuperAdmin = userRole === 'SUPER_ADMIN' || userRole === 'SUPERADMIN';
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
    await Appointment.update({ status }, { where: { id } });
    
    // Handle specific status updates (like cancellation) if done via this generic endpoint
    if (status === 'Cancelled') {
        const appointment = await Appointment.findByPk(id, {
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

    res.json({ message: 'Status updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.cancelAppointment = async (req, res) => {
    try {
        const { id } = req.params;
        const appointment = await Appointment.findByPk(id, {
            include: [{ model: Patient, include: [User] }]
        });

        if (!appointment) return res.status(404).json({ error: 'Cita no encontrada' });

        appointment.status = 'Cancelled';
        await appointment.save();

        const dateObj = new Date(appointment.date);
        
        // Notify patient
        whatsapp.sendCancellationNotice(appointment.Patient.User.phone, {
            patientName: appointment.Patient.User.firstName,
            date: dateObj.toLocaleDateString(),
            time: dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });

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
