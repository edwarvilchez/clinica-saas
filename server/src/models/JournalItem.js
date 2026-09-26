const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const JournalItem = sequelize.define('JournalItem', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  journalEntryId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'JournalEntries',
      key: 'id'
    }
  },
  accountId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'AccountCharts',
      key: 'id'
    }
  },
  description: {
    type: DataTypes.STRING,
    allowNull: true
  },
  debitUSD: {
    type: DataTypes.DECIMAL(14, 2),
    defaultValue: 0.00
  },
  creditUSD: {
    type: DataTypes.DECIMAL(14, 2),
    defaultValue: 0.00
  },
  debitVES: {
    type: DataTypes.DECIMAL(18, 2),
    defaultValue: 0.00
  },
  creditVES: {
    type: DataTypes.DECIMAL(18, 2),
    defaultValue: 0.00
  }
}, {
  paranoid: true
});

module.exports = JournalItem;
