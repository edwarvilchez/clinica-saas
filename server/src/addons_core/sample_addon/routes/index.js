const express = require('express');
const router = express.Router();

/**
 * GET /api/v1/addons/sample_addon/ping
 */
router.get('/ping', (req, res) => {
  res.json({
    status: 'ACTIVE',
    module: 'sample_addon',
    message: '🚀 Módulo cargado dinámicamente con éxito desde addons_core'
  });
});

module.exports = router;
