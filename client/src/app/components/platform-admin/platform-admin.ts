import { Component, OnInit, inject, computed, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminService } from '../../services/admin.service';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../services/translate.pipe';
import { LanguageService } from '../../services/language.service';
import { AuthService } from '../../services/auth.service';
import { finalize } from 'rxjs/operators';
import Swal from 'sweetalert2';

const SUPERADMIN_AUTHORIZED_EMAILS = [
  'edwarvilchez1977@gmail.com',
  'admin@clinicasaas.com'
];

@Component({
  selector: 'app-platform-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './platform-admin.html',
  styleUrl: './platform-admin.css'
})
export class PlatformAdmin implements OnInit {
  private adminService = inject(AdminService);
  private langService = inject(LanguageService);
  private cdr = inject(ChangeDetectorRef);
  authService = inject(AuthService);

  organizations: any[] = [];
  users: any[] = [];
  loading = false;
  activeTab: 'orgs' | 'users' | 'admins' = 'orgs';

  searchTerm = '';
  statusOptions = ['TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED'];

  // Role helpers
  isSuperAdmin = computed(() => this.authService.hasRole(['SUPERADMIN']));
  canCreateSuperAdmin = computed(() => {
    const user = this.authService.currentUser();
    return user && SUPERADMIN_AUTHORIZED_EMAILS.includes(user.email);
  });

  // New Admin Form
  newAdmin = {
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: 'PLATFORM_ADMIN' as 'SUPERADMIN' | 'PLATFORM_ADMIN'
  };

  ngOnInit() {
    this.loadOrganizations();
  }

  setTab(tab: 'orgs' | 'users' | 'admins') {
    this.activeTab = tab;
    console.log('🔄 [PlatformAdmin] Cambiando a pestaña:', tab);
    if (tab === 'orgs') this.loadOrganizations();
    if (tab === 'users') this.loadUsers();
    this.cdr.detectChanges();
  }

  loadOrganizations() {
    console.log('🔍 [PlatformAdmin] Iniciando carga de organizaciones...');
    this.loading = true;
    this.adminService.getOrganizations()
      .pipe(finalize(() => {
        this.loading = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: (data) => {
          console.log('✅ [PlatformAdmin] Organizaciones recibidas:', data.length);
          this.organizations = data;
        },
        error: (err) => {
          console.error('❌ [PlatformAdmin] Error cargando organizaciones:', err);
          Swal.fire(this.langService.translate('common.error'), this.langService.translate('platform_admin.messages.loadError'), 'error');
        }
      });
  }

  loadUsers() {
    console.log('🔍 [PlatformAdmin] Iniciando carga de usuarios...');
    this.loading = true;
    this.adminService.getUsers()
      .pipe(finalize(() => {
        this.loading = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: (data) => {
          console.log('✅ [PlatformAdmin] Usuarios recibidos:', data.length);
          this.users = data;
        },
        error: (err) => {
          console.error('❌ [PlatformAdmin] Error cargando usuarios:', err);
          Swal.fire(this.langService.translate('common.error'), this.langService.translate('platform_admin.messages.loadErrorUsers'), 'error');
        }
      });
  }

  updateStatus(org: any) {
    Swal.fire({
      title: this.langService.translate('platform_admin.messages.updateConfirm'),
      text: this.langService.translate('platform_admin.messages.updateConfirmText', { status: org.subscriptionStatus }),
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: this.langService.translate('common.confirm'),
      cancelButtonText: this.langService.translate('common.cancel')
    }).then((result) => {
      if (result.isConfirmed) {
        this.adminService.updateOrganizationStatus(org.id, org.subscriptionStatus, org.trialEndsAt).subscribe({
          next: () => {
            Swal.fire(this.langService.translate('common.success'), this.langService.translate('platform_admin.messages.updateSuccess'), 'success');
          },
          error: (err) => Swal.fire(this.langService.translate('common.error'), err.error?.message || 'Error', 'error')
        });
      }
    });
  }

  toggleUser(user: any) {
    const action = user.isActive ? 'bloquear' : 'activar';
    Swal.fire({
      title: `¿${action.charAt(0).toUpperCase() + action.slice(1)} usuario?`,
      text: `El usuario ${user.email} será ${user.isActive ? 'bloqueado' : 'activado'}.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: `Sí, ${action}`,
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.adminService.toggleUserStatus(user.id).subscribe({
          next: (res) => {
            user.isActive = res.user.isActive;
            Swal.fire('Éxito', `Usuario ${user.isActive ? 'activado' : 'bloqueado'}`, 'success');
          },
          error: (err) => Swal.fire('Error', err.error?.message || 'Error al procesar', 'error')
        });
      }
    });
  }

  onCreateAdmin() {
    if (!this.newAdmin.email || !this.newAdmin.firstName) return;

    Swal.fire({ title: 'Procesando...', didOpen: () => Swal.showLoading() });

    const request$ = this.newAdmin.role === 'SUPERADMIN'
      ? this.adminService.createSuperAdmin(this.newAdmin)
      : this.adminService.createPlatformAdmin(this.newAdmin);

    const successMsg = this.newAdmin.role === 'SUPERADMIN'
      ? this.langService.translate('platform_admin.messages.createSuccess')
      : 'Administrador de plataforma creado con éxito.';

    request$.subscribe({
      next: () => {
        Swal.fire(this.langService.translate('common.success'), successMsg, 'success');
        this.newAdmin = { firstName: '', lastName: '', email: '', password: '', role: 'PLATFORM_ADMIN' };
        this.setTab('users');
      },
      error: (err) => Swal.fire(this.langService.translate('common.error'), err.error?.message || 'Error', 'error')
    });
  }

  filteredOrgs() {
    if (!this.searchTerm) return this.organizations;
    const term = this.searchTerm.toLowerCase();
    return this.organizations.filter(o =>
      o.name.toLowerCase().includes(term) ||
      o.id.toLowerCase().includes(term) ||
      o.owner?.email.toLowerCase().includes(term)
    );
  }

  filteredUsers() {
    if (!this.searchTerm) return this.users;
    const term = this.searchTerm.toLowerCase();
    return this.users.filter(u =>
      u.email.toLowerCase().includes(term) ||
      u.firstName.toLowerCase().includes(term) ||
      u.lastName.toLowerCase().includes(term) ||
      u.id.toLowerCase().includes(term)
    );
  }
}
