'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('LabResults', 'price', {
      type: Sequelize.DECIMAL(12, 2),
      allowNull: true,
      defaultValue: 0.00
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('LabResults', 'price');
  }
};
