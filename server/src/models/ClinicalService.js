const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const ClinicalService = sequelize.define('ClinicalService', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  organizationId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Organizations',
      key: 'id'
    }
  },
  code: {
    type: DataTypes.STRING,
    allowNull: false
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  category: {
    type: DataTypes.ENUM('CONSULTATION', 'LABORATORY', 'IMAGING', 'SURGERY', 'HOSPITALIZATION', 'EMERGENCY', 'PROCEDURE', 'NURSING', 'SUPPLIES'),
    defaultValue: 'CONSULTATION'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  priceUSD: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  isTaxExempt: {
    type: DataTypes.BOOLEAN,
    defaultValue: true // En Venezuela los servicios médicos están exentos de IVA según Art. 18 de la Ley de IVA
  },
  taxRate: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 0.00
  },
  requiresDoctor: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  specialtyId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Specialties',
      key: 'id'
    }
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  paranoid: true
});

module.exports = ClinicalService;
