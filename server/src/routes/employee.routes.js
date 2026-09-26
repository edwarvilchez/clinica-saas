const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employee.controller');
const auth = require('../middlewares/auth.middleware');

router.get('/', auth, employeeController.getEmployees);
router.post('/', auth, employeeController.createEmployee);
router.put('/:id', auth, employeeController.updateEmployee);

module.exports = router;
