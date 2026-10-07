const Sequelize = require('sequelize');
require('dotenv').config();

const env = process.env.NODE_ENV || 'development';

const configs = {
  development: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    dialect: 'postgres',
    logging: false
  },
  production: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: false,
    dialectOptions: process.env.DB_SSL === 'true' ? {
      ssl: { require: true, rejectUnauthorized: false }
    } : {},
    pool: {
      max: parseInt(process.env.DB_POOL_MAX || '20', 10),
      min: parseInt(process.env.DB_POOL_MIN || '2', 10),
      acquire: 30000,
      idle: 10000
    }
  },
  test: {
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'clinica_saas_test',
    host: process.env.DB_HOST || 'localhost',
    dialect: 'postgres',
    logging: false
  }
};

const config = configs[env] || configs.development;

// DATABASE_URL takes priority if provided
const databaseUrl = process.env.DATABASE_URL;

let sequelize;
if (databaseUrl) {
  const useSsl = process.env.DB_SSL === 'true' || databaseUrl.includes('sslmode=require');
  sequelize = new Sequelize(databaseUrl, {
    dialect: 'postgres',
    logging: false,
    dialectOptions: useSsl ? {
      ssl: { require: true, rejectUnauthorized: false },
      keepAlive: true
    } : { keepAlive: true },
    pool: { 
      max: parseInt(process.env.DB_POOL_MAX || '20', 10), 
      min: parseInt(process.env.DB_POOL_MIN || '2', 10), 
      acquire: 30000, 
      idle: 10000,
      evict: 1000
    }
  });
} else if (config.url) {
  sequelize = new Sequelize(config.url, {
    dialect: config.dialect,
    logging: config.logging,
    pool: config.pool,
    dialectOptions: config.dialectOptions
  });
} else {
  sequelize = new Sequelize(
    config.database,
    config.username,
    config.password,
    {
      host: config.host,
      port: config.port,
      dialect: config.dialect,
      logging: config.logging,
      pool: config.pool || { max: 10, min: 0, acquire: 30000, idle: 10000 },
      dialectOptions: config.dialectOptions
    }
  );
}

module.exports = sequelize;
