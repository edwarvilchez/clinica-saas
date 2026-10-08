const express = require('express');
const router = express.Router();
const teamController = require('../controllers/team.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/authorization.middleware');

router.post('/add', authMiddleware, authorize('team:write'), teamController.addMember);
router.get('/', authMiddleware, authorize('team:read'), teamController.getTeam);
router.delete('/:id', authMiddleware, authorize('team:write'), teamController.removeMember);

module.exports = router;
