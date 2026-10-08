'use strict';

/**
 * 🆔 IdentityDocumentService — Servicio Canónico de Documentos de Identidad Venezolanos
 * 
 * Marco Normativo Aplicable:
 * - Ley Orgánica de Identificación (Gaceta Oficial N° 38.458 del 14 de junio de 2006).
 *   Distinción legal: Las personas venezolanas se identifican con 'V' y las extranjeras con 'E',
 *   seguidas de su numeración correlativa inherente e individual.
 * - Regla de Diseño y Consistencia del Sistema:
 *   Formato Canónico Persistido y Visualizado: 'V-########' o 'E-########'
 *   Formato Normalizado para Unicidad y Búsqueda: 'V########' o 'E########'
 *   Longitud Numérica: 1 a 8 dígitos (permite cédulas históricas y vigentes).
 */

const CANONICAL_REGEX = /^[VE]-[0-9]{1,8}$/;
const STRICT_8_DIGITS_REGEX = /^[VE]-[0-9]{8}$/;

class IdentityDocumentService {
  /**
   * Expresión regular canónica estándar del sistema (1 a 8 dígitos)
   */
  static get CANONICAL_REGEX() {
    return CANONICAL_REGEX;
  }

  /**
   * Expresión regular estricta de 8 dígitos
   */
  static get STRICT_8_DIGITS_REGEX() {
    return STRICT_8_DIGITS_REGEX;
  }

  /**
   * Analiza y extrae las componentes de un documento de identidad venezolano.
   * Acepta variantes como: 'V-85397898', 'V85397898', 'v 85.397.898', 'E-12345678', etc.
   * 
   * @param {string|number} input 
   * @returns {{
   *   isValid: boolean,
   *   isCanonical: boolean,
   *   prefix: string|null,
   *   number: string|null,
   *   canonical: string|null,
   *   normalized: string|null,
   *   raw: string,
   *   error: string|null
   * }}
   */
  static parse(input) {
    if (input === null || input === undefined) {
      return {
        isValid: false,
        isCanonical: false,
        prefix: null,
        number: null,
        canonical: null,
        normalized: null,
        raw: '',
        error: 'El documento de identidad no puede estar vacío.'
      };
    }

    const raw = String(input).trim();
    if (!raw) {
      return {
        isValid: false,
        isCanonical: false,
        prefix: null,
        number: null,
        canonical: null,
        normalized: null,
        raw,
        error: 'El documento de identidad no puede estar vacío.'
      };
    }

    // Comprobar si ya cumple estrictamente el formato canónico
    const isCanonical = CANONICAL_REGEX.test(raw);

    // Normalizar: mayúsculas y remover espacios intermedios
    const upper = raw.toUpperCase().replace(/\s+/g, '');

    // Rechazar caracteres prohibidos como letras intermedias o caracteres no válidos
    // Patrón aceptable: Letra V o E inicial, separadores opcionales (guiones, puntos), y dígitos
    // Si contiene caracteres extraños como letras al final, barras, signos de puntuación extraños, es inválido
    const cleanPattern = /^[VE]?[-.:/ ]*([0-9]+[-.:0-9]*)$/;
    const hasForbiddenChars = /[^\dVE\-.:/ ]/i.test(raw);
    if (hasForbiddenChars) {
      return {
        isValid: false,
        isCanonical: false,
        prefix: null,
        number: null,
        canonical: null,
        normalized: null,
        raw,
        error: 'El documento de identidad no tiene un formato válido. Utilice V-12345678 o E-12345678.'
      };
    }

    // Extraer prefijo
    let prefix = null;
    let remainder = upper;

    if (upper.startsWith('V')) {
      prefix = 'V';
      remainder = upper.slice(1);
    } else if (upper.startsWith('E')) {
      prefix = 'E';
      remainder = upper.slice(1);
    } else {
      // Sin prefijo: rechazar porque no cumple con la identificación de nacionalidad
      return {
        isValid: false,
        isCanonical: false,
        prefix: null,
        number: null,
        canonical: null,
        normalized: null,
        raw,
        error: 'El documento debe especificar la nacionalidad (V para Venezolano, E para Extranjero).'
      };
    }

    // Extraer solo dígitos numéricos del remanente
    const digits = remainder.replace(/[^0-9]/g, '');

    // Validar que existan dígitos y que la longitud esté en el rango de 1 a 8
    if (!digits || digits.length === 0) {
      return {
        isValid: false,
        isCanonical: false,
        prefix,
        number: null,
        canonical: null,
        normalized: null,
        raw,
        error: 'El documento de identidad debe contener un número de cédula válido.'
      };
    }

    if (digits.length > 8) {
      return {
        isValid: false,
        isCanonical: false,
        prefix,
        number: digits,
        canonical: null,
        normalized: null,
        raw,
        error: 'El número de cédula no puede exceder 8 dígitos.'
      };
    }

    const canonical = `${prefix}-${digits}`;
    const normalized = `${prefix}${digits}`;

    return {
      isValid: true,
      isCanonical,
      prefix,
      number: digits,
      canonical,
      normalized,
      raw,
      error: null
    };
  }

  /**
   * Normaliza cualquier variante de entrada a su forma comparable sin guiones ni puntos.
   * Ejemplos:
   * 'V-85397898' -> 'V85397898'
   * 'v85397898'  -> 'V85397898'
   * 'V 85.397.898' -> 'V85397898'
   * 
   * @param {string|number} input
   * @returns {string} Forma normalizada para búsqueda/unicidad
   * @throws {Error} Si el formato es inválido
   */
  static normalizeIdentityDocument(input) {
    const parsed = this.parse(input);
    if (!parsed.isValid) {
      const err = new Error(parsed.error || 'El documento de identidad no tiene un formato válido. Utilice V-12345678 o E-12345678.');
      err.code = 'INVALID_IDENTITY_DOCUMENT';
      throw err;
    }
    return parsed.normalized;
  }

  /**
   * Convierte cualquier variante válida a su forma canónica oficial del sistema ('V-########' o 'E-########').
   * 
   * @param {string|number} input
   * @returns {string} Forma canónica persistible
   * @throws {Error} Si el formato es inválido
   */
  static canonicalize(input) {
    const parsed = this.parse(input);
    if (!parsed.isValid) {
      const err = new Error(parsed.error || 'El documento de identidad no tiene un formato válido. Utilice V-12345678 o E-12345678.');
      err.code = 'INVALID_IDENTITY_DOCUMENT';
      throw err;
    }
    return parsed.canonical;
  }

  /**
   * Valida si un documento tiene formato canónico estricto o puede ser canonicalizado.
   * 
   * @param {string} input 
   * @param {boolean} strict Si es true, exige que el input sea exactamente '^[VE]-[0-9]{1,8}$'
   * @returns {boolean}
   */
  static validate(input, strict = false) {
    if (strict) {
      return typeof input === 'string' && CANONICAL_REGEX.test(input.trim());
    }
    const parsed = this.parse(input);
    return parsed.isValid;
  }

  /**
   * Compara dos entradas de documento para determinar si representan a la misma persona física.
   * 
   * @param {string} docA 
   * @param {string} docB 
   * @returns {boolean}
   */
  static areEquivalent(docA, docB) {
    const parsedA = this.parse(docA);
    const parsedB = this.parse(docB);
    if (!parsedA.isValid || !parsedB.isValid) return false;
    return parsedA.normalized === parsedB.normalized;
  }

  /**
   * Verifica la existencia de duplicados en la base de datos dentro del contexto de organización (multi-tenant).
   * 
   * @param {Object} options
   * @param {string} options.documentInput Entrada cruda o canónica
   * @param {string|null} options.organizationId ID de la organización (tenant)
   * @param {string|null} [options.excludePatientId] ID del paciente a excluir en caso de edición
   * @param {Object} [options.PatientModel] Modelo Patient de Sequelize (opcional, carga por defecto)
   * @param {Object} [options.transaction] Transacción Sequelize opcional
   * @returns {Promise<{ isDuplicate: boolean, existingPatient: Object|null, canonical: string, normalized: string }>}
   */
  static async checkDuplicate({
    documentInput,
    organizationId,
    excludePatientId = null,
    PatientModel = null,
    transaction = null
  }) {
    const parsed = this.parse(documentInput);
    if (!parsed.isValid) {
      const err = new Error(parsed.error);
      err.code = 'INVALID_IDENTITY_DOCUMENT';
      throw err;
    }

    const Patient = PatientModel || require('../models').Patient;
    const { Op } = require('sequelize');

    const where = {
      [Op.or]: [
        { documentNumberNormalized: parsed.normalized },
        { documentId: parsed.canonical },
        { documentId: parsed.normalized }
      ]
    };

    // Aislamiento Multi-Tenant:
    // Si organizationId está presente, busca dentro de la organización o pacientes globales (org NULL)
    if (organizationId) {
      where.organizationId = organizationId;
    } else {
      where.organizationId = null;
    }

    if (excludePatientId) {
      where.id = { [Op.ne]: excludePatientId };
    }

    const queryOpts = { where };
    if (transaction) queryOpts.transaction = transaction;

    const existingPatient = await Patient.findOne(queryOpts);

    return {
      isDuplicate: !!existingPatient,
      existingPatient,
      canonical: parsed.canonical,
      normalized: parsed.normalized
    };
  }

  /**
   * Transforma una excepción de base de datos (ej. violación de UNIQUE constraint)
   * en una respuesta HTTP 409 Conflict uniforme y predecible.
   * 
   * @param {Error} error 
   * @param {Object} res Response de Express
   * @returns {boolean} true si fue manejado como duplicado, false en caso contrario
   */
  static handleUniqueViolationError(error, res) {
    const isUniqueViolation = 
      error.name === 'SequelizeUniqueConstraintError' ||
      error.original?.code === '23505' ||
      (error.message && error.message.includes('unique constraint')) ||
      (error.message && error.message.includes('uq_patients'));

    if (isUniqueViolation) {
      res.status(409).json({
        code: 'IDENTITY_DOCUMENT_ALREADY_EXISTS',
        message: 'El registro ya existe. Verifique el número de documento ingresado.'
      });
      return true;
    }
    return false;
  }
}

module.exports = IdentityDocumentService;
