const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const InventoryItem = sequelize.define('InventoryItem', {
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
    allowNull: false // e.g. 'MED-001', 'SRV-042', 'INS-010'
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  nameEn: {
    type: DataTypes.STRING,
    allowNull: true
  },
  itemType: {
    type: DataTypes.ENUM('PRODUCT', 'SERVICE', 'MEDICATION', 'SUPPLY'),
    defaultValue: 'PRODUCT'
  },
  category: {
    type: DataTypes.ENUM(
      'MEDICINE', 
      'SURGICAL_MATERIAL', 
      'DISPOSABLE', 
      'EQUIPMENT', 
      'CONSULTATION', 
      'SURGERY', 
      'PROCEDURE', 
      'IMAGING', 
      'LABORATORY', 
      'HOSPITAL_SUPPLY', 
      'OTHER'
    ),
    defaultValue: 'MEDICINE'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  unit: {
    type: DataTypes.STRING,
    defaultValue: 'UNIDAD' // 'UNIDAD', 'CAJA', 'AMPOLLA', 'FRASCO', 'KIT', 'SERVICIO', 'HORA', 'DOSIS'
  },
  costUSD: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00
  },
  priceUSD: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  stockCurrent: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00
  },
  stockMin: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 5.00
  },
  batchNumber: {
    type: DataTypes.STRING,
    allowNull: true
  },
  expiryDate: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  location: {
    type: DataTypes.STRING,
    defaultValue: 'Almacén General' // 'Farmacia Central', 'Quirófano A', 'Emergencia', etc.
  },
  isTaxExempt: {
    type: DataTypes.BOOLEAN,
    defaultValue: true // Exento de IVA según normativa venezolana de salud
  },
  specialtyId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Specialties',
      key: 'id'
    }
  },
  doctorId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Doctors',
      key: 'id'
    }
  },
  doctorFeePercent: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 70.00
  },
  doctorFeeFixedUSD: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00
  },
  requiresDoctor: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  paranoid: true,
  indexes: [
    {
      fields: ['code', 'organizationId'],
      unique: true
    }
  ]
});

module.exports = InventoryItem;
