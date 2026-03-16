'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Prescriptions', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4
      },
      drugName: {
        type: Sequelize.STRING,
        allowNull: false
      },
      drugId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'Drugs',
          key: 'id'
        },
        onDelete: 'SET NULL'
      },
      dosage: {
        type: Sequelize.STRING
      },
      frequency: {
        type: Sequelize.STRING
      },
      duration: {
        type: Sequelize.STRING
      },
      instructions: {
        type: Sequelize.TEXT
      },
      medicalRecordId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'MedicalRecords',
          key: 'id'
        },
        onDelete: 'CASCADE'
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
    await queryInterface.dropTable('Prescriptions');
  }
};