"use strict";

/**
 * Migration: Add mustChangePassword and temporaryPassword to Users table
 * 
 * Purpose: Support temporary password flow where users created by admins or
 * self-registered are forced to change their password on first login.
 * 
 * Fields added:
 *   - mustChangePassword: BOOLEAN (default TRUE) — flag to enforce password change
 *   - temporaryPassword: STRING (nullable) — plain-text temp pwd shown to admin (cleared after change)
 */
module.exports = {
    async up(queryInterface, Sequelize) {
        const tableInfo = await queryInterface.describeTable('Users');
        
        if (!tableInfo.mustChangePassword) {
            await queryInterface.addColumn('Users', 'mustChangePassword', {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: true
            });
        }

        if (!tableInfo.temporaryPassword) {
            await queryInterface.addColumn('Users', 'temporaryPassword', {
                type: Sequelize.STRING,
                allowNull: true,
                defaultValue: null
            });
        }
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.removeColumn('Users', 'mustChangePassword');
        await queryInterface.removeColumn('Users', 'temporaryPassword');
    }
};
