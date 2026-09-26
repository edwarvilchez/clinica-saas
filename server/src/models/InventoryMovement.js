const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const InventoryMovement = sequelize.define('InventoryMovement', {
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
  itemId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'InventoryItems',
      key: 'id'
    }
  },
  movementType: {
    type: DataTypes.ENUM('ENTRY', 'EXIT', 'CLINICAL_CONSUMPTION', 'ADJUSTMENT', 'RETURN'),
    defaultValue: 'CLINICAL_CONSUMPTION'
  },
  quantity: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  unitCostUSD: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00
  },
  unitPriceUSD: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00
  },
  totalAmountUSD: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00
  },
  bcvRate: {
    type: DataTypes.DECIMAL(10, 4),
    defaultValue: 1.00
  },
  patientId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Patients',
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
  doctorFeeId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'DoctorFees',
      key: 'id'
    }
  },
  documentRef: {
    type: DataTypes.STRING,
    allowNull: true // e.g. 'ORD-CONS-0042', 'QUIROFANO-A', 'COMP-0012'
  },
  reason: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  movementDate: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  createdById: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id'
    }
  }
}, {
  paranoid: true
});

module.exports = InventoryMovement;
