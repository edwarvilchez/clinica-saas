module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Staff', 'organizationId', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'Organizations',
        key: 'id'
      }
    });
    
    await queryInterface.addIndex('Staff', ['organizationId']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('Staff', 'organizationId');
    await queryInterface.removeColumn('Staff', 'organizationId');
  }
};
