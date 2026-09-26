const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Clinica - SaaS API',
      version: '4.3.1',
      description: 'API REST para sistema de gestión de clínica SaaS',
      contact: {
        name: 'Clinica - SaaS',
        email: 'soporte@clinicasaas.com'
      }
    },
    servers: [
      {
        url: process.env.API_URL || 'http://localhost:5001',
        description: 'Servidor de Desarrollo'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            email: { type: 'string', format: 'email' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            role: { type: 'string', enum: ['SUPERADMIN', 'ADMIN', 'DOCTOR', 'NURSE', 'PATIENT', 'ADMINISTRATIVE'] }
          }
        },
        Appointment: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            patientId: { type: 'integer' },
            doctorId: { type: 'integer' },
            date: { type: 'string', format: 'date-time' },
            status: { type: 'string', enum: ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'] }
          }
        },
        Patient: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            userId: { type: 'integer' },
            bloodType: { type: 'string' },
            allergies: { type: 'string' }
          }
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    },
    security: [{
      bearerAuth: []
    }]
  },
  apis: ['./src/routes/*.js', './src/controllers/*.js']
};

module.exports = swaggerJsdoc(options);
