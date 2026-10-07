module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      const desc = await queryInterface.describeTable('Nurses');
      if (!desc.organizationId) {
        await queryInterface.addColumn('Nurses', 'organizationId', {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'Organizations',
            key: 'id'
          }
        });
        await queryInterface.addIndex('Nurses', ['organizationId']);
      }
    } catch (e) {
      console.warn('Migration note for Nurses orgId:', e.message);
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('Nurses', 'organizationId');
    await queryInterface.removeColumn('Nurses', 'organizationId');
  }
};
