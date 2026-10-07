module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      const desc = await queryInterface.describeTable('Doctors');
      if (!desc.organizationId) {
        await queryInterface.addColumn('Doctors', 'organizationId', {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'Organizations',
            key: 'id'
          }
        });
        await queryInterface.addIndex('Doctors', ['organizationId']);
      }
    } catch (e) {
      console.warn('Migration note for Doctors orgId:', e.message);
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('Doctors', 'organizationId');
    await queryInterface.removeColumn('Doctors', 'organizationId');
  }
};
