const Joi = require('joi');

const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Email debe ser válido',
    'any.required': 'Email es requerido',
  }),
  password: Joi.string().min(6).required().messages({
    'string.min': 'Password debe tener al menos 6 caracteres',
    'any.required': 'Password es requerido',
  }),
});

const registerSchema = Joi.object({
  username: Joi.string().min(3).max(50).required().messages({
    'string.min': 'El nombre de usuario debe tener al menos 3 caracteres',
    'string.max': 'El nombre de usuario no puede exceder 50 caracteres',
    'any.required': 'El nombre de usuario es requerido',
  }),
  email: Joi.string().email().required().messages({
    'string.email': 'El correo electrónico no es válido',
    'any.required': 'El correo electrónico es requerido',
  }),
  // No se valida password: el servidor la genera automáticamente (Opción B)
  password: Joi.string().optional().allow('', null),
  firstName: Joi.string().min(2).max(100).required().messages({
    'string.min': 'El nombre debe tener al menos 2 caracteres',
    'any.required': 'El nombre es requerido',
  }),
  lastName: Joi.string().min(2).max(100).required().messages({
    'string.min': 'El apellido debe tener al menos 2 caracteres',
    'any.required': 'El apellido es requerido',
  }),
  phone: Joi.string()
    .pattern(/^[+]?[\d\s-()]+$/)
    .min(7)
    .max(20)
    .optional()
    .allow('')
    .messages({
      'string.pattern.base': 'El teléfono debe contener solo números y caracteres válidos (+, -, espacios)',
    }),
  dateOfBirth: Joi.date().max('now').optional().allow(null, '').messages({
    'date.max': 'La fecha de nacimiento no puede ser en el futuro',
  }),
  gender: Joi.string().valid('M', 'F', 'Male', 'Female', 'Other').optional().allow(''),
  address: Joi.string().max(255).optional().allow(''),
  bloodType: Joi.string()
    .valid('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')
    .optional()
    .allow(''),
  // Campos adicionales del formulario de registro extendido
  accountType: Joi.string().valid('PATIENT', 'PROFESSIONAL', 'CLINIC', 'HOSPITAL').optional(),
  businessName: Joi.string().max(200).optional().allow(''),
  licenseNumber: Joi.string().max(100).optional().allow(''),
  acceptTerms: Joi.boolean().optional(),
  patientData: Joi.object({
    documentId: Joi.string().optional().allow(''),
    phone: Joi.string().optional().allow(''),
    birthDate: Joi.string().optional().allow('', null),
    gender: Joi.string().optional().allow(''),
    address: Joi.string().optional().allow(''),
    bloodType: Joi.string().optional().allow(''),
    allergies: Joi.string().optional().allow(''),
  }).optional(),
});

const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Email debe ser válido',
    'any.required': 'Email es requerido',
  }),
});

const resetPasswordSchema = Joi.object({
  token: Joi.string().required().messages({
    'any.required': 'Token es requerido',
  }),
  password: Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .required()
    .messages({
      'string.min': 'Password debe tener al menos 8 caracteres',
      'string.pattern.base': 'Password debe contener al menos una mayúscula, una minúscula y un número',
      'any.required': 'Password es requerido',
    }),
  confirmPassword: Joi.string().valid(Joi.ref('password')).required().messages({
    'any.only': 'Las contraseñas no coinciden',
    'any.required': 'Confirmación de password es requerida',
  }),
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required().messages({
    'any.required': 'La contraseña actual es requerida',
  }),
  newPassword: Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .required()
    .messages({
      'string.min': 'La nueva contraseña debe tener al menos 8 caracteres',
      'string.pattern.base': 'La nueva contraseña debe contener al menos una mayúscula, una minúscula y un número',
      'any.required': 'La nueva contraseña es requerida',
    }),
});

module.exports = {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
};
