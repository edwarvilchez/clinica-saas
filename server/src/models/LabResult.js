const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const LabResult = sequelize.define('LabResult', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  testName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  resultValue: {
    type: DataTypes.TEXT
  },
  referenceRange: {
    type: DataTypes.STRING
  },
  fileUrl: {
    type: DataTypes.STRING
  },
  status: {
    type: DataTypes.ENUM('Pending', 'Completed'),
    defaultValue: 'Completed'
  },
  deletedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  deletedBy: {
    type: DataTypes.UUID,
    allowNull: true
  },
  price: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
    defaultValue: 0.00
  }
}, {
  paranoid: true
});

module.exports = LabResult;
