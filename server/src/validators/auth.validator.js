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
    'string.min': 'Username debe tener al menos 3 caracteres',
    'string.max': 'Username no puede exceder 50 caracteres',
    'any.required': 'Username es requerido',
  }),
  email: Joi.string().email().required().messages({
    'string.email': 'Email debe ser válido',
    'any.required': 'Email es requerido',
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
  firstName: Joi.string().min(2).max(100).required().messages({
    'string.min': 'Nombre debe tener al menos 2 caracteres',
    'any.required': 'Nombre es requerido',
  }),
  lastName: Joi.string().min(2).max(100).required().messages({
    'string.min': 'Apellido debe tener al menos 2 caracteres',
    'any.required': 'Apellido es requerido',
  }),
  phone: Joi.string()
    .pattern(/^[+]?[\d\s-()]+$/)
    .min(7)
    .max(20)
    .optional()
    .messages({
      'string.pattern.base': 'Teléfono debe contener solo números y caracteres válidos',
    }),
  dateOfBirth: Joi.date().max('now').optional().messages({
    'date.max': 'Fecha de nacimiento no puede ser en el futuro',
  }),
  gender: Joi.string().valid('M', 'F', 'Other').optional(),
  address: Joi.string().max(255).optional(),
  bloodType: Joi.string()
    .valid('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')
    .optional(),
});

const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Email debe ser válido',
    'any.required': 'Email es requerido',
  }),
});

const resetPasswordSchema = Joi.object({
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
