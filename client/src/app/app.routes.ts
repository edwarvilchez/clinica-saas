import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { roleGuard } from './guards/role.guard';
import { firstLoginGuard } from './guards/first-login.guard';

export const routes: Routes = [
  // Public routes - no auth required
  {
    path: 'landing',
    loadComponent: () => import('./components/landing/landing').then(m => m.LandingComponent),
    title: 'Clinica - SaaS - Plataforma Médica Hospitalaria'
  },
  {
    path: 'login',
    loadComponent: () => import('./components/login/login').then(m => m.Login),
    title: 'Clinica - SaaS - Iniciar Sesión'
  },
  {
    path: 'register',
    loadComponent: () => import('./components/register/register').then(m => m.Register),
    title: 'Clinica - SaaS - Registro de Pacientes'
  },
  {
    path: 'forgot-password',
    loadComponent: () => import('./components/forgot-password/forgot-password').then(m => m.ForgotPassword),
    title: 'Clinica - SaaS - Recuperar Contraseña'
  },
  {
    path: 'reset-password/:token',
    loadComponent: () => import('./components/reset-password/reset-password').then(m => m.ResetPassword),
    title: 'Clinica - SaaS - Restablecer Contraseña'
  },
  {
    path: 'agendar-cita',
    loadComponent: () => import('./components/public-booking/public-booking').then(m => m.PublicBooking),
    title: 'Clinica - SaaS - Agendar Cita'
  },
  {
    path: 'subscription',
    loadComponent: () => import('./components/subscription/subscription').then(m => m.Subscription),
    title: 'Clinica - SaaS - Planes y Precios'
  },
  {
    path: 'doctor-fee-receipt/:token',
    loadComponent: () => import('./components/doctor-fee-receipt/doctor-fee-receipt').then(m => m.DoctorFeeReceiptComponent),
    title: 'Clinica - SaaS - Comprobante de Pago de Honorarios'
  },
  {
    path: 'insurance-claim-voucher/:token',
    loadComponent: () => import('./components/insurance-claim-voucher/insurance-claim-voucher').then(m => m.InsuranceClaimVoucherComponent),
    title: 'Clinica - SaaS - Comprobante de Reclamo a Aseguradora'
  },

  // Default redirect
  {
    path: '',
    redirectTo: 'landing',
    pathMatch: 'full'
  },

  // Ruta especial: cambio de contraseña obligatorio en primer ingreso
  {
    path: 'change-password-first',
    loadComponent: () => import('./components/change-password-first-login/change-password-first-login')
      .then(m => m.ChangePasswordFirstLogin),
    canActivate: [authGuard],
    title: 'Clinica - SaaS - Cambio de Contraseña Requerido'
  },

  // Protected routes - require auth
  {
    path: 'dashboard',
    loadComponent: () => import('./components/dashboard/dashboard').then(m => m.Dashboard),
    canActivate: [authGuard, firstLoginGuard],
    title: 'Clinica - SaaS - Panel Principal'
  },
  {
    path: 'patients',
    loadComponent: () => import('./components/patients/patients').then(m => m.Patients),
    canActivate: [authGuard, roleGuard, firstLoginGuard],
    data: { roles: ['SUPERADMIN', 'ADMINISTRATIVE', 'DOCTOR', 'NURSE'] },
    title: 'Clinica - SaaS - Gestión de Pacientes'
  },
  {
    path: 'appointments',
    loadComponent: () => import('./components/appointments/appointments').then(m => m.Appointments),
    canActivate: [authGuard, firstLoginGuard],
    title: 'Clinica - SaaS - Gestión de Citas'
  },
  {
    path: 'video-history',
    loadComponent: () => import('./components/video-history/video-history').then(m => m.VideoHistory),
    canActivate: [authGuard, roleGuard, firstLoginGuard],
    data: { roles: ['SUPERADMIN', 'ADMINISTRATIVE', 'DOCTOR', 'PATIENT'] },
    title: 'Clinica - SaaS - Historial de Videoconsultas'
  },
  {
    path: 'doctors',
    loadComponent: () => import('./components/doctors/doctors').then(m => m.Doctors),
    canActivate: [authGuard, roleGuard, firstLoginGuard],
    data: { roles: ['SUPERADMIN', 'ADMINISTRATIVE'] },
    title: 'Clinica - SaaS - Gestión de Doctores'
  },
  {
    path: 'nurses',
    loadComponent: () => import('./components/nurses/nurses').then(m => m.Nurses),
    canActivate: [authGuard, roleGuard, firstLoginGuard],
    data: { roles: ['SUPERADMIN', 'ADMINISTRATIVE'] },
    title: 'Clinica - SaaS - Gestión de Enfermeras'
  },
  {
    path: 'staff',
    loadComponent: () => import('./components/staff/staff').then(m => m.Staff),
    canActivate: [authGuard, roleGuard, firstLoginGuard],
    data: { roles: ['SUPERADMIN'] },
    title: 'Clinica - SaaS - Personal Administrativo'
  },
  {
    path: 'history',
    loadComponent: () => import('./components/medical-history/medical-history').then(m => m.MedicalHistory),
    canActivate: [authGuard, roleGuard, firstLoginGuard],
    data: { roles: ['SUPERADMIN', 'DOCTOR', 'NURSE'] },
    title: 'Clinica - SaaS - Historial Médico'
  },
  {
    path: 'lab-catalog',
    loadComponent: () => import('./components/lab-catalog/lab-catalog').then(m => m.LabCatalog),
    canActivate: [authGuard, roleGuard, firstLoginGuard],
    data: { roles: ['SUPERADMIN', 'DOCTOR', 'NURSE', 'ADMINISTRATIVE', 'PATIENT'] },
    title: 'Clinica - SaaS - Catálogo de Laboratorio'
  },
  {
    path: 'lab-results',
    loadComponent: () => import('./components/lab-results/lab-results').then(m => m.LabResults),
    canActivate: [authGuard, roleGuard, firstLoginGuard],
    data: { roles: ['SUPERADMIN', 'DOCTOR', 'NURSE', 'ADMINISTRATIVE', 'PATIENT'] },
    title: 'Clinica - SaaS - Resultados de Laboratorio'
  },
  {
    path: 'video-call/:id',
    loadComponent: () => import('./components/video-call/video-call.component').then(m => m.VideoCallComponent),
    canActivate: [authGuard, roleGuard, firstLoginGuard],
    data: { roles: ['SUPERADMIN', 'DOCTOR', 'PATIENT'] },
    title: 'Clinica - SaaS - Videoconsulta'
  },
  {
    path: 'payments',
    loadComponent: () => import('./components/payments/payments').then(m => m.Payments),
    canActivate: [authGuard, roleGuard, firstLoginGuard],
    data: { roles: ['SUPERADMIN', 'ADMINISTRATIVE', 'PATIENT'] },
    title: 'Clinica - SaaS - Control de Pagos'
  },
  {
    path: 'bulk-import',
    loadComponent: () => import('./components/bulk-data/bulk-data').then(m => m.BulkData),
    canActivate: [authGuard, roleGuard, firstLoginGuard],
    data: { roles: ['SUPERADMIN'] },
    title: 'Clinica - SaaS - Carga Masiva'
  },
  {
    path: 'team',
    loadComponent: () => import('./components/team/team.component').then(m => m.TeamComponent),
    canActivate: [authGuard, roleGuard, firstLoginGuard],
    data: { roles: ['SUPERADMIN', 'ADMINISTRATIVE', 'DOCTOR'] },
    title: 'Clinica - SaaS - Gestión de Equipo'
  },
  {
    path: 'drug-guide',
    loadComponent: () => import('./components/drug-guide/drug-guide').then(m => m.DrugGuideComponent),
    canActivate: [authGuard, roleGuard, firstLoginGuard],
    data: { roles: ['SUPERADMIN', 'ADMINISTRATIVE', 'DOCTOR', 'NURSE', 'RECEPTIONIST'] },
    title: 'Clinica - SaaS - Guía Farmacéutica'
  },
  {
    path: 'billing',
    loadComponent: () => import('./components/billing/billing').then(m => m.Billing),
    canActivate: [authGuard, firstLoginGuard],
    title: 'Clinica - SaaS - Mi Suscripción'
  },
  {
    path: 'branding',
    loadComponent: () => import('./components/branding/branding').then(m => m.Branding),
    canActivate: [authGuard, roleGuard, firstLoginGuard],
    data: { roles: ['SUPERADMIN', 'ADMINISTRATIVE', 'DOCTOR'] },
    title: 'Clinica - SaaS - Imagen Corporativa'
  },
  {
    path: 'platform-admin',
    loadComponent: () => import('./components/platform-admin/platform-admin').then(m => m.PlatformAdmin),
    canActivate: [authGuard, roleGuard, firstLoginGuard],
    data: { roles: ['SUPERADMIN', 'PLATFORM_ADMIN'] },
    title: 'Clinica - SaaS - Gestión Global'
  },

  // --- NEW INTEGRATED CLINICAL & FINANCIAL MODULES ---
  {
    path: 'specialties',
    loadComponent: () => import('./components/specialties/specialties').then(m => m.SpecialtiesComponent),
    canActivate: [authGuard, roleGuard, firstLoginGuard],
    data: { roles: ['SUPERADMIN', 'ADMINISTRATIVE'] },
    title: 'Clinica - SaaS - Especialidades Médicas'
  },
  {
    path: 'insurance',
    loadComponent: () => import('./components/insurance/insurance').then(m => m.InsuranceComponent),
    canActivate: [authGuard, roleGuard, firstLoginGuard],
    data: { roles: ['SUPERADMIN', 'ADMINISTRATIVE'] },
    title: 'Clinica - SaaS - Seguros y Baremos'
  },
  {
    path: 'doctor-fees',
    loadComponent: () => import('./components/doctor-fees/doctor-fees').then(m => m.DoctorFeesComponent),
    canActivate: [authGuard, roleGuard, firstLoginGuard],
    data: { roles: ['SUPERADMIN', 'ADMINISTRATIVE', 'DOCTOR'] },
    title: 'Clinica - SaaS - Honorarios Médicos'
  },
  {
    path: 'accounting',
    loadComponent: () => import('./components/accounting/accounting').then(m => m.AccountingComponent),
    canActivate: [authGuard, roleGuard, firstLoginGuard],
    data: { roles: ['SUPERADMIN', 'ADMINISTRATIVE'] },
    title: 'Clinica - SaaS - Contabilidad VEN-NIF'
  },
  {
    path: 'sales',
    loadComponent: () => import('./components/sales/sales').then(m => m.SalesComponent),
    canActivate: [authGuard, roleGuard, firstLoginGuard],
    data: { roles: ['SUPERADMIN', 'ADMINISTRATIVE', 'DOCTOR'] },
    title: 'Clinica - SaaS - Ventas y Presupuestos'
  },
  {
    path: 'inventory',
    loadComponent: () => import('./components/inventory/inventory').then(m => m.InventoryComponent),
    canActivate: [authGuard, roleGuard, firstLoginGuard],
    data: { roles: ['SUPERADMIN', 'ADMINISTRATIVE', 'DOCTOR', 'NURSE'] },
    title: 'Clinica - SaaS - Inventario, Productos y Servicios'
  },
  {
    path: 'employees',
    loadComponent: () => import('./components/employees/employees').then(m => m.EmployeesComponent),
    canActivate: [authGuard, roleGuard, firstLoginGuard],
    data: { roles: ['SUPERADMIN', 'ADMINISTRATIVE'] },
    title: 'Clinica - SaaS - Gestión de Empleados'
  },
  {
    path: 'hospital-ops',
    loadComponent: () => import('./components/hospital-ops/hospital-ops').then(m => m.HospitalOpsComponent),
    canActivate: [authGuard, roleGuard, firstLoginGuard],
    data: { roles: ['SUPERADMIN', 'ADMINISTRATIVE', 'DOCTOR', 'NURSE'] },
    title: 'Clinica - SaaS - Operaciones Hospitalarias'
  },

  // Catch all - redirect to dashboard
  { path: '**', redirectTo: 'dashboard' }
];
