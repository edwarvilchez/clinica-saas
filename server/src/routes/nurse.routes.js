const express = require('express');
const router = express.Router();
const nurseController = require('../controllers/nurse.controller');
const authMiddleware = require('../middlewares/auth.middleware');

router.get('/', authMiddleware, nurseController.getNurses);
router.post('/', authMiddleware, nurseController.createNurse);
router.delete('/:id', authMiddleware, nurseController.deleteNurse);

module.exports = router;
