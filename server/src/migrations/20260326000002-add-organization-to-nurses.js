module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Nurses', 'organizationId', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'Organizations',
        key: 'id'
      }
    });
    
    await queryInterface.addIndex('Nurses', ['organizationId']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('Nurses', 'organizationId');
    await queryInterface.removeColumn('Nurses', 'organizationId');
  }
};
