const express = require('express');
const router = express.Router();
const specialtyController = require('../controllers/specialty.controller');
const auth = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/authorization.middleware');

router.get('/', specialtyController.getAllSpecialties);
router.post('/', auth, authorize('specialties:write'), specialtyController.createSpecialty);
router.put('/:id', auth, authorize('specialties:write'), specialtyController.updateSpecialty);
router.delete('/:id', auth, authorize('specialties:write'), specialtyController.deleteSpecialty);

module.exports = router;
