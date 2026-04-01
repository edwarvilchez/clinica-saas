const express = require('express');
const http = require('http');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const compression = require('compression');
// const rateLimit = require('express-rate-limit'); // Disabled for Vercel production
require('dotenv').config();
const sequelize = require('./config/db.config');
const models = require('./models');
// const seedRoles = require('./utils/seeder');
// const seedTestData = require('./utils/testSeeder');
const { initializeSocket } = require('./sockets/videoSocket');
const logger = require('./utils/logger');
// const swaggerJsdoc = require('swagger-jsdoc'); // Disabled for Vercel production
// const swaggerUi = require('swagger-ui-express'); // Disabled for Vercel production
const { sanitizeInput } = require('./utils/sanitize');
const checkSubscription = require('./middlewares/subscription.middleware');
const authMiddleware = require('./middlewares/auth.middleware');
const validateEnv = require('./utils/validateEnv');
const { initializeDatabase } = require('./utils/migrationManager');

// 1. Initial configuration (NOT validating env yet to avoid early exit on serverless)
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

// const swaggerSpec = swaggerJsdoc(swaggerOptions); // Disabled for Vercel production

// 1. CORS - Improved with medicalcare-888.com
// Simplified CORS for Production Diagnosis
const corsOptions = {
  origin: true, // Allow all for now
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
};

app.use(cors(corsOptions));

// 2. Performance & Security Middlewares
app.use(compression()); // Gzip compression
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Limiters disabled for production diagnosis
// app.use('/api/auth/login', authLimiter);
// app.use('/api/auth/register', authLimiter);
// app.use('/api/', apiLimiter);

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
app.use(async (req, res, next) => {
  try {
    // If we're on Vercel, ensure initialization has at least been tried
    if (process.env.VERCEL && !isInitialized) {
      await connectDB();
    }
    next();
  } catch (err) {
    next(err);
  }
});

app.use((err, req, res, next) => {
  logger.error({ err, path: req.path }, 'Global Error Handler');
  
  const isDbError = err.name?.includes('Sequelize') || err.message?.includes('Database') || lastInitError;
  
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
    ...(isDbError && { 
      error: 'Database Connection Failed',
      debug_init: lastInitError ? {
        message: lastInitError.message,
        name: lastInitError.name,
        code: lastInitError.parent?.code || lastInitError.code
      } : 'Unknown DB Error'
    }),
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

if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  startServer();
}

// Initializer for serverless environments (Vercel)
let isInitialized = false;
let lastInitError = null;
const connectDB = async () => {
    if (isInitialized) return;
    try {
        validateEnv();
        await sequelize.authenticate();
        
        // Skip roles seeding and heavy initialization on Vercel to optimize cold starts
        if (!process.env.VERCEL) {
            // await initializeDatabase();
            // await seedRoles();
            // initializeSocket(server); // Disabled for Vercel production
        }
        
        isInitialized = true;
        logger.info('🚀 Vercel Cold Start: Initialization successful');
    } catch (err) {
        lastInitError = err;
        logger.fatal({ err }, 'Lazy initialization failed');
    }
};

// Check connection on each request if needed
app.use(async (req, res, next) => {
    if (process.env.VERCEL) {
        await connectDB();
    }
    next();
});

module.exports = app;

