const express = require('express');
const router = express.Router();
const doctorFeeController = require('../controllers/doctorFee.controller');
const auth = require('../middlewares/auth.middleware');

// Doctor configs & baremos
router.get('/doctor-configs', auth, doctorFeeController.getDoctorConfigs);
router.put('/doctor-configs/:doctorId', auth, doctorFeeController.updateDoctorConfig);

// Doctor fees CXP queries and creation
router.get('/', auth, doctorFeeController.getDoctorFees);
router.post('/', auth, doctorFeeController.createDoctorFee);

// Process single / batch CXP payments
router.post('/pay', auth, doctorFeeController.payDoctorFees);

// Receipt query by token
router.get('/receipt/:token', doctorFeeController.getReceiptByToken);

module.exports = router;
