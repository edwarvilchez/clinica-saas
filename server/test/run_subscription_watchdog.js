require('dotenv').config();

const sequelize = require('../src/config/db.config');
const { runSubscriptionWatchdog } = require('../src/utils/scheduler');

async function runManualSubscriptionWatchdog() {
  try {
    console.log('🚀 Ejecutando watchdog manual de suscripciones...');

    await sequelize.authenticate();
    console.log('✅ Conexión a base de datos establecida.');

    await runSubscriptionWatchdog();

    console.log('✅ Watchdog manual finalizado correctamente.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error en ejecución manual del watchdog:', error);
    process.exit(1);
  }
}

runManualSubscriptionWatchdog();
