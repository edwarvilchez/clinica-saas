'use strict';

const express = require('express');
const router = express.Router();
const healthController = require('../controllers/health.controller');

// Liveness probe (Kubernetes / ECS / Docker)
router.get('/live', healthController.live);

// Readiness probe (Database, Storage, Cache dependencies)
router.get('/ready', healthController.ready);

// Root health summary (backward compatibility)
router.get('/', healthController.summary);

module.exports = router;
