'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('Drugs')) {
      await queryInterface.createTable('Drugs', {
        id: {
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
          type: Sequelize.INTEGER
        },
        name: {
          type: Sequelize.STRING,
          allowNull: false
        },
        genericName: {
          type: Sequelize.STRING,
          allowNull: true
        },
        activeComponents: {
          type: Sequelize.TEXT,
          allowNull: false
        },
        indications: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        posology: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        contraindications: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        adverseReactions: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        precautions: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        presentation: {
          type: Sequelize.STRING,
          allowNull: true
        },
        category: {
          type: Sequelize.STRING,
          allowNull: true
        },
        createdAt: {
          allowNull: false,
          type: Sequelize.DATE
        },
        updatedAt: {
          allowNull: false,
          type: Sequelize.DATE
        }
      });
    }

    try {
      await queryInterface.addIndex('Drugs', ['name']);
    } catch (e) {}
    try {
      await queryInterface.addIndex('Drugs', ['genericName']);
    } catch (e) {}
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Drugs');
  }
};
