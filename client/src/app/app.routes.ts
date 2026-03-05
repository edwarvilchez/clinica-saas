import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { roleGuard } from './guards/role.guard';
import { firstLoginGuard } from './guards/first-login.guard';

export const routes: Routes = [
  // Public routes - no auth required
  {
    path: 'login',
    loadComponent: () => import('./components/login/login').then(m => m.Login),
    title: 'Medicus - Iniciar Sesión'
  },
  {
    path: 'register',
    loadComponent: () => import('./components/register/register').then(m => m.Register),
    title: 'Medicus - Registro de Pacientes'
  },
  {
    path: 'forgot-password',
    loadComponent: () => import('./components/forgot-password/forgot-password').then(m => m.ForgotPassword),
    title: 'Medicus - Recuperar Contraseña'
  },
  {
    path: 'reset-password/:token',
    loadComponent: () => import('./components/reset-password/reset-password').then(m => m.ResetPassword),
    title: 'Medicus - Restablecer Contraseña'
  },
  {
    path: 'agendar-cita',
    loadComponent: () => import('./components/public-booking/public-booking').then(m => m.PublicBooking),
    title: 'Medicus - Agendar Cita'
  },

  // Default redirect
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  },

  // Ruta especial: cambio de contraseña obligatorio en primer ingreso
  // Solo requiere auth, NO el firstLoginGuard (es el destino del guard)
  {
    path: 'change-password-first',
    loadComponent: () => import('./components/change-password-first-login/change-password-first-login')
      .then(m => m.ChangePasswordFirstLogin),
    canActivate: [authGuard],
    title: 'Medicus - Cambio de Contraseña Requerido'
  },

  // Protected routes - require auth
  {
    path: 'dashboard',
    loadComponent: () => import('./components/dashboard/dashboard').then(m => m.Dashboard),
    canActivate: [authGuard, firstLoginGuard],
    title: 'Medicus - Panel Principal'
  },
  {
    path: 'patients',
    loadComponent: () => import('./components/patients/patients').then(m => m.Patients),
    canActivate: [authGuard, roleGuard, firstLoginGuard],
    data: { roles: ['SUPERADMIN', 'ADMINISTRATIVE', 'DOCTOR', 'NURSE'] },
    title: 'Medicus - Gestión de Pacientes'
  },
  {
    path: 'appointments',
    loadComponent: () => import('./components/appointments/appointments').then(m => m.Appointments),
    canActivate: [authGuard, firstLoginGuard],
    title: 'Medicus - Gestión de Citas'
  },
  {
    path: 'video-history',
    loadComponent: () => import('./components/video-history/video-history').then(m => m.VideoHistory),
    canActivate: [authGuard, roleGuard, firstLoginGuard],
    data: { roles: ['SUPERADMIN', 'ADMINISTRATIVE', 'DOCTOR', 'PATIENT'] },
    title: 'Medicus - Historial de Videoconsultas'
  },
  {
    path: 'doctors',
    loadComponent: () => import('./components/doctors/doctors').then(m => m.Doctors),
    canActivate: [authGuard, roleGuard, firstLoginGuard],
    data: { roles: ['SUPERADMIN', 'ADMINISTRATIVE'] },
    title: 'Medicus - Gestión de Doctores'
  },
  {
    path: 'nurses',
    loadComponent: () => import('./components/nurses/nurses').then(m => m.Nurses),
    canActivate: [authGuard, roleGuard, firstLoginGuard],
    data: { roles: ['SUPERADMIN', 'ADMINISTRATIVE'] },
    title: 'Medicus - Gestión de Enfermeras'
  },
  {
    path: 'staff',
    loadComponent: () => import('./components/staff/staff').then(m => m.Staff),
    canActivate: [authGuard, roleGuard, firstLoginGuard],
    data: { roles: ['SUPERADMIN'] },
    title: 'Medicus - Personal Administrativo'
  },
  {
    path: 'history',
    loadComponent: () => import('./components/medical-history/medical-history').then(m => m.MedicalHistory),
    canActivate: [authGuard, roleGuard, firstLoginGuard],
    data: { roles: ['SUPERADMIN', 'DOCTOR', 'NURSE'] },
    title: 'Medicus - Historial Médico'
  },
  {
    path: 'lab-results',
    loadComponent: () => import('./components/lab-results/lab-results').then(m => m.LabResults),
    canActivate: [authGuard, roleGuard, firstLoginGuard],
    data: { roles: ['SUPERADMIN', 'DOCTOR', 'NURSE'] },
    title: 'Medicus - Resultados de Laboratorio'
  },
  {
    path: 'video-call/:id',
    loadComponent: () => import('./components/video-call/video-call.component').then(m => m.VideoCallComponent),
    canActivate: [authGuard, roleGuard, firstLoginGuard],
    data: { roles: ['SUPERADMIN', 'DOCTOR', 'PATIENT'] },
    title: 'Medicus - Videoconsulta'
  },
  {
    path: 'payments',
    loadComponent: () => import('./components/payments/payments').then(m => m.Payments),
    canActivate: [authGuard, roleGuard, firstLoginGuard],
    data: { roles: ['SUPERADMIN', 'ADMINISTRATIVE', 'PATIENT'] },
    title: 'Medicus - Control de Pagos'
  },
  {
    path: 'bulk-import',
    loadComponent: () => import('./components/bulk-data/bulk-data').then(m => m.BulkData),
    canActivate: [authGuard, roleGuard, firstLoginGuard],
    data: { roles: ['SUPERADMIN'] },
    title: 'Medicus - Carga Masiva'
  },
  {
    path: 'team',
    loadComponent: () => import('./components/team/team.component').then(m => m.TeamComponent),
    canActivate: [authGuard, roleGuard, firstLoginGuard],
    data: { roles: ['SUPERADMIN', 'ADMINISTRATIVE', 'DOCTOR'] },
    title: 'Medicus - Gestión de Equipo'
  },
  {
    path: 'subscription',
    loadComponent: () => import('./components/subscription/subscription').then(m => m.Subscription),
    canActivate: [authGuard, firstLoginGuard],
    title: 'Medicus - Planes y Precios'
  },

  // Catch all - redirect to dashboard
  { path: '**', redirectTo: 'dashboard' }
];
