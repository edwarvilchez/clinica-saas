const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const sequelize = require('../config/db.config');
const InsuranceClaim = require('../models/InsuranceClaim');
require('../models'); // load associations

async function migrate() {
  try {
    console.log('Connecting to database...');
    await sequelize.authenticate();
    console.log('Database connected successfully.');
    console.log('Syncing InsuranceClaim model...');
    await InsuranceClaim.sync({ alter: true });
    console.log('InsuranceClaim table synchronized successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
}

migrate();
