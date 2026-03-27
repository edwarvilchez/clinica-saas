/**
 * Appointment conflict validation utilities
 * Prevents overlapping appointments for doctors and patients
 */

const { Appointment } = require('../models');
const { Op } = require('sequelize');

const APPOINTMENT_DURATION_MINUTES = 30;

const checkDoctorConflict = async (doctorId, date, excludeId = null) => {
  const appointmentDate = new Date(date);
  const startTime = appointmentDate.getTime();
  const endTime = startTime + (APPOINTMENT_DURATION_MINUTES * 60 * 1000);

  const whereClause = {
    doctorId,
    status: {
      [Op.notIn]: ['Cancelled', 'NoShow']
    },
    date: {
      [Op.between]: [
        new Date(startTime - (APPOINTMENT_DURATION_MINUTES * 60 * 1000)),
        new Date(endTime)
      ]
    }
  };

  if (excludeId) {
    whereClause.id = { [Op.ne]: excludeId };
  }

  const conflict = await Appointment.findOne({ where: whereClause });

  return conflict;
};

const checkPatientConflict = async (patientId, date, excludeId = null) => {
  const appointmentDate = new Date(date);
  const startTime = appointmentDate.getTime();
  const endTime = startTime + (APPOINTMENT_DURATION_MINUTES * 60 * 1000);

  const whereClause = {
    patientId,
    status: {
      [Op.notIn]: ['Cancelled', 'NoShow']
    },
    date: {
      [Op.between]: [
        new Date(startTime - (APPOINTMENT_DURATION_MINUTES * 60 * 1000)),
        new Date(endTime)
      ]
    }
  };

  if (excludeId) {
    whereClause.id = { [Op.ne]: excludeId };
  }

  const conflict = await Appointment.findOne({ where: whereClause });

  return conflict;
};

const validateAppointment = async (doctorId, patientId, date, excludeId = null) => {
  const errors = [];

  const doctorConflict = await checkDoctorConflict(doctorId, date, excludeId);
  if (doctorConflict) {
    errors.push({
      field: 'doctorId',
      message: 'El doctor ya tiene una cita programada en este horario'
    });
  }

  const patientConflict = await checkPatientConflict(patientId, date, excludeId);
  if (patientConflict) {
    errors.push({
      field: 'patientId',
      message: 'El paciente ya tiene una cita programada en este horario'
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

module.exports = {
  checkDoctorConflict,
  checkPatientConflict,
  validateAppointment,
  APPOINTMENT_DURATION_MINUTES
};
