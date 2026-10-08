const express = require('express');
const router = express.Router();
const nurseController = require('../controllers/nurse.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/authorization.middleware');

router.get('/', authMiddleware, authorize('nurses:read'), nurseController.getNurses);
router.post('/', authMiddleware, authorize('nurses:write'), nurseController.createNurse);
router.delete('/:id', authMiddleware, authorize('nurses:delete'), nurseController.deleteNurse);

module.exports = router;
