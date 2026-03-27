module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Patients', 'organizationId', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'Organizations',
        key: 'id'
      }
    });
    
    await queryInterface.addIndex('Patients', ['organizationId']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('Patients', 'organizationId');
    await queryInterface.removeColumn('Patients', 'organizationId');
  }
};
