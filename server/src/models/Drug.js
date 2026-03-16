const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const Drug = sequelize.define('Drug', {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },
  genericName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  activeComponents: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  indications: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  posology: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  contraindications: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  adverseReactions: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  precautions: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  presentation: {
    type: DataTypes.STRING,
    allowNull: true
  },
  category: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  timestamps: true,
  indexes: [
    { fields: ['name'] },
    { fields: ['genericName'] }
  ]
});

module.exports = Drug;
