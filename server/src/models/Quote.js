const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const Quote = sequelize.define('Quote', {
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
  quoteNumber: {
    type: DataTypes.STRING,
    allowNull: false // e.g. 'COT-2026-0001'
  },
  patientId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Patients',
      key: 'id'
    }
  },
  patientName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  patientDocumentId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  patientPhone: {
    type: DataTypes.STRING,
    allowNull: true
  },
  patientEmail: {
    type: DataTypes.STRING,
    allowNull: true
  },
  doctorId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Doctors',
      key: 'id'
    }
  },
  insuranceCompanyId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'InsuranceCompanies',
      key: 'id'
    }
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false // e.g. 'Presupuesto de Colecistectomía Laparoscópica'
  },
  bcvRate: {
    type: DataTypes.DECIMAL(10, 4),
    allowNull: false
  },
  subtotalUSD: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  taxAmountUSD: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0.00
  },
  discountAmountUSD: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0.00
  },
  totalUSD: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  totalVES: {
    type: DataTypes.DECIMAL(16, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  insuranceCoverageUSD: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0.00
  },
  patientPayableUSD: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0.00
  },
  validUntil: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'CONVERTED_TO_SALE', 'EXPIRED'),
    defaultValue: 'DRAFT'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  terms: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  paranoid: true
});

module.exports = Quote;
