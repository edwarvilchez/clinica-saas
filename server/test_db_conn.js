const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: 'medicus_app_pass' || process.env.DB_PASSWORD, // Try a fixed common password from setup script
  port: process.env.DB_PORT,
});

async function testConnection() {
  try {
    await client.connect();
    console.log('Successfully connected to Postgres');
    const res = await client.query('SELECT current_database(), current_user, version();');
    console.log('Query result:', res.rows[0]);
    await client.end();
  } catch (err) {
    console.error('Connection error', err.stack);
  }
}

testConnection();
