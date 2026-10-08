const express = require('express');
const router = express.Router();
const doctorFeeController = require('../controllers/doctorFee.controller');
const auth = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/authorization.middleware');

// Doctor configs & baremos
router.get('/doctor-configs', auth, authorize('doctor-fees:read'), doctorFeeController.getDoctorConfigs);
router.put('/doctor-configs/:doctorId', auth, authorize('doctor-fees:write'), doctorFeeController.updateDoctorConfig);

// Doctor fees CXP queries and creation
router.get('/', auth, authorize('doctor-fees:read'), doctorFeeController.getDoctorFees);
router.post('/', auth, authorize('doctor-fees:write'), doctorFeeController.createDoctorFee);

// Process single / batch CXP payments
router.post('/pay', auth, authorize('doctor-fees:pay'), doctorFeeController.payDoctorFees);

// Receipt query by token (public query with verification token)
router.get('/receipt/:token', doctorFeeController.getReceiptByToken);

module.exports = router;
