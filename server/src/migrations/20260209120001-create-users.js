"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
    } catch (_) {
      try {
        await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');
      } catch (__) {}
    }

    try {
      await queryInterface.sequelize.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_proc WHERE proname = 'uuid_generate_v4'
          ) THEN
            CREATE OR REPLACE FUNCTION uuid_generate_v4() RETURNS uuid AS $func$
            BEGIN
              RETURN gen_random_uuid();
            END;
            $func$ LANGUAGE plpgsql;
          END IF;
        END$$;
      `);
    } catch (_) {}

    await queryInterface.createTable('Users', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true,
        allowNull: false
      },
      username: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      password: {
        type: Sequelize.STRING,
        allowNull: false
      },
      firstName: { type: Sequelize.STRING },
      lastName: { type: Sequelize.STRING },
      businessName: { type: Sequelize.STRING },
      accountType: { type: Sequelize.ENUM('PATIENT', 'PROFESSIONAL', 'CLINIC', 'HOSPITAL'), defaultValue: 'PATIENT' },
      isActive: { type: Sequelize.BOOLEAN, defaultValue: true },
      gender: { type: Sequelize.ENUM('Male', 'Female', 'Other') },
      resetToken: { type: Sequelize.STRING },
      resetExpires: { type: Sequelize.DATE },
      organizationId: { type: Sequelize.UUID },
      roleId: {
        type: Sequelize.INTEGER,
        references: {
          model: 'Roles',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('NOW()')
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('NOW()')
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Users');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS \"enum_Users_accountType\"');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS \"enum_Users_gender\"');
  }
};
