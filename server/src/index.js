const express = require('express');
const http = require('http');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();
const sequelize = require('./config/db.config');
const models = require('./models');
const seedRoles = require('./utils/seeder');
const seedTestData = require('./utils/testSeeder');
const { initializeSocket } = require('./sockets/videoSocket');
const logger = require('./utils/logger');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const { sanitizeInput } = require('./utils/sanitize');
const checkSubscription = require('./middlewares/subscription.middleware');
const authMiddleware = require('./middlewares/auth.middleware');
const validateEnv = require('./utils/validateEnv');
const { initializeDatabase } = require('./utils/migrationManager');

// Validate Environment before anything else
validateEnv();

const app = express();
// Enable Trust Proxy for Easypanel/Nginx/Cloudflare/Supabase
app.set('trust proxy', 1); 
const server = http.createServer(app);

// Swagger Configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'MEDICALCARE 888 API',
      version: '2.1.0',
      description: 'Sistema integral de gestión clínica y hospitalaria profesional',
      contact: {
        name: 'CGK 888 Digital Ecosystem',
        email: 'ecosystem@cgk888.com',
      },
    },
    servers: [
      {
        url: process.env.API_URL || 'http://localhost:5000',
        description: 'Production/Development API',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./src/routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// 1. CORS - Improved with medicalcare-888.com
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      process.env.CLIENT_URL,
      /^https?:\/\/localhost(:\d+)?$/,
      /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
      /medicalcare-888\.com$/, // NEW: Support for production domain
      /easypanel\.host$/,
      /nominusve\.com$/
    ];

    if (!origin) return callback(null, true);

    const isAllowed = allowedOrigins.some(allowed => {
      if (!allowed) return false;
      if (allowed instanceof RegExp) return allowed.test(origin);
      const sanitizedOrigin = origin.toLowerCase().trim().replace(/\/$/, '');
      const sanitizedAllowed = allowed.toString().toLowerCase().trim().replace(/\/$/, '');
      return sanitizedAllowed === sanitizedOrigin;
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      logger.warn({ blockedOrigin: origin }, 'CORS Blocked');
      if (process.env.NODE_ENV !== 'production') return callback(null, true);
      callback(new Error(`CORS Error: Origin ${origin} not allowed`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-auth-token'],
};

app.use(cors(corsOptions));

// 2. Performance & Security Middlewares
app.use(compression()); // Gzip compression
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100, // Slightly more permissive for medical workflows
  message: 'Demasiados intentos, intente en 15 minutos',
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300, 
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/', apiLimiter);

// 3. Parser & Sanitization
app.use(express.json({ limit: '50kb' })); // Increased limit for detailed medical records
app.use(express.urlencoded({ extended: true, limit: '50kb' }));
app.use(sanitizeInput);
app.use('/uploads', express.static('uploads'));

// Swagger UI
if (process.env.NODE_ENV !== 'production') {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'MedicalCare 888 API Docs',
  }));
}

// Routes registration
app.use('/api/public', require('./routes/public.routes'));
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/organization', require('./routes/organization.routes'));

// Protected Routes
const routes = [
  'appointment', 'patient', 'doctor', 'nurse', 'staff', 
  'medicalRecord', 'labResult', 'stats', 'specialty', 
  'videoConsultation', 'bulk', 'team', 'drug', 
  'prescription', 'labCatalog', 'exchange'
];

routes.forEach(route => {
  const routePath = `./routes/${route}.routes`;
  const isProtected = !['payment', 'public', 'auth'].includes(route);
  if (isProtected) {
    app.use(`/api/${route.replace(/([A-Z])/g, '-$1').toLowerCase()}`, authMiddleware, checkSubscription, require(routePath));
  }
});

// Explicitly handle payments (no subscription check needed for payments)
app.use('/api/payments', authMiddleware, require('./routes/payment.routes'));

// Health Check
app.get('/health', async (req, res) => {
  try {
    await sequelize.authenticate();
    res.status(200).json({ uptime: process.uptime(), database: 'connected', version: '2.1.0' });
  } catch (error) {
    res.status(503).json({ message: 'Database disconnected' });
  }
});

app.get('/', (req, res) => res.json({ message: 'Welcome to MedicalCare 888 API' }));

// 4. Global Error Handler
app.use((err, req, res, next) => {
  logger.error({ err, path: req.path }, 'Global Error Handler');
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

const PORT = parseInt(process.env.PORT || '5000');

// Server Start Logic
const startServer = async () => {
  try {
    await initializeDatabase();
    await seedRoles();
    if (process.env.NODE_ENV !== 'production') await seedTestData();
    
    initializeSocket(server);
    require('./utils/scheduler')();

    server.listen(PORT, '0.0.0.0', () => {
      logger.info(`🚀 Server live on port ${PORT} [${process.env.NODE_ENV || 'dev'}]`);
    });
  } catch (error) {
    logger.fatal({ error }, 'Startup failed');
    process.exit(1);
  }
};

// 5. Graceful Shutdown
const shutdown = async (signal) => {
  logger.info(`${signal} received. Closing resources...`);
  server.close(async () => {
    try {
      await sequelize.close();
      logger.info('Database connections closed.');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Error during shutdown');
      process.exit(1);
    }
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

if (process.env.NODE_ENV !== 'test') startServer();

module.exports = { app, server };

