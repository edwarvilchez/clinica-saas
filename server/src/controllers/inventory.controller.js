const { 
  InventoryItem, InventoryMovement, Doctor, User, Specialty, 
  Patient, DoctorFee, sequelize 
} = require('../models');
const { Op } = require('sequelize');

const getOrgId = (req) => req.user?.organizationId || req.organizationId || null;
const isPlatformAdmin = (req) => req.user?.role === 'SUPERADMIN' || req.user?.role === 'PLATFORM_ADMIN';

// List products, medications, supplies, and services
exports.getItems = async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const isSuperAdmin = isPlatformAdmin(req);
    const { itemType, category, doctorId, specialtyId, stockAlert, search } = req.query;

    const where = {};
    if (!isSuperAdmin && orgId) {
      where[Op.or] = [
        { organizationId: orgId },
        { organizationId: null }
      ];
    }
    if (itemType) where.itemType = itemType;
    if (category) where.category = category;
    if (doctorId) where.doctorId = doctorId;
    if (specialtyId) where.specialtyId = specialtyId;

    if (search) {
      where[Op.or] = [
        { code: { [Op.iLike]: `%${search}%` } },
        { name: { [Op.iLike]: `%${search}%` } },
        { batchNumber: { [Op.iLike]: `%${search}%` } }
      ];
    }

    let items = await InventoryItem.findAll({
      where,
      include: [
        {
          model: Doctor,
          include: [{ model: User, attributes: ['id', 'firstName', 'lastName', 'email'] }]
        },
        {
          model: Specialty,
          attributes: ['id', 'name', 'nameEn', 'code']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    if (stockAlert === 'LOW') {
      items = items.filter(it => it.itemType !== 'SERVICE' && parseFloat(it.stockCurrent) <= parseFloat(it.stockMin));
    }

    res.json(items);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get single item with recent movement history
exports.getItemById = async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = getOrgId(req);
    const isSuperAdmin = isPlatformAdmin(req);

    const item = await InventoryItem.findByPk(id, {
      include: [
        {
          model: Doctor,
          include: [{ model: User, attributes: ['id', 'firstName', 'lastName', 'email'] }]
        },
        {
          model: Specialty,
          attributes: ['id', 'name', 'nameEn', 'code']
        },
        {
          model: InventoryMovement,
          as: 'movements',
          include: [
            { model: Patient, include: [{ model: User, attributes: ['firstName', 'lastName'] }] },
            { model: Doctor, include: [{ model: User, attributes: ['firstName', 'lastName'] }] }
          ],
          limit: 20,
          order: [['movementDate', 'DESC']]
        }
      ]
    });

    if (!item) {
      return res.status(404).json({ message: 'Ítem de inventario no encontrado.' });
    }

    if (!isSuperAdmin && orgId && item.organizationId && item.organizationId !== orgId) {
      return res.status(403).json({ message: 'No tienes acceso a los ítems de inventario de otra clínica' });
    }

    res.json(item);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create new Product / Supply / Medication or Clinical Service
exports.createItem = async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const {
      code,
      name,
      nameEn,
      itemType = 'PRODUCT',
      category = 'MEDICINE',
      description,
      unit = 'UNIDAD',
      costUSD = 0,
      priceUSD = 0,
      stockCurrent = 0,
      stockMin = 5,
      batchNumber,
      expiryDate,
      location = 'Almacén General',
      isTaxExempt = true,
      specialtyId,
      doctorId,
      doctorFeePercent = 70.0,
      doctorFeeFixedUSD = 0,
      requiresDoctor = false
    } = req.body;

    if (!code || !name) {
      return res.status(400).json({ message: 'El código (SKU) y el nombre son obligatorios.' });
    }

    const existing = await InventoryItem.findOne({ 
      where: orgId ? { code, organizationId: orgId } : { code } 
    });
    if (existing) {
      return res.status(400).json({ message: 'Ya existe un producto o servicio con este código SKU en tu clínica.' });
    }

    const item = await InventoryItem.create({
      organizationId: orgId,
      code,
      name,
      nameEn,
      itemType,
      category,
      description,
      unit,
      costUSD: parseFloat(costUSD) || 0,
      priceUSD: parseFloat(priceUSD) || 0,
      stockCurrent: itemType === 'SERVICE' ? 999 : (parseFloat(stockCurrent) || 0),
      stockMin: parseFloat(stockMin) || 5,
      batchNumber,
      expiryDate: expiryDate || null,
      location,
      isTaxExempt: isTaxExempt !== undefined ? Boolean(isTaxExempt) : true,
      specialtyId: specialtyId ? parseInt(specialtyId) : null,
      doctorId: doctorId || null,
      doctorFeePercent: parseFloat(doctorFeePercent) || 70.0,
      doctorFeeFixedUSD: parseFloat(doctorFeeFixedUSD) || 0,
      requiresDoctor: Boolean(requiresDoctor) || Boolean(doctorId)
    });

    // If initial stock > 0, record initial entry movement
    if (itemType !== 'SERVICE' && parseFloat(stockCurrent) > 0) {
      await InventoryMovement.create({
        organizationId: orgId,
        itemId: item.id,
        movementType: 'ENTRY',
        quantity: parseFloat(stockCurrent),
        unitCostUSD: parseFloat(costUSD) || 0,
        unitPriceUSD: parseFloat(priceUSD) || 0,
        totalAmountUSD: (parseFloat(stockCurrent) * (parseFloat(costUSD) || 0)).toFixed(2),
        documentRef: 'INICIAL-STOCK',
        reason: 'Inventario inicial de apertura de catálogo'
      });
    }

    res.status(201).json(item);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update item & doctor fee rules
exports.updateItem = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await InventoryItem.findByPk(id);

    if (!item) {
      return res.status(404).json({ message: 'Ítem no encontrado.' });
    }

    const orgId = getOrgId(req);
    const isSuperAdmin = isPlatformAdmin(req);
    if (!isSuperAdmin && orgId && item.organizationId && item.organizationId !== orgId) {
      return res.status(403).json({ message: 'No tienes permisos para modificar este ítem de otra clínica' });
    }

    const {
      name,
      nameEn,
      itemType,
      category,
      description,
      unit,
      costUSD,
      priceUSD,
      stockMin,
      batchNumber,
      expiryDate,
      location,
      isTaxExempt,
      specialtyId,
      doctorId,
      doctorFeePercent,
      doctorFeeFixedUSD,
      requiresDoctor,
      isActive
    } = req.body;

    await item.update({
      name: name !== undefined ? name : item.name,
      nameEn: nameEn !== undefined ? nameEn : item.nameEn,
      itemType: itemType || item.itemType,
      category: category || item.category,
      description: description !== undefined ? description : item.description,
      unit: unit || item.unit,
      costUSD: costUSD !== undefined ? parseFloat(costUSD) : item.costUSD,
      priceUSD: priceUSD !== undefined ? parseFloat(priceUSD) : item.priceUSD,
      stockMin: stockMin !== undefined ? parseFloat(stockMin) : item.stockMin,
      batchNumber: batchNumber !== undefined ? batchNumber : item.batchNumber,
      expiryDate: expiryDate !== undefined ? expiryDate : item.expiryDate,
      location: location !== undefined ? location : item.location,
      isTaxExempt: isTaxExempt !== undefined ? Boolean(isTaxExempt) : item.isTaxExempt,
      specialtyId: specialtyId !== undefined ? (specialtyId ? parseInt(specialtyId) : null) : item.specialtyId,
      doctorId: doctorId !== undefined ? (doctorId || null) : item.doctorId,
      doctorFeePercent: doctorFeePercent !== undefined ? parseFloat(doctorFeePercent) : item.doctorFeePercent,
      doctorFeeFixedUSD: doctorFeeFixedUSD !== undefined ? parseFloat(doctorFeeFixedUSD) : item.doctorFeeFixedUSD,
      requiresDoctor: requiresDoctor !== undefined ? Boolean(requiresDoctor) : item.requiresDoctor,
      isActive: isActive !== undefined ? Boolean(isActive) : item.isActive
    });

    res.json(item);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Register Inventory Movement (Kardex: Entry, Exit, Clinical Consumption with Doctor Fee Creation)
exports.registerMovement = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const orgId = getOrgId(req);
    const userId = req.user?.id || null;
    const {
      itemId,
      movementType = 'CLINICAL_CONSUMPTION',
      quantity,
      unitCostUSD,
      unitPriceUSD,
      patientId,
      doctorId,
      documentRef,
      reason,
      bcvRate = 1.0,
      generateDoctorFee = true
    } = req.body;

    if (!itemId || !quantity || parseFloat(quantity) <= 0) {
      await t.rollback();
      return res.status(400).json({ message: 'El producto/servicio y una cantidad mayor a 0 son obligatorios.' });
    }

    const item = await InventoryItem.findByPk(itemId, { transaction: t });
    if (!item) {
      await t.rollback();
      return res.status(404).json({ message: 'Ítem de inventario no encontrado.' });
    }

    const isSuperAdmin = isPlatformAdmin(req);
    if (!isSuperAdmin && orgId && item.organizationId && item.organizationId !== orgId) {
      await t.rollback();
      return res.status(403).json({ message: 'No tienes permisos para registrar movimientos en ítems de otra clínica' });
    }

    const qty = parseFloat(quantity);
    const rate = parseFloat(bcvRate) || 1.0;
    const cost = unitCostUSD !== undefined ? parseFloat(unitCostUSD) : parseFloat(item.costUSD || 0);
    const price = unitPriceUSD !== undefined ? parseFloat(unitPriceUSD) : parseFloat(item.priceUSD || 0);
    const totalUSD = (qty * price).toFixed(2);

    // Stock verification and update for physical items
    if (item.itemType !== 'SERVICE') {
      const currentStock = parseFloat(item.stockCurrent || 0);
      if (movementType === 'EXIT' || movementType === 'CLINICAL_CONSUMPTION') {
        if (currentStock < qty) {
          await t.rollback();
          return res.status(400).json({ 
            message: `Stock insuficiente en almacén. Stock actual: ${currentStock} ${item.unit}(s), Solicitado: ${qty}` 
          });
        }
        await item.update({ stockCurrent: currentStock - qty }, { transaction: t });
      } else if (movementType === 'ENTRY' || movementType === 'RETURN') {
        await item.update({ stockCurrent: currentStock + qty }, { transaction: t });
      } else if (movementType === 'ADJUSTMENT') {
        await item.update({ stockCurrent: qty }, { transaction: t });
      }
    }

    let createdDoctorFee = null;
    const effectiveDoctorId = doctorId || item.doctorId;

    // Automatic Doctor Fee creation if item generates professional fees
    if (generateDoctorFee && (item.requiresDoctor || effectiveDoctorId) && movementType === 'CLINICAL_CONSUMPTION' && effectiveDoctorId) {
      const grossUSD = parseFloat(totalUSD);
      let docAmountUSD = 0;
      let clinAmountUSD = 0;

      if (parseFloat(item.doctorFeeFixedUSD) > 0) {
        docAmountUSD = parseFloat(item.doctorFeeFixedUSD) * qty;
        clinAmountUSD = Math.max(0, grossUSD - docAmountUSD);
      } else {
        const docPercent = parseFloat(item.doctorFeePercent || 70.0);
        const clinPercent = 100 - docPercent;
        docAmountUSD = grossUSD * (docPercent / 100);
        clinAmountUSD = grossUSD * (clinPercent / 100);
      }

      const retentionIslrPercent = 3.00;
      const retentionIslrUSD = docAmountUSD * (retentionIslrPercent / 100);
      const netPayableUSD = docAmountUSD - retentionIslrUSD;

      createdDoctorFee = await DoctorFee.create({
        organizationId: orgId,
        doctorId: effectiveDoctorId,
        patientId: patientId || null,
        clinicalServiceId: null,
        serviceConcept: `${item.name} (${qty} ${item.unit})`,
        serviceType: item.itemType === 'SERVICE' ? 'PROCEDURE' : 'CONSULTATION',
        feeType: parseFloat(item.doctorFeeFixedUSD) > 0 ? 'FIXED_AMOUNT' : 'PERCENTAGE',
        totalAmountUSD: grossUSD.toFixed(2),
        totalAmountVES: (grossUSD * rate).toFixed(2),
        bcvRate: rate,
        doctorPercent: parseFloat(item.doctorFeePercent || 70.0),
        clinicPercent: parseFloat(100 - (item.doctorFeePercent || 70.0)),
        doctorAmountUSD: docAmountUSD.toFixed(2),
        clinicAmountUSD: clinAmountUSD.toFixed(2),
        retentionIslrPercent,
        retentionIslrUSD: retentionIslrUSD.toFixed(2),
        netPayableUSD: netPayableUSD.toFixed(2),
        status: 'PENDING',
        notes: `Generado automáticamente por consumo de inventario Ref: ${documentRef || 'Consumo Directo'}`
      }, { transaction: t });
    }

    const movement = await InventoryMovement.create({
      organizationId: orgId,
      itemId: item.id,
      movementType,
      quantity: qty,
      unitCostUSD: cost,
      unitPriceUSD: price,
      totalAmountUSD: totalUSD,
      bcvRate: rate,
      patientId: patientId || null,
      doctorId: effectiveDoctorId || null,
      doctorFeeId: createdDoctorFee ? createdDoctorFee.id : null,
      documentRef: documentRef || `MOV-${Date.now() % 100000}`,
      reason,
      movementDate: new Date(),
      createdById: userId
    }, { transaction: t });

    await t.commit();

    res.status(201).json({
      message: 'Movimiento de inventario registrado con éxito.',
      movement,
      doctorFee: createdDoctorFee,
      updatedStock: item.stockCurrent
    });
  } catch (error) {
    await t.rollback();
    res.status(500).json({ message: error.message });
  }
};

// Get Movement History / Kardex
exports.getMovements = async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const isSuperAdmin = isPlatformAdmin(req);
    const { itemId, movementType, patientId, doctorId, startDate, endDate } = req.query;

    const where = {};
    if (!isSuperAdmin && orgId) where.organizationId = orgId;
    if (itemId) where.itemId = itemId;
    if (movementType) where.movementType = movementType;
    if (patientId) where.patientId = patientId;
    if (doctorId) where.doctorId = doctorId;

    if (startDate && endDate) {
      where.movementDate = { [Op.between]: [new Date(startDate), new Date(endDate)] };
    }

    const movements = await InventoryMovement.findAll({
      where,
      include: [
        { model: InventoryItem, attributes: ['id', 'code', 'name', 'unit', 'itemType', 'category'] },
        { model: Patient, include: [{ model: User, attributes: ['firstName', 'lastName'] }] },
        { model: Doctor, include: [{ model: User, attributes: ['firstName', 'lastName'] }] },
        { model: DoctorFee, attributes: ['id', 'netPayableUSD', 'status', 'receiptNumber'] }
      ],
      order: [['movementDate', 'DESC']]
    });

    res.json(movements);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Summary & Stock Alerts
exports.getInventoryAlerts = async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const isSuperAdmin = isPlatformAdmin(req);
    const where = { isActive: true, itemType: { [Op.ne]: 'SERVICE' } };
    if (!isSuperAdmin && orgId) where.organizationId = orgId;

    const items = await InventoryItem.findAll({ where });
    const today = new Date();
    const alert30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

    const lowStockItems = [];
    const expiringItems = [];
    const expiredItems = [];

    items.forEach(it => {
      const stock = parseFloat(it.stockCurrent || 0);
      const min = parseFloat(it.stockMin || 5);
      if (stock <= min) {
        lowStockItems.push({
          id: it.id,
          code: it.code,
          name: it.name,
          stockCurrent: stock,
          stockMin: min,
          unit: it.unit,
          location: it.location
        });
      }

      if (it.expiryDate) {
        const exp = new Date(it.expiryDate);
        if (exp < today) {
          expiredItems.push({
            id: it.id,
            code: it.code,
            name: it.name,
            batchNumber: it.batchNumber,
            expiryDate: it.expiryDate,
            stockCurrent: stock
          });
        } else if (exp <= alert30Days) {
          expiringItems.push({
            id: it.id,
            code: it.code,
            name: it.name,
            batchNumber: it.batchNumber,
            expiryDate: it.expiryDate,
            stockCurrent: stock
          });
        }
      }
    });

    res.json({
      lowStockCount: lowStockItems.length,
      expiringCount: expiringItems.length,
      expiredCount: expiredItems.length,
      lowStockItems,
      expiringItems,
      expiredItems
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete item (Soft delete)
exports.deleteItem = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await InventoryItem.findByPk(id);
    if (!item) {
      return res.status(404).json({ message: 'Ítem no encontrado.' });
    }

    const orgId = getOrgId(req);
    const isSuperAdmin = isPlatformAdmin(req);
    if (!isSuperAdmin && orgId && item.organizationId && item.organizationId !== orgId) {
      return res.status(403).json({ message: 'No tienes permisos para eliminar este ítem de otra clínica' });
    }

    await item.destroy();
    res.json({ message: 'Producto/servicio retirado del inventario exitosamente.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
