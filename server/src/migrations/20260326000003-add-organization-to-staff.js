module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      const desc = await queryInterface.describeTable('Staff');
      if (!desc.organizationId) {
        await queryInterface.addColumn('Staff', 'organizationId', {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'Organizations',
            key: 'id'
          }
        });
        await queryInterface.addIndex('Staff', ['organizationId']);
      }
    } catch (e) {
      console.warn('Migration note for Staff orgId:', e.message);
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('Staff', 'organizationId');
    await queryInterface.removeColumn('Staff', 'organizationId');
  }
};
