const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employee.controller');
const auth = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/authorization.middleware');

router.get('/', auth, authorize('employees:read'), employeeController.getEmployees);
router.post('/', auth, authorize('employees:write'), employeeController.createEmployee);
router.put('/:id', auth, authorize('employees:write'), employeeController.updateEmployee);

module.exports = router;
