const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');
const authMiddleware = require('../middlewares/auth.middleware');

const { createUpload } = require('../middlewares/upload.middleware');
const upload = createUpload({ dest: 'uploads/', maxSize: 5 * 1024 * 1024, allowedTypes: [
  'application/pdf', 'image/png', 'image/jpeg', 'image/jpg'
] });

// Specific route for subscription payments (no receipt required initially or handled inside)
router.post('/subscription', authMiddleware, upload.single('receipt'), paymentController.createSubscriptionPayment);
router.post('/subscription/guest', upload.single('receipt'), paymentController.createSubscriptionPayment);

router.post('/', authMiddleware, upload.single('receipt'), paymentController.createPayment);
router.get('/', authMiddleware, paymentController.getPayments);
router.post('/collect/:id', authMiddleware, paymentController.collectPayment);
router.put('/:id', authMiddleware, upload.single('receipt'), paymentController.updatePayment);
router.delete('/:id', authMiddleware, paymentController.deletePayment);

module.exports = router;
