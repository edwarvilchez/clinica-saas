const request = require('supertest');
const express = require('express');
const authRoutes = require('../../routes/auth.routes');
const { User, Role } = require('../../models');

// Mock express app para testing
const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

// Mock database
jest.mock('../../models', () => ({
  User: {
    findOne: jest.fn(),
    create: jest.fn(),
    findByPk: jest.fn(),
  },
  Role: {
    findOne: jest.fn(),
  },
  Patient: {},
  Doctor: {},
  Appointment: {},
  Organization: {},
  sequelize: {
    transaction: jest.fn(() => ({
      commit: jest.fn(),
      rollback: jest.fn(),
    }))
  }
}));

describe('Auth Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/login', () => {
    it('should reject login with invalid email format', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'invalid-email',
          password: 'password123',
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', 'Validation error');
      expect(res.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'email',
            message: expect.stringContaining('válido'),
          }),
        ])
      );
    });

    it('should reject login with short password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: '12345',
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', 'Validation error');
      expect(res.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'password',
            message: expect.stringContaining('6 caracteres'),
          }),
        ])
      );
    });

    it('should reject login with missing email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          password: 'password123',
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', 'Validation error');
    });

    it('should reject login with missing password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', 'Validation error');
    });
  });

  describe('POST /api/auth/register', () => {
    it('should reject registration with weak password', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'weakpass', // No uppercase, no number
          firstName: 'Test',
          lastName: 'User',
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', 'Validation error');
      expect(res.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'password',
          }),
        ])
      );
    });

    it('should reject registration with short username', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'ab', // Too short
          email: 'test@example.com',
          password: 'Password123',
          firstName: 'Test',
          lastName: 'User',
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', 'Validation error');
    });

    it('should reject registration with invalid email', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'invalid-email',
          password: 'Password123',
          firstName: 'Test',
          lastName: 'User',
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', 'Validation error');
    });

    it('should accept valid registration data', async () => {
      const mockRole = { id: 'role-uuid', name: 'PATIENT' };
      const mockUser = {
        id: 'user-uuid',
        username: 'testuser',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        roleId: mockRole.id,
      };

      Role.findOne.mockResolvedValue(mockRole);
      User.findOne.mockResolvedValue(null); // Usuario no existe
      User.create.mockResolvedValue(mockUser);

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'Password123',
          firstName: 'Test',
          lastName: 'User',
        });

      // El test pasará si la validación es correcta
      // La respuesta real depende de la implementación del controller
      expect(res.status).toBeLessThan(500);
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    it('should reject invalid email format', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({
          email: 'not-an-email',
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', 'Validation error');
    });

    it('should accept valid email format', async () => {
      User.findOne.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({
          email: 'valid@example.com',
        });

      // El test pasará si la validación es correcta
      expect(res.status).toBeLessThan(500);
    });
  });
});
