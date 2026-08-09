const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/authorization.middleware');

const { createUpload } = require('../middlewares/upload.middleware');
const upload = createUpload({ dest: 'uploads/', maxSize: 5 * 1024 * 1024, allowedTypes: [
  'application/pdf', 'image/png', 'image/jpeg', 'image/jpg'
] });

// Specific route for subscription payments (no receipt required initially or handled inside)
router.post('/subscription', authMiddleware, upload.single('receipt'), paymentController.createSubscriptionPayment);
router.post('/subscription/guest', upload.single('receipt'), paymentController.createSubscriptionPayment);

router.post('/', authMiddleware, authorize('payments:write'), upload.single('receipt'), paymentController.createPayment);
router.get('/', authMiddleware, authorize('payments:read'), paymentController.getPayments);
router.post('/collect/:id', authMiddleware, authorize('payments:write'), paymentController.collectPayment);
router.post('/reconcile-doctor-fees', authMiddleware, authorize('payments:write'), paymentController.reconcileDoctorFees);
router.post('/apply-pharmacy-discount', authMiddleware, authorize('payments:write'), paymentController.applyPharmacyDiscount);
router.put('/:id', authMiddleware, authorize('payments:write'), upload.single('receipt'), paymentController.updatePayment);
router.delete('/:id', authMiddleware, authorize('payments:delete'), paymentController.deletePayment);

module.exports = router;
