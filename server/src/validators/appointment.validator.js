const Joi = require('joi');

const createAppointmentSchema = Joi.object({
  patientId: Joi.string().uuid().required().messages({
    'string.guid': 'Patient ID debe ser un UUID válido',
    'any.required': 'Patient ID es requerido',
  }),
  doctorId: Joi.string().uuid().required().messages({
    'string.guid': 'Doctor ID debe ser un UUID válido',
    'any.required': 'Doctor ID es requerido',
  }),
  appointmentDate: Joi.date().iso().min('now').required().messages({
    'date.min': 'La fecha de la cita no puede ser en el pasado',
    'any.required': 'Fecha de la cita es requerida',
  }),
  appointmentTime: Joi.string()
    .pattern(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .required()
    .messages({
      'string.pattern.base': 'Hora debe estar en formato HH:MM (24h)',
      'any.required': 'Hora de la cita es requerida',
    }),
  reason: Joi.string().max(500).optional().messages({
    'string.max': 'Razón no puede exceder 500 caracteres',
  }),
  notes: Joi.string().max(1000).optional().messages({
    'string.max': 'Notas no pueden exceder 1000 caracteres',
  }),
  status: Joi.string()
    .valid('Pending', 'Confirmed', 'Completed', 'Cancelled')
    .optional()
    .default('Pending'),
  type: Joi.string().valid('In-Person', 'Video').optional().default('In-Person'),
});

const updateAppointmentSchema = Joi.object({
  appointmentDate: Joi.date().iso().optional(),
  appointmentTime: Joi.string()
    .pattern(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .optional(),
  reason: Joi.string().max(500).optional(),
  notes: Joi.string().max(1000).optional(),
  status: Joi.string()
    .valid('Pending', 'Confirmed', 'Completed', 'Cancelled')
    .optional(),
  type: Joi.string().valid('In-Person', 'Video').optional(),
}).min(1); // Al menos un campo debe ser actualizado

const appointmentIdSchema = Joi.object({
  id: Joi.string().uuid().required().messages({
    'string.guid': 'ID debe ser un UUID válido',
    'any.required': 'ID es requerido',
  }),
});

module.exports = {
  createAppointmentSchema,
  updateAppointmentSchema,
  appointmentIdSchema,
};
