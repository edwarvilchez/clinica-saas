module.exports = {
  apps: [
    // =========================================================================
    // 1. PRODUCTION INSTANCE (Ambiente de Producción Oficial)
    // =========================================================================
    {
      name: 'clinica-saas-prod',
      script: 'server/src/index.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
        DB_NAME: process.env.DB_NAME_PROD || 'clinica_saas_prod',
        DB_SCHEMA: 'public'
      },
      max_memory_restart: '500M',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: 'logs/prod-error.log',
      out_file: 'logs/prod-out.log',
      merge_logs: true,
      restart_delay: 3000,
      autorestart: true
    },

    // =========================================================================
    // 2. QA / DEMO INSTANCE (Ambiente de Pruebas y Demos para Prospectos)
    // =========================================================================
    {
      name: 'clinica-saas-qa',
      script: 'server/src/index.js',
      instances: 1, // 1 instancia es suficiente para QA/Demos
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'staging',
        PORT: 5001,
        DB_NAME: process.env.DB_NAME_QA || 'clinica_saas_qa',
        DB_SCHEMA: 'public'
      },
      max_memory_restart: '300M',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: 'logs/qa-error.log',
      out_file: 'logs/qa-out.log',
      merge_logs: true,
      restart_delay: 3000,
      autorestart: true
    }
  ]
};
