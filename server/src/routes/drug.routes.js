const express = require('express');
const router = express.Router();
const drugController = require('../controllers/drug.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');
const { authorize } = require('../middlewares/authorization.middleware');
const checkSubscription = require('../middlewares/subscription.middleware');

const STAFF_ROLES = ['SUPERADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST', 'ADMINISTRATIVE'];

// All routes require authentication and staff role
router.use(authMiddleware);
router.use(checkSubscription);
router.use(roleMiddleware(STAFF_ROLES));

/**
 * @swagger
 * /api/drugs:
 *   get:
 *     summary: List drugs with search and filtering
 *     tags: [Drugs]
 */
router.get('/', authorize('drugs:read'), drugController.getAllDrugs);

/**
 * @swagger
 * /api/drugs/{id}:
 *   get:
 *     summary: Get drug by ID
 *     tags: [Drugs]
 */
router.get('/:id', authorize('drugs:read'), drugController.getDrugById);

/**
 * @swagger
 * /api/drugs:
 *   post:
 *     summary: Create new drug (SuperAdmin/Doctor/Nurse)
 *     tags: [Drugs]
 */
router.post('/', authorize('drugs:write'), drugController.createDrug);

/**
 * @swagger
 * /api/drugs/{id}:
 *   put:
 *     summary: Update drug
 *     tags: [Drugs]
 */
router.put('/:id', authorize('drugs:write'), drugController.updateDrug);

/**
 * @swagger
 * /api/drugs/{id}:
 *   delete:
 *     summary: Delete drug
 *     tags: [Drugs]
 */
router.delete('/:id', authorize('drugs:delete'), drugController.deleteDrug);

module.exports = router;
