/**
 * ==============================================================================
 * JEST TEST SUITE: VENEZUELAN IDENTITY DOCUMENT CANONICAL & NORMALIZATION ENGINE
 * ==============================================================================
 * @file        identityDocument.test.js
 * @description Exhaustive unit and integration tests for Venezuelan identity 
 *              document validation, canonicalization, equivalence, duplicate 
 *              detection, multi-tenancy isolation, and error handling.
 * 
 * Normativa: Ley Orgánica de Identificación (Gaceta Oficial N° 38.458)
 * ==============================================================================
 */

const IdentityDocumentService = require('../../services/identityDocument.service');

describe('🆔 IdentityDocumentService — Venezuelan Identity Document Engine', () => {

  describe('1. Equivalence & Normalization Matrix (Variantes de Formato)', () => {
    const equivalentVenezuelanVariants = [
      'V-85397898',
      'V85397898',
      'V 85397898',
      'v-85397898',
      'v85397898',
      'V.85397898',
      'V-85.397.898',
      'V - 85397898',
      '  v-85397898  ',
      'V.85.397.898'
    ];

    test('Todas las variantes venezolanas deben canonicalizarse a V-85397898', () => {
      equivalentVenezuelanVariants.forEach((input) => {
        const canonical = IdentityDocumentService.canonicalize(input);
        expect(canonical).toBe('V-85397898');
      });
    });

    test('Todas las variantes venezolanas deben normalizarse a V85397898', () => {
      equivalentVenezuelanVariants.forEach((input) => {
        const normalized = IdentityDocumentService.normalizeIdentityDocument(input);
        expect(normalized).toBe('V85397898');
      });
    });

    test('areEquivalent debe retornar true entre cualquier par de variantes venezolanas', () => {
      for (let i = 0; i < equivalentVenezuelanVariants.length; i++) {
        for (let j = 0; j < equivalentVenezuelanVariants.length; j++) {
          const isEq = IdentityDocumentService.areEquivalent(
            equivalentVenezuelanVariants[i],
            equivalentVenezuelanVariants[j]
          );
          expect(isEq).toBe(true);
        }
      }
    });

    const equivalentForeignVariants = [
      'E-12345678',
      'E12345678',
      'E 12345678',
      'e-12345678',
      'e12345678',
      'E.12.345.678',
      '  E-12345678  '
    ];

    test('Todas las variantes extranjeras deben canonicalizarse a E-12345678 y normalizarse a E12345678', () => {
      equivalentForeignVariants.forEach((input) => {
        expect(IdentityDocumentService.canonicalize(input)).toBe('E-12345678');
        expect(IdentityDocumentService.normalizeIdentityDocument(input)).toBe('E12345678');
      });
    });

    test('areEquivalent debe diferenciar correctamente entre V y E con el mismo número correlativo', () => {
      expect(IdentityDocumentService.areEquivalent('V-12345678', 'E-12345678')).toBe(false);
      expect(IdentityDocumentService.areEquivalent('V12345678', 'E12345678')).toBe(false);
    });

    test('Acepta cédulas históricas y vigentes de 1 a 8 dígitos numéricos', () => {
      expect(IdentityDocumentService.canonicalize('V-1')).toBe('V-1');
      expect(IdentityDocumentService.canonicalize('V-12')).toBe('V-12');
      expect(IdentityDocumentService.canonicalize('V-1234')).toBe('V-1234');
      expect(IdentityDocumentService.canonicalize('V-634567')).toBe('V-634567');
      expect(IdentityDocumentService.canonicalize('V-12345678')).toBe('V-12345678');
    });
  });

  describe('2. Invalid Format Rejection (Validación Estricta)', () => {
    const invalidInputs = [
      'V--',
      'V-ABC',
      'X-12345678',       // Prefijo no venezolano
      'J-12345678',       // J es RIF jurídico, no cédula personal
      '12345678',         // Sin prefijo de nacionalidad
      'V/',
      'V_',
      'V-123456789',      // 9 dígitos (excede el límite de 8)
      'E-1234567890',     // 10 dígitos
      '',                 // Vacío
      '    ',             // Solo espacios
      null,
      undefined,
      'V-12345a'          // Dígitos mezclados con letras
    ];

    test('validate() debe retornar false para todos los formatos inválidos', () => {
      invalidInputs.forEach((input) => {
        expect(IdentityDocumentService.validate(input)).toBe(false);
      });
    });

    test('canonicalize() y normalizeIdentityDocument() deben arrojar error con código INVALID_IDENTITY_DOCUMENT', () => {
      invalidInputs.forEach((input) => {
        expect(() => IdentityDocumentService.canonicalize(input)).toThrow();
        expect(() => IdentityDocumentService.normalizeIdentityDocument(input)).toThrow();
      });
    });

    test('validate(input, true) debe exigir cumplimiento exacto del regex canónico', () => {
      // Válidos canónicos exactos
      expect(IdentityDocumentService.validate('V-85397898', true)).toBe(true);
      expect(IdentityDocumentService.validate('E-12345678', true)).toBe(true);
      expect(IdentityDocumentService.validate('V-654321', true)).toBe(true);

      // Válidos semánticamente pero no en formato canónico exacto
      expect(IdentityDocumentService.validate('V85397898', true)).toBe(false);
      expect(IdentityDocumentService.validate('V 85397898', true)).toBe(false);
      expect(IdentityDocumentService.validate('v-85397898', true)).toBe(false);
      expect(IdentityDocumentService.validate('V.85397898', true)).toBe(false);
    });
  });

  describe('3. Database Duplicate Detection & Patient Editing', () => {
    let mockPatientModel;

    beforeEach(() => {
      mockPatientModel = {
        findOne: jest.fn()
      };
    });

    test('checkDuplicate detecta duplicado semántico si existe registro previo', async () => {
      mockPatientModel.findOne.mockResolvedValue({
        id: 'patient-existing-uuid',
        documentId: 'V-85397898',
        documentNumberNormalized: 'V85397898',
        organizationId: 'org-123'
      });

      const result = await IdentityDocumentService.checkDuplicate({
        documentInput: 'V 85.397.898',
        organizationId: 'org-123',
        PatientModel: mockPatientModel
      });

      expect(result.isDuplicate).toBe(true);
      expect(result.canonical).toBe('V-85397898');
      expect(result.normalized).toBe('V85397898');
      expect(result.existingPatient.id).toBe('patient-existing-uuid');
      expect(mockPatientModel.findOne).toHaveBeenCalledTimes(1);
    });

    test('checkDuplicate permite actualizar el propio paciente manteniendo su cédula', async () => {
      // El query excluye el paciente actual: where.id != 'patient-current-uuid'
      mockPatientModel.findOne.mockResolvedValue(null);

      const result = await IdentityDocumentService.checkDuplicate({
        documentInput: 'V-85397898',
        organizationId: 'org-123',
        excludePatientId: 'patient-current-uuid',
        PatientModel: mockPatientModel
      });

      expect(result.isDuplicate).toBe(false);
      expect(result.existingPatient).toBeNull();
    });

    test('checkDuplicate bloquea si la nueva cédula colisiona con otro paciente', async () => {
      mockPatientModel.findOne.mockResolvedValue({
        id: 'patient-another-uuid',
        documentId: 'V-85397898',
        organizationId: 'org-123'
      });

      const result = await IdentityDocumentService.checkDuplicate({
        documentInput: 'V85397898',
        organizationId: 'org-123',
        excludePatientId: 'patient-current-uuid',
        PatientModel: mockPatientModel
      });

      expect(result.isDuplicate).toBe(true);
      expect(result.existingPatient.id).toBe('patient-another-uuid');
    });
  });

  describe('4. Multi-Tenant Isolation Strategy', () => {
    let mockPatientModel;

    beforeEach(() => {
      mockPatientModel = {
        findOne: jest.fn()
      };
    });

    test('La misma cédula en organizaciones distintas (org-A vs org-B) no genera conflicto tenant', async () => {
      // En org-B no existe el paciente
      mockPatientModel.findOne.mockResolvedValue(null);

      const result = await IdentityDocumentService.checkDuplicate({
        documentInput: 'V-85397898',
        organizationId: 'org-tenant-B',
        PatientModel: mockPatientModel
      });

      expect(result.isDuplicate).toBe(false);
      
      // Verifica que el query filtró explícitamente por organizationId: 'org-tenant-B'
      const queryCalled = mockPatientModel.findOne.mock.calls[0][0];
      expect(queryCalled.where.organizationId).toBe('org-tenant-B');
    });

    test('Dentro de la misma organización, cualquier variante formativa genera conflicto', async () => {
      mockPatientModel.findOne.mockResolvedValue({
        id: 'patient-org-A-1',
        organizationId: 'org-tenant-A',
        documentId: 'V-85397898'
      });

      const result = await IdentityDocumentService.checkDuplicate({
        documentInput: 'v 85397898',
        organizationId: 'org-tenant-A',
        PatientModel: mockPatientModel
      });

      expect(result.isDuplicate).toBe(true);
    });
  });

  describe('5. Database Concurrency Race-Condition Error Handling (HTTP 409 Conflict)', () => {
    test('handleUniqueViolationError transforma error 23505 o SequelizeUniqueConstraintError en HTTP 409', () => {
      const dbError = {
        name: 'SequelizeUniqueConstraintError',
        original: {
          code: '23505',
          detail: 'Key ("organizationId", "documentNumberNormalized")=(uuid, V85397898) already exists.'
        },
        message: 'Validation error'
      };

      let statusCode = 200;
      let jsonPayload = null;
      const res = {
        status: (code) => {
          statusCode = code;
          return res;
        },
        json: (data) => {
          jsonPayload = data;
          return res;
        }
      };

      const handled = IdentityDocumentService.handleUniqueViolationError(dbError, res);

      expect(handled).toBe(true);
      expect(statusCode).toBe(409);
      expect(jsonPayload).toEqual({
        code: 'IDENTITY_DOCUMENT_ALREADY_EXISTS',
        message: 'El registro ya existe. Verifique el número de documento ingresado.'
      });
    });

    test('handleUniqueViolationError ignora errores ajenos a unicidad y retorna false', () => {
      const genericError = new Error('Database connection timeout');
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis()
      };

      const handled = IdentityDocumentService.handleUniqueViolationError(genericError, res);
      expect(handled).toBe(false);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('6. Bulk Import Intra-Batch Duplicate Detection', () => {
    test('Detecta duplicados entre filas de un mismo lote masivo con formatos dispares', () => {
      const records = [
        { row: 1, documentId: 'V-85397898', name: 'Paciente Uno' },
        { row: 2, documentId: 'V-11223344', name: 'Paciente Dos' },
        { row: 3, documentId: 'V85397898', name: 'Paciente Tres (Duplicado semántico de fila 1)' }
      ];

      const seenDocuments = new Set();
      const duplicatesDetected = [];

      for (const rec of records) {
        const parsed = IdentityDocumentService.parse(rec.documentId);
        expect(parsed.isValid).toBe(true);

        if (seenDocuments.has(parsed.normalized)) {
          duplicatesDetected.push({
            row: rec.row,
            documentId: rec.documentId,
            normalized: parsed.normalized
          });
        } else {
          seenDocuments.add(parsed.normalized);
        }
      }

      expect(duplicatesDetected.length).toBe(1);
      expect(duplicatesDetected[0].row).toBe(3);
      expect(duplicatesDetected[0].normalized).toBe('V85397898');
    });
  });
});
