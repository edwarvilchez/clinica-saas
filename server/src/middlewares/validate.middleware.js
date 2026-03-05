const logger = require('../utils/logger');

/**
 * Middleware de validación genérico usando Joi
 * @param {Object} schema - Schema de Joi para validar
 * @param {String} property - Propiedad del request a validar (body, params, query)
 * @returns {Function} Express middleware
 */
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false, // Retornar todos los errores, no solo el primero
      stripUnknown: true, // Remover campos no definidos en el schema
    });

    if (error) {
      const errorMessages = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      logger.warn({
        validationErrors: errorMessages,
        path: req.path,
        method: req.method,
      }, 'Validation error');

      return res.status(400).json({
        message: errorMessages[0]?.message || 'Error de validación en los datos enviados.',
        errors: errorMessages,
      });
    }

    // Reemplazar con valores validados y sanitizados
    req[property] = value;
    next();
  };
};

module.exports = validate;
