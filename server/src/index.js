const express = require('express');
const app = express();
require('dotenv').config();
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const helmet = require('helmet');
const compression = require('compression');

// Core config
const corsOptions = {
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-auth-token', 'x-org-id', 'Accept'],
  exposedHeaders: ['x-auth-token']
};

// Rate Limiters
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Demasiadas solicitudes, intenta de nuevo en 15 minutos' },
  standardHeaders: true,
  legacyHeaders: false
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Demasiados intentos de login, intenta de nuevo en 15 minutos' },
  standardHeaders: true,
  legacyHeaders: false
});

const INIT_SECRET = process.env.INIT_SECRET || 'v888-dev';
app.use(globalLimiter);
app.use(cors(corsOptions));
app.use(compression());

// Boot diagnostics (Canary routes)
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok v4.3.1', 
    env: process.env.NODE_ENV,
    vercel: !!process.env.VERCEL,
    time: new Date().toISOString() 
  });
});

/**
 * 🛠️ EMERGENCY DATABASE INITIALIZER (Standalone)
 * SOLO disponible en desarrollo - DESHABILITADO en producción
 */
const isDevMode = process.env.NODE_ENV !== 'production' && !process.env.VERCEL;
const allowReset = process.env.ALLOW_DB_RESET === 'true' && isDevMode;

if (allowReset) {
  app.get('/api/system/init-888', async (req, res) => {
    const { key } = req.query;
    if (key !== INIT_SECRET) return res.status(403).json({ error: 'Unauthorized Access Key' });

    try {
      const sequelize = require('./config/db.config');
      const seedRoles = require('./utils/seeder');
      const seedTestData = require('./utils/legacy/testSeeder');
      
      await sequelize.authenticate();
      await sequelize.sync({ force: true });
      await seedRoles();
      await seedTestData();

      res.status(200).json({ success: true, message: 'Database reset successfully (Dev Mode)' });
    } catch (err) {
      res.status(500).json({ error: 'Initialization failed', detail: err.message });
    }
  });

  /**
   * 💎 CLEAN PRODUCTION INITIALIZER (DEV ONLY)
   */
  app.get('/api/system/init-prod', async (req, res) => {
    const { key } = req.query;
    if (key !== INIT_SECRET) return res.status(403).json({ error: 'Unauthorized Access Key' });

    try {
      const sequelize = require('./config/db.config');
      const seedProductionData = require('./utils/prodSeeder');
      
      await sequelize.authenticate();
      await sequelize.sync({ force: true });
      await seedProductionData();

      res.status(200).json({ success: true, message: 'Production database initialized successfully (CLEAN)' });
    } catch (err) {
      res.status(500).json({ error: 'Production Initialization failed', detail: err.message });
    }
  });
}

/**
 * ENVIRONMENT & INTEGRITY CHECKS
 */
const fs = require('fs');
const path = require('path');

if (!process.env.VERCEL) {
  const uploadDir = path.resolve(__dirname, '../uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log('📁 Local upload directory ensured.');
  }
}

// --- LAZY LOADING CONTEXT (Performance & Compatibility) ---

let isAppLoaded = false;
let bootError = null;

const loadFullApp = async (req, res, next) => {
  // Skip for canary routes
  if (req.path === '/api/health' || req.path.startsWith('/api/system')) return next();
  
  if (isAppLoaded) return next();
  if (bootError) return res.status(500).json({ error: 'Critical Boot Failure', detail: bootError.message });

  try {
    console.log('🚀 [Server] Loading full application context...');

    // Load heavy dependencies
    const { sanitizeInput } = require('./utils/sanitize');
    const authMiddleware = require('./middlewares/auth.middleware');
    const contextMiddleware = require('./middlewares/context.middleware');
    const roleMiddleware = require('./middlewares/role.middleware');
    const sequelize = require('./config/db.config');
    const protectedRoutes = [authMiddleware, contextMiddleware];

    // Security Hardening (Helmet + CSP)
    app.use(helmet({ 
      crossOriginResourcePolicy: { policy: "cross-origin" },
      contentSecurityPolicy: false // Deshabilitado temporalmente en producción para evitar 403 en assets
    }));

    app.use(express.json({ limit: '1mb' }));
    app.use(express.urlencoded({ extended: true, limit: '1mb' }));
    app.use(morgan('dev'));
    app.use(sanitizeInput);

    // Verify DB Connection
    await sequelize.authenticate();

    // Mount API Routes
    app.use('/api/auth', authLimiter, require('./routes/auth.routes'));
    app.use('/api/exchange', require('./routes/exchange.routes'));
    app.use('/api/doctors', protectedRoutes, require('./routes/doctor.routes'));
    app.use('/api/patients', protectedRoutes, require('./routes/patient.routes'));
    app.use('/api/appointments', protectedRoutes, require('./routes/appointment.routes'));
    app.use('/api/medical-records', protectedRoutes, require('./routes/medicalRecord.routes'));
    app.use('/api/payments', protectedRoutes, require('./routes/payment.routes'));
    app.use('/api/organizations', protectedRoutes, require('./routes/organization.routes'));
    app.use('/api/specialties', protectedRoutes, require('./routes/specialty.routes'));
    app.use('/api/staff', protectedRoutes, require('./routes/staff.routes'));
    app.use('/api/lab-catalog', protectedRoutes, require('./routes/labCatalog.routes'));
    app.use('/api/lab-results', protectedRoutes, require('./routes/labResult.routes'));
    app.use('/api/drugs', protectedRoutes, require('./routes/drug.routes'));
    app.use('/api/nurses', protectedRoutes, require('./routes/nurse.routes'));
    app.use('/api/video-consultations', protectedRoutes, require('./routes/videoConsultation.routes'));
    app.use('/api/stats', protectedRoutes, require('./routes/stats.routes'));
    app.use('/api/team', protectedRoutes, require('./routes/team.routes'));
    app.use('/api/prescriptions', protectedRoutes, require('./routes/prescription.routes'));
    app.use('/api/bulk', protectedRoutes, require('./routes/bulk.routes'));
    app.use('/api/public', require('./routes/public.routes'));
    app.use('/api/admin', [...protectedRoutes, roleMiddleware(['SUPERADMIN', 'PLATFORM_ADMIN'])], require('./routes/admin.routes'));

    // Final 404 handler for API
    app.use('/api/*', (req, res) => {
        res.status(404).json({ message: 'Ruta API no encontrada' });
    });

    isAppLoaded = true;
    console.log('✅ [Server] Full context loaded successfully.');
    next();
  } catch (err) {
    bootError = err;
    console.error('❌ [Server] FATAL BOOT ERROR:', err);
    res.status(500).json({ error: 'Fatal Boot Error', detail: err.message });
  }
};

// Dispatch all requests through the loader
app.use(loadFullApp);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Global Error]', err);
  res.status(err.status || 500).json({
    message: err.message || 'Error interno del servidor',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

/**
 * 🛰️ LOCAL BOOT (Socket.io Signaling)
 * Only runs if NOT on Vercel
 */
if (!process.env.VERCEL && process.env.NODE_ENV !== 'test') {
  const http = require('http');
  const server = http.createServer(app);
  
  try {
    const { initializeSocket } = require('./sockets/videoSocket');
    initializeSocket(server);
    console.log('🎥 Socket.io initialized for real-time signaling');
  } catch (e) {
    console.warn('⚠️ Video signaling socket could not be initialized:', e.message);
  }

  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () => {
    console.log(`\n🚀 Server running on port ${PORT} (Unified Mode)`);
    console.log(`🏥 MedicalCare 888 Backend - v4.3.1\n`);
  });
}

module.exports = app;
