const { sanitizeString, sanitizeObject, shouldSanitize } = require('../../utils/sanitize');

describe('Sanitization Utilities', () => {
  describe('sanitizeString', () => {
    it('should remove SQL injection patterns', () => {
      expect(sanitizeString("'; DROP TABLE users;--")).toBe('');
      expect(sanitizeString('test" OR "1"="1')).toBe('test OR 11');
    });

    it('should remove SQL comments', () => {
      expect(sanitizeString('test--comment')).toBe('testcomment');
      expect(sanitizeString('test/*comment*/')).toBe('testcomment');
    });

    it('should preserve valid characters in names', () => {
      expect(sanitizeString("John O'Connor")).toBe("John OConnor");
      expect(sanitizeString('José María')).toBe('Jos Mara');
    });

    it('should handle non-string inputs', () => {
      expect(sanitizeString(123)).toBe(123);
      expect(sanitizeString(null)).toBe(null);
      expect(sanitizeString(undefined)).toBe(undefined);
    });
  });

  describe('shouldSanitize', () => {
    it('should skip sanitization for email fields', () => {
      expect(shouldSanitize('email')).toBe(false);
      expect(shouldSanitize('emailAddress')).toBe(false);
    });

    it('should skip sanitization for password fields', () => {
      expect(shouldSanitize('password')).toBe(false);
      expect(shouldSanitize('temporaryPassword')).toBe(false);
    });

    it('should skip sanitization for document fields', () => {
      expect(shouldSanitize('documentId')).toBe(false);
      expect(shouldSanitize('licenseNumber')).toBe(false);
    });

    it('should sanitize other fields', () => {
      expect(shouldSanitize('firstName')).toBe(true);
      expect(shouldSanitize('lastName')).toBe(true);
      expect(shouldSanitize('notes')).toBe(false);
    });
  });

  describe('sanitizeObject', () => {
    it('should sanitize all string fields except protected ones', () => {
      const input = {
        firstName: "John'; DROP--",
        email: "test@example.com",
        lastName: "O'Connor",
        notes: "'; DELETE FROM users--"
      };

      const result = sanitizeObject(input);

      expect(result.firstName).toBe('John DROP');
      expect(result.email).toBe('test@example.com');
      expect(result.lastName).toBe("O'Connor");
      expect(result.notes).toBe("'; DELETE FROM users--");
    });

    it('should handle nested objects', () => {
      const input = {
        patient: {
          firstName: "Robert'; DROP--",
          email: "patient@test.com"
        }
      };

      const result = sanitizeObject(input);

      expect(result.patient.firstName).toBe('Robert DROP');
      expect(result.patient.email).toBe('patient@test.com');
    });

    it('should handle arrays', () => {
      const input = {
        patients: [
          { firstName: "John"; DROP--", email: "john@test.com" },
          { firstName: "Jane'; DELETE--", email: "jane@test.com" }
        ]
      };

      const result = sanitizeObject(input);

      expect(result.patients[0].firstName).toBe('John DROP');
      expect(result.patients[0].email).toBe('john@test.com');
    });
  });
});
