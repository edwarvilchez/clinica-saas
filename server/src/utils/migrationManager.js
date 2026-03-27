/**
 * Migration Manager
 * Handles database migrations with fallback to sync for development
 */

const { exec } = require('child_process');
const sequelize = require('../config/db.config');
const logger = require('./logger');

const isProduction = process.env.NODE_ENV === 'production';

const runMigrations = () => {
  return new Promise((resolve, reject) => {
    logger.info('Running database migrations...');
    
    exec('npx sequelize-cli db:migrate', {
      cwd: __dirname + '/../..',
      env: process.env
    }, (error, stdout, stderr) => {
      if (error) {
        logger.error({ error, stderr }, 'Migration failed');
        reject(error);
        return;
      }
      logger.info('Migrations completed successfully');
      resolve(stdout);
    });
  });
};

const syncDatabase = () => {
  logger.warn('Using sequelize.sync() - this is for development only!');
  return sequelize.sync({ force: false });
};

const initializeDatabase = async () => {
  if (isProduction) {
    try {
      await runMigrations();
      return true;
    } catch (error) {
      logger.error({ error }, 'Production migration failed, falling back to sync');
      logger.warn('IMPORTANT: Manual migration required for production!');
      await syncDatabase();
      return false;
    }
  } else {
    await syncDatabase();
    return true;
  }
};

module.exports = {
  runMigrations,
  syncDatabase,
  initializeDatabase
};
