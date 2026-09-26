const express = require('express');
const router = express.Router();
const specialtyController = require('../controllers/specialty.controller');
const auth = require('../middlewares/auth.middleware');

router.get('/', specialtyController.getAllSpecialties);
router.post('/', auth, specialtyController.createSpecialty);
router.put('/:id', auth, specialtyController.updateSpecialty);
router.delete('/:id', auth, specialtyController.deleteSpecialty);

module.exports = router;
