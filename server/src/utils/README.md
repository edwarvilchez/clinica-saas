# Utils Directory

This directory contains utility scripts. They are organized as follows:

## Production Scripts (safe to use in all environments)

- **sanitize.js** - Input sanitization middleware
- **scheduler.js** - Background job scheduler (cron)
- **logger.js** - Structured logging utility
- **emailTemplates.js** - Email template generators
- **sendEmail.js** - Email sending service
- **whatsapp.service.js** - WhatsApp notification service
- **validateEnv.js** - Environment variable validation
- **queues.js** - Job queue management
- **auditTrail.js** - Audit logging for compliance
- **cache.js** - Caching utilities
- **migrationManager.js** - Database migration manager

## Development/Testing Scripts

- **seeder.js** - Role seeding
- **testSeeder.js** - Test data seeding
- **testAppointmentFlow.js** - Test appointment creation

## Maintenance/Debug Scripts (DO NOT use in production)

Scripts in `_debug/` folder are for development and debugging only:

- **debugMiguel.js** - Debug utilities
- **debugAppointments.js** - Appointment debugging
- **checkVC.js** - Video consultation checks
- **fixPassword.js** - Password reset utility
- **fixData.js** - Data fix utilities
- **fixDatabase.js** - Database fixes
- **fixMigration.js** - Migration fixes
- **resetDb.js** - Database reset
- **createSuperAdmin.js** - Super admin creation
- **createTestUsers.js** - Test user creation
- **grantPermissions.js** - Permission setup
- **setupEnvironments.js** - Environment setup

## One-time Migration Scripts

Scripts starting with `add*`, `update*`, `migrate*` are one-time migration scripts that can be deleted after use:

- **addResetColumns.js**
- **addReminderColumn.js**
- **addEndDateColumn.js**
- **updatePaymentsTable.js**
- **updatePatientsPhone.js**
- **migrateRecords.js**
- **fixMigrationV2.js**
- **seedSpecialties.js**
- **seedPayments.js**
- **seedOperationalData.js**
- **seedVideoReadyAppointment.js**

## Testing Utilities

- **testEmail.js** - Email testing utility
