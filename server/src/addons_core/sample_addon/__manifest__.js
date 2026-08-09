/**
 * Manifest definition for sample_addon module
 */
module.exports = {
  name: 'Sample Core Addon',
  version: '1.0.0',
  category: 'System/Sample',
  summary: 'Módulo de demostración para validación del motor modular Odoo-Style',
  author: 'CGK Core Team',
  depends: ['base'],
  data: [],
  installable: true,
  application: true
};
