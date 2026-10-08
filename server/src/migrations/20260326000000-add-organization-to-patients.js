module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      const desc = await queryInterface.describeTable('Patients');
      if (!desc.organizationId) {
        await queryInterface.addColumn('Patients', 'organizationId', {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'Organizations',
            key: 'id'
          }
        });
        await queryInterface.addIndex('Patients', ['organizationId']);
      }
    } catch (e) {
      console.warn('Migration note for Patients orgId:', e.message);
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('Patients', 'organizationId');
    await queryInterface.removeColumn('Patients', 'organizationId');
  }
};
