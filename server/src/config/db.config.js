const Sequelize = require('sequelize');
require('dotenv').config();

const configs = {
  development: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    dialect: 'postgres',
    logging: false
  },
  qa: {
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
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    },
    pool: {
      max: 5,
      min: 0,
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

const env = process.env.NODE_ENV || 'development';
const config = configs[env];

const sequelize = config.url 
  ? new Sequelize(config.url, {
      dialect: config.dialect,
      logging: config.logging,
      pool: config.pool,
      dialectOptions: config.dialectOptions
    })
  : new Sequelize(
      config.database,
      config.username,
      config.password,
      {
        host: config.host,
        port: config.port,
        dialect: config.dialect,
        logging: config.logging,
        pool: config.pool,
        dialectOptions: config.dialectOptions
      }
    );

// Force inclusion for Vercel
if (process.env.VERCEL) {
  sequelize.connectionManager.lib = require('pg');
}

module.exports = sequelize;
