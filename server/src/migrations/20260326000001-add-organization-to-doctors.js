module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Doctors', 'organizationId', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'Organizations',
        key: 'id'
      }
    });
    
    await queryInterface.addIndex('Doctors', ['organizationId']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('Doctors', 'organizationId');
    await queryInterface.removeColumn('Doctors', 'organizationId');
  }
};
