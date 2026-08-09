/**
 * ==============================================================================
 * JEST SUITE: PHARMACY FEFO DISPENSATION ENGINE
 * ==============================================================================
 * @file        pharmacyFEFO.test.js
 * @description Unit, integration, and regression tests for FEFO (First Expired, First Out)
 *              batch stock deduction and expiration enforcement.
 * ==============================================================================
 */

const sequelize = require('../../config/db.config');
const PharmacyItem = require('../../addons_core/pharmacy/models/PharmacyItem');
const PharmacyBatch = require('../../addons_core/pharmacy/models/PharmacyBatch');
const pharmacyController = require('../../addons_core/pharmacy/controllers/pharmacy.controller');

describe('💊 Pharmacy FEFO (First Expired, First Out) Engine', () => {

  let testItem;
  let batchEarliest;
  let batchLater;
  let batchExpired;

  beforeAll(async () => {
    await sequelize.sync();

    // Create test pharmacy item
    testItem = await PharmacyItem.create({
      code: 'MED-FEFO-001',
      tradeName: 'Ibuprofeno 400mg Lotes',
      genericName: 'Ibuprofeno',
      presentation: 'Caja 20 Tabletas',
      unitPrice: 5.50
    });

    const today = new Date();
    const in10Days = new Date(today.getTime() + 10 * 24 * 3600000).toISOString().split('T')[0];
    const in60Days = new Date(today.getTime() + 60 * 24 * 3600000).toISOString().split('T')[0];
    const pastDate = new Date(today.getTime() - 10 * 24 * 3600000).toISOString().split('T')[0];

    // Batch A: Expires in 10 days (Should be dispensed FIRST)
    batchEarliest = await PharmacyBatch.create({
      itemId: testItem.id,
      batchNumber: 'LOTE-EARLY-10',
      expirationDate: in10Days,
      quantity: 15,
      costPrice: 2.00,
      status: 'AVAILABLE'
    });

    // Batch B: Expires in 60 days (Should be dispensed SECOND)
    batchLater = await PharmacyBatch.create({
      itemId: testItem.id,
      batchNumber: 'LOTE-LATER-60',
      expirationDate: in60Days,
      quantity: 50,
      costPrice: 2.10,
      status: 'AVAILABLE'
    });

    // Batch C: Expired 10 days ago (Should NEVER be dispensed)
    batchExpired = await PharmacyBatch.create({
      itemId: testItem.id,
      batchNumber: 'LOTE-EXPIRED-OLD',
      expirationDate: pastDate,
      quantity: 100,
      costPrice: 1.50,
      status: 'EXPIRED'
    });
  });

  afterAll(async () => {
    if (testItem) {
      await PharmacyBatch.destroy({ where: { itemId: testItem.id } });
      await PharmacyItem.destroy({ where: { id: testItem.id } });
    }
  });

  describe('1. Unit & Integration Tests: FEFO Batch Priority Stock Deduction', () => {
    test('Descuento automático priorizando el lote con fecha de caducidad más cercana (FEFO)', async () => {
      const req = {
        body: {
          itemId: testItem.id,
          requestedQuantity: 10
        }
      };
      let resJson;
      const res = {
        json: (data) => { resJson = data; },
        status: () => res
      };

      await pharmacyController.dispenseFEFO(req, res);

      expect(resJson).toBeDefined();
      expect(resJson.dispensedQuantity).toBe(10);
      expect(resJson.deductedBatches.length).toBe(1);
      expect(resJson.deductedBatches[0].batchNumber).toBe('LOTE-EARLY-10'); // Must be LOTE-EARLY-10

      // Verify batch quantity in DB
      const updatedBatchA = await PharmacyBatch.findByPk(batchEarliest.id);
      expect(updatedBatchA.quantity).toBe(5); // 15 - 10 = 5
    });

    test('Dispensación multilote: Agota el primer lote y continua en el segundo lote sin afectar al vencido', async () => {
      // We request 10 units: 5 remaining in LOTE-EARLY-10 and 5 from LOTE-LATER-60
      const req = {
        body: {
          itemId: testItem.id,
          requestedQuantity: 10
        }
      };
      let resJson;
      const res = {
        json: (data) => { resJson = data; },
        status: () => res
      };

      await pharmacyController.dispenseFEFO(req, res);

      expect(resJson).toBeDefined();
      expect(resJson.deductedBatches.length).toBe(2);
      expect(resJson.deductedBatches[0].batchNumber).toBe('LOTE-EARLY-10');
      expect(resJson.deductedBatches[0].quantityDeducted).toBe(5);
      expect(resJson.deductedBatches[1].batchNumber).toBe('LOTE-LATER-60');
      expect(resJson.deductedBatches[1].quantityDeducted).toBe(5);

      const batchA = await PharmacyBatch.findByPk(batchEarliest.id);
      expect(batchA.status).toBe('EXHAUSTED');
    });
  });

  describe('2. Regression Tests: Rejection of Expired Stock & Insufficient Quantities', () => {
    test('Rechazo de dispensación si excede la cantidad total disponible en lotes vigentes', async () => {
      const req = {
        body: {
          itemId: testItem.id,
          requestedQuantity: 999
        }
      };
      let resJson;
      let statusCode;
      const res = {
        json: (data) => { resJson = data; },
        status: (code) => { statusCode = code; return res; }
      };

      await pharmacyController.dispenseFEFO(req, res);

      expect(statusCode).toBe(400);
      expect(resJson.error).toBe('INSUFFICIENT_FEFO_STOCK');
    });
  });
});
