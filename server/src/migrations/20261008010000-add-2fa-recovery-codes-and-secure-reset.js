'use strict';

/**
 * Migration: Add twoFactorRecoveryCodes and expand twoFactorSecret and resetToken
 * 
 * Purpose: Fase 8 Security - AES-256-GCM 2FA secret encryption, single-use recovery codes,
 * and SHA-256 password reset token storage.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('Users');

    if (!tableInfo.twoFactorRecoveryCodes) {
      await queryInterface.addColumn('Users', 'twoFactorRecoveryCodes', {
        type: Sequelize.JSON,
        allowNull: true,
        defaultValue: []
      });
    }

    if (tableInfo.twoFactorSecret) {
      await queryInterface.changeColumn('Users', 'twoFactorSecret', {
        type: Sequelize.TEXT,
        allowNull: true
      });
    }

    if (tableInfo.resetToken) {
      await queryInterface.changeColumn('Users', 'resetToken', {
        type: Sequelize.STRING(128),
        allowNull: true
      });
    }
  },

  async down(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('Users');
    if (tableInfo.twoFactorRecoveryCodes) {
      await queryInterface.removeColumn('Users', 'twoFactorRecoveryCodes');
    }
  }
};
