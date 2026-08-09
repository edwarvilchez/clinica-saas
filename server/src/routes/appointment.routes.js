const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointment.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/authorization.middleware');
const validate = require('../middlewares/validate.middleware');
const {
  createAppointmentSchema,
  updateAppointmentSchema,
  appointmentIdSchema,
} = require('../validators/appointment.validator');

/**
 * @swagger
 * tags:
 *   name: Appointments
 *   description: Gestión de citas médicas
 */

/**
 * @swagger
 * /api/appointments:
 *   get:
 *     summary: Obtener lista de citas (con paginación)
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Número de página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Citas por página
 *     responses:
 *       200:
 *         description: Lista de citas con paginación
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 appointments:
 *                   type: array
 *                   items:
 *                     type: object
 *                 totalPages:
 *                   type: integer
 *                 currentPage:
 *                   type: integer
 *                 total:
 *                   type: integer
 */
router.get('/', authMiddleware, authorize('appointments:read'), appointmentController.getAppointments);

/**
 * @swagger
 * /api/appointments:
 *   post:
 *     summary: Crear nueva cita
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [patientId, doctorId, appointmentDate, appointmentTime]
 *             properties:
 *               patientId:
 *                 type: string
 *                 format: uuid
 *               doctorId:
 *                 type: string
 *                 format: uuid
 *               appointmentDate:
 *                 type: string
 *                 format: date
 *               appointmentTime:
 *                 type: string
 *                 pattern: '^([01]\d|2[0-3]):([0-5]\d)$'
 *                 example: "10:00"
 *               reason:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Cita creada exitosamente
 *       400:
 *         description: Error de validación
 */
const { checkSubscriptionActive, checkAppointmentQuota } = require('../middlewares/quotaEnforcer.middleware');

router.post('/', authMiddleware, checkSubscriptionActive, checkAppointmentQuota, authorize('appointments:write'), validate(createAppointmentSchema), appointmentController.createAppointment);

/**
 * @swagger
 * /api/appointments/{id}/status:
 *   patch:
 *     summary: Actualizar estado de cita
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [Pending, Confirmed, Completed, Cancelled]
 *     responses:
 *       200:
 *         description: Estado actualizado
 */
router.patch('/:id/status', authMiddleware, authorize('appointments:write'), validate(appointmentIdSchema, 'params'), appointmentController.updateStatus);

/**
 * @swagger
 * /api/appointments/{id}/cancel:
 *   post:
 *     summary: Cancelar cita
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Cita cancelada
 */
router.post('/:id/cancel', authMiddleware, authorize('appointments:delete'), validate(appointmentIdSchema, 'params'), appointmentController.cancelAppointment);

/**
 * @swagger
 * /api/appointments/{id}/reschedule:
 *   post:
 *     summary: Reprogramar cita
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               appointmentDate:
 *                 type: string
 *                 format: date
 *               appointmentTime:
 *                 type: string
 *     responses:
 *       200:
 *         description: Cita reprogramada
 */
router.post('/:id/reschedule', authMiddleware, authorize('appointments:write'), validate(appointmentIdSchema, 'params'), validate(updateAppointmentSchema), appointmentController.rescheduleAppointment);

module.exports = router;
