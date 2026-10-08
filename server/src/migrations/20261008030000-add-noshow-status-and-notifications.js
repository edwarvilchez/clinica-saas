'use strict';

/**
 * Migration: Support 'NoShow' status in Appointments enum and index
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      await queryInterface.sequelize.query(`
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_Appointments_status') THEN
            ALTER TYPE "enum_Appointments_status" ADD VALUE IF NOT EXISTS 'NoShow';
          END IF;
        END$$;
      `);
    } catch (err) {
      // In SQLite, MySQL or if already added, ignore
    }
  },

  async down(queryInterface, Sequelize) {
    // In PostgreSQL, values cannot be safely removed from ENUM types without dropping and recreating the type.
  }
};
