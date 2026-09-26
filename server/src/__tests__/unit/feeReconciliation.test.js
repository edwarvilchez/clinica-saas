/**
 * ==============================================================================
 * JEST SUITE: MEDICUSVE DOCTOR FEE RECONCILIATION & PHARMACY DISCOUNT ENGINE
 * ==============================================================================
 * @file        feeReconciliation.test.js
 * @description Unit, integration, and regression tests for doctor revenue splits,
 *              reconciliation status, and direct pharmacy discount deductions.
 * ==============================================================================
 */

const sequelize = require('../../config/db.config');
const { Payment } = require('../../models');
const paymentController = require('../../controllers/payment.controller');

describe('💰 Medicusve Doctor Fee Reconciliation & Pharmacy Discount Engine', () => {
  let testPayment;

  beforeAll(async () => {
    await sequelize.sync();

    testPayment = await Payment.create({
      amount: 100.00,
      currency: 'USD',
      method: 'Cash',
      status: 'Paid',
      concept: 'Consulta Cardiología Medicusve',
      paymentType: 'APPOINTMENT'
    });
  });

  afterAll(async () => {
    if (testPayment) await Payment.destroy({ where: { id: testPayment.id }, force: true });
  });

  describe('1. Unit & Integration Tests: Doctor Fee Reconciliation Split', () => {
    test('Reconciliación de honorarios: Divide $100 en $70 (Médico 70%) y $30 (Clínica 30%)', async () => {
      const req = {
        body: {
          paymentId: testPayment.id,
          doctorFeePercentage: 70.00
        }
      };
      let resJson;
      const res = {
        json: (data) => { resJson = data; },
        status: () => res
      };

      await paymentController.reconcileDoctorFees(req, res);

      expect(resJson).toBeDefined();
      expect(resJson.reconciliation.doctorFeeAmount).toBe('70.00');
      expect(resJson.reconciliation.clinicFeeAmount).toBe('30.00');
      expect(resJson.reconciliation.reconciliationStatus).toBe('RECONCILED');

      const updatedPayment = await Payment.findByPk(testPayment.id);
      expect(updatedPayment.reconciliationStatus).toBe('RECONCILED');
    });

    test('Rechazo de reconciliación si el ID de pago no es proporcionado', async () => {
      const req = { body: {} };
      let statusCode;
      const res = {
        json: () => {},
        status: (code) => { statusCode = code; return res; }
      };

      await paymentController.reconcileDoctorFees(req, res);
      expect(statusCode).toBe(400);
    });
  });

  describe('2. Integration Tests: Direct Pharmacy Discount Deduction', () => {
    test('Aplicación de $15 de descuento en farmacia reduce el pago total de $100 a $85', async () => {
      const req = {
        body: {
          paymentId: testPayment.id,
          discountAmount: 15.00
        }
      };
      let resJson;
      const res = {
        json: (data) => { resJson = data; },
        status: () => res
      };

      await paymentController.applyPharmacyDiscount(req, res);

      expect(resJson.discountBreakdown.originalAmount).toBe('100.00');
      expect(resJson.discountBreakdown.pharmacyDiscountApplied).toBe('15.00');
      expect(resJson.discountBreakdown.finalAdjustedAmount).toBe('85.00');
    });
  });

  describe('3. Regression Tests: Discount Exceeding Total Amount Rejection', () => {
    test('Rechazo de descuento de farmacia mayor o igual al monto total del pago', async () => {
      const req = {
        body: {
          paymentId: testPayment.id,
          discountAmount: 500.00 // Exceeds current amount 85.00
        }
      };
      let statusCode;
      const res = {
        json: () => {},
        status: (code) => { statusCode = code; return res; }
      };

      await paymentController.applyPharmacyDiscount(req, res);
      expect(statusCode).toBe(400);
    });
  });
});
