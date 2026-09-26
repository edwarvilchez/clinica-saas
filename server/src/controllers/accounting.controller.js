const { AccountChart, JournalEntry, JournalItem, TaxRetention, Organization, sequelize } = require('../models');
const { Op } = require('sequelize');

// ── PLAN DE CUENTAS (CHART OF ACCOUNTS) ───────────
exports.getChartOfAccounts = async (req, res) => {
  try {
    const accounts = await AccountChart.findAll({
      order: [['code', 'ASC']]
    });
    res.json(accounts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createAccount = async (req, res) => {
  try {
    const orgId = req.organizationId || null;
    const { code, name, accountType, category, parentCode, level, allowsMovement } = req.body;

    if (!code || !name || !accountType) {
      return res.status(400).json({ message: 'Código, nombre y tipo de cuenta son obligatorios' });
    }

    const account = await AccountChart.create({
      organizationId: orgId,
      code,
      name,
      accountType,
      category: category || 'OPERATIONAL',
      parentCode: parentCode || null,
      level: level || 1,
      allowsMovement: allowsMovement !== undefined ? allowsMovement : true
    });

    res.status(201).json(account);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── LIBRO DIARIO (JOURNAL ENTRIES) ───────────────
exports.getJournalEntries = async (req, res) => {
  try {
    const { startDate, endDate, sourceModule } = req.query;
    const where = {};
    if (sourceModule) where.sourceModule = sourceModule;
    if (startDate && endDate) {
      where.entryDate = { [Op.between]: [startDate, endDate] };
    }

    const entries = await JournalEntry.findAll({
      where,
      include: [
        {
          model: JournalItem,
          as: 'items',
          include: [{ model: AccountChart, attributes: ['id', 'code', 'name', 'accountType'] }]
        }
      ],
      order: [['entryDate', 'DESC'], ['entryNumber', 'DESC']]
    });

    res.json(entries);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create a new balanced Journal Entry
exports.createJournalEntry = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const orgId = req.organizationId || null;
    const userId = req.user ? req.user.id : null;
    const { entryDate, concept, sourceModule, bcvRate = 1.0, items } = req.body;

    if (!concept || !items || !Array.isArray(items) || items.length < 2) {
      await t.rollback();
      return res.status(400).json({ message: 'El asiento requiere concepto y al menos 2 movimientos (Débito y Crédito)' });
    }

    let totalDebitUSD = 0;
    let totalCreditUSD = 0;
    let totalDebitVES = 0;
    let totalCreditVES = 0;

    const parsedItems = items.map(item => {
      const dUSD = parseFloat(item.debitUSD || 0);
      const cUSD = parseFloat(item.creditUSD || 0);
      const dVES = (dUSD * parseFloat(bcvRate)).toFixed(2);
      const cVES = (cUSD * parseFloat(bcvRate)).toFixed(2);

      totalDebitUSD += dUSD;
      totalCreditUSD += cUSD;
      totalDebitVES += parseFloat(dVES);
      totalCreditVES += parseFloat(cVES);

      return {
        accountId: item.accountId,
        description: item.description || concept,
        debitUSD: dUSD,
        creditUSD: cUSD,
        debitVES: dVES,
        creditVES: cVES
      };
    });

    const isBalanced = Math.abs(totalDebitUSD - totalCreditUSD) < 0.01;
    if (!isBalanced) {
      await t.rollback();
      return res.status(400).json({ 
        message: `El asiento no está cuadrado: Total Debe ($${totalDebitUSD.toFixed(2)}) != Total Haber ($${totalCreditUSD.toFixed(2)})` 
      });
    }

    const count = await JournalEntry.count();
    const entryNumber = `AS-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;

    const entry = await JournalEntry.create({
      organizationId: orgId,
      entryNumber,
      entryDate: entryDate || new Date(),
      concept,
      sourceModule: sourceModule || 'MANUAL',
      bcvRate,
      totalDebitUSD: totalDebitUSD.toFixed(2),
      totalCreditUSD: totalCreditUSD.toFixed(2),
      totalDebitVES: totalDebitVES.toFixed(2),
      totalCreditVES: totalCreditVES.toFixed(2),
      isBalanced: true,
      status: 'POSTED',
      createdById: userId
    }, { transaction: t });

    for (const item of parsedItems) {
      await JournalItem.create({
        journalEntryId: entry.id,
        ...item
      }, { transaction: t });

      // Actualizar saldos en la cuenta contable
      const account = await AccountChart.findByPk(item.accountId, { transaction: t });
      if (account) {
        const netUSD = item.debitUSD - item.creditUSD;
        const netVES = parseFloat(item.debitVES) - parseFloat(item.creditVES);
        await account.update({
          balanceUSD: (parseFloat(account.balanceUSD || 0) + netUSD).toFixed(2),
          balanceVES: (parseFloat(account.balanceVES || 0) + netVES).toFixed(2)
        }, { transaction: t });
      }
    }

    await t.commit();

    const populated = await JournalEntry.findByPk(entry.id, {
      include: [
        {
          model: JournalItem,
          as: 'items',
          include: [{ model: AccountChart }]
        }
      ]
    });

    res.status(201).json(populated);
  } catch (error) {
    await t.rollback();
    res.status(500).json({ message: error.message });
  }
};

// ── BALANCE DE COMPROBACIÓN (TRIAL BALANCE) ──────
exports.getTrialBalance = async (req, res) => {
  try {
    const accounts = await AccountChart.findAll({
      where: { allowsMovement: true },
      order: [['code', 'ASC']]
    });

    const summary = accounts.map(a => {
      const balanceUSD = parseFloat(a.balanceUSD || 0);
      const balanceVES = parseFloat(a.balanceVES || 0);
      return {
        id: a.id,
        code: a.code,
        name: a.name,
        accountType: a.accountType,
        debitUSD: balanceUSD > 0 ? balanceUSD : 0,
        creditUSD: balanceUSD < 0 ? Math.abs(balanceUSD) : 0,
        debitVES: balanceVES > 0 ? balanceVES : 0,
        creditVES: balanceVES < 0 ? Math.abs(balanceVES) : 0
      };
    });

    res.json(summary);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── RETENCIONES SENIAT (TAX RETENTIONS) ───────────
exports.getTaxRetentions = async (req, res) => {
  try {
    const { retentionType } = req.query;
    const where = {};
    if (retentionType) where.retentionType = retentionType;

    const retentions = await TaxRetention.findAll({
      where,
      order: [['createdAt', 'DESC']]
    });
    res.json(retentions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createTaxRetention = async (req, res) => {
  try {
    const orgId = req.organizationId || null;
    const {
      retentionType,
      beneficiaryName,
      beneficiaryRif,
      invoiceNumber,
      invoiceControlNumber,
      invoiceDate,
      baseAmountUSD,
      taxPercentage = 16.0,
      retentionPercentage = 75.0,
      bcvRate = 1.0
    } = req.body;

    const baseUSD = parseFloat(baseAmountUSD);
    const taxUSD = (baseUSD * (parseFloat(taxPercentage) / 100)).toFixed(2);
    const retainedUSD = (parseFloat(taxUSD) * (parseFloat(retentionPercentage) / 100)).toFixed(2);

    const baseVES = (baseUSD * parseFloat(bcvRate)).toFixed(2);
    const taxVES = (parseFloat(taxUSD) * parseFloat(bcvRate)).toFixed(2);
    const retainedVES = (parseFloat(retainedUSD) * parseFloat(bcvRate)).toFixed(2);

    const count = await TaxRetention.count();
    const voucherNumber = `${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(count + 1).padStart(6, '0')}`;

    const retention = await TaxRetention.create({
      organizationId: orgId,
      voucherNumber,
      retentionType: retentionType || 'IVA',
      beneficiaryName,
      beneficiaryRif,
      invoiceNumber,
      invoiceControlNumber,
      invoiceDate,
      baseAmountUSD: baseUSD,
      baseAmountVES: baseVES,
      taxPercentage,
      taxAmountUSD: taxUSD,
      taxAmountVES: taxVES,
      retentionPercentage,
      retainedAmountUSD: retainedUSD,
      retainedAmountVES: retainedVES,
      bcvRate,
      status: 'EMITTED'
    });

    res.status(201).json(retention);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
