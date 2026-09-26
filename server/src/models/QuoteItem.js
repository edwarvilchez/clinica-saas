const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const QuoteItem = sequelize.define('QuoteItem', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  quoteId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Quotes',
      key: 'id'
    }
  },
  serviceId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'ClinicalServices',
      key: 'id'
    }
  },
  concept: {
    type: DataTypes.STRING,
    allowNull: false
  },
  quantity: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  unitPriceUSD: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  unitPriceVES: {
    type: DataTypes.DECIMAL(14, 2),
    allowNull: true
  },
  discountPercent: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 0.00
  },
  totalPriceUSD: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  totalPriceVES: {
    type: DataTypes.DECIMAL(14, 2),
    allowNull: true
  }
}, {
  paranoid: true
});

module.exports = QuoteItem;
