'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      const desc = await queryInterface.describeTable('LabResults');
      if (!desc.price) {
        await queryInterface.addColumn('LabResults', 'price', {
          type: Sequelize.DECIMAL(12, 2),
          allowNull: true,
          defaultValue: 0.00
        });
      }
    } catch (e) {
      console.warn('Migration note for LabResults price:', e.message);
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('LabResults', 'price');
  }
};
