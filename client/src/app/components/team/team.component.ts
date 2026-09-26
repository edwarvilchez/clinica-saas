import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TeamService, TeamMember } from '../../services/team.service';
import { AuthService } from '../../services/auth.service';
import { LanguageService } from '../../services/language.service';
import { TranslatePipe } from '../../services/translate.pipe';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-team',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  template: `
    <div class="container-fluid p-4 fade-in">
      <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <h2 class="fw-bold text-dark mb-1">{{ 'team.title' | translate }}</h2>
          <p class="text-muted small mb-0">{{ 'team.subtitle' | translate }}</p>
        </div>
        <button class="btn btn-primary-premium transition-all shadow-sm" (click)="toggleForm()">
          <i class="bi" [class.bi-plus-lg]="!showForm" [class.bi-x-lg]="showForm"></i>
          {{ showForm ? ('common.cancel' | translate) : ('team.addMember' | translate) }}
        </button>
      </div>

      <!-- Add Member Form -->
      <div *ngIf="showForm" class="card-premium border-0 shadow-sm mb-4 slide-in">
        <div class="card-body">
          <h5 class="card-title fw-bold mb-3 text-primary-premium">{{ 'team.newMember' | translate }}</h5>
          <form (ngSubmit)="onSubmit()" #memberForm="ngForm">
            <div class="row g-3">
              <div class="col-md-6">
                <label class="form-label small fw-bold text-muted">{{ 'doctors.fields.firstName' | translate }}</label>
                <input type="text" class="form-control glass-morphism border" [(ngModel)]="newMember.firstName" name="firstName" required>
              </div>
              <div class="col-md-6">
                <label class="form-label small fw-bold text-muted">{{ 'doctors.fields.lastName' | translate }}</label>
                <input type="text" class="form-control glass-morphism border" [(ngModel)]="newMember.lastName" name="lastName" required>
              </div>
              <div class="col-md-6">
                <label class="form-label small fw-bold text-muted">{{ 'auth.email' | translate }}</label>
                <input type="email" class="form-control glass-morphism border" [(ngModel)]="newMember.email" name="email" required>
              </div>
              <div class="col-md-6">
                <label class="form-label small fw-bold text-muted">{{ 'team.role' | translate }}</label>
                <select class="form-select glass-morphism border" [(ngModel)]="newMember.roleName" name="roleName" required>
                  <option value="" disabled>{{ 'team.selectRole' | translate }}</option>
                  <option value="DOCTOR">{{ 'roles.DOCTOR' | translate }}</option>
                  <option value="NURSE">{{ 'roles.NURSE' | translate }}</option>
                  <option value="ADMINISTRATIVE">{{ 'roles.ADMINISTRATIVE' | translate }}</option>
                </select>
              </div>
              
              <!-- Role Specific Fields -->
              <div class="col-md-6" *ngIf="newMember.roleName === 'DOCTOR' || newMember.roleName === 'NURSE'">
                <label class="form-label small fw-bold text-muted">{{ 'team.license' | translate }}</label>
                <input type="text" class="form-control glass-morphism border" [(ngModel)]="newMember.licenseNumber" name="licenseNumber">
              </div>

               <div class="col-md-6">
                <label class="form-label small fw-bold text-muted">{{ 'team.gender' | translate }}</label>
                <select class="form-select glass-morphism border" [(ngModel)]="newMember.gender" name="gender" required>
                   <option value="Male">{{ 'common.male' | translate }}</option>
                   <option value="Female">{{ 'common.female' | translate }}</option>
                </select>
              </div>

              <div class="col-12 mt-4 text-end">
                <button type="submit" class="btn btn-primary-premium px-4" [disabled]="!memberForm.form.valid">
                  <i class="bi bi-send me-1"></i> {{ 'team.invitationButton' | translate }}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      <!-- Search & View Mode Switcher -->
      <div class="card-premium border-0 p-3 mb-4">
        <div class="row g-3 align-items-center">
          <div class="col-md-6 col-lg-7">
            <div class="input-group glass-morphism rounded-3 border">
              <span class="input-group-text bg-transparent border-0"><i class="bi bi-search text-muted"></i></span>
              <input
                type="text"
                class="form-control bg-transparent border-0 py-2 shadow-none"
                [placeholder]="'common.search' | translate"
                [ngModel]="searchTerm()"
                (ngModelChange)="searchTerm.set($event)"
              />
            </div>
          </div>
          <div class="col-md-6 col-lg-5 d-flex align-items-center justify-content-md-end gap-3 flex-wrap">
            <div class="btn-group bg-light p-1 rounded-pill border shadow-sm" role="group">
              <button type="button" class="btn btn-sm rounded-pill px-3 fw-bold d-flex align-items-center gap-1"
                [ngClass]="viewMode() === 'list' ? 'btn-primary shadow-sm text-white' : 'btn-light text-muted border-0'"
                (click)="viewMode.set('list')">
                <i class="bi bi-list-ul"></i><span class="small">{{ langService.lang() === 'es' ? 'Lista' : 'List' }}</span>
              </button>
              <button type="button" class="btn btn-sm rounded-pill px-3 fw-bold d-flex align-items-center gap-1"
                [ngClass]="viewMode() === 'kanban' ? 'btn-primary shadow-sm text-white' : 'btn-light text-muted border-0'"
                (click)="viewMode.set('kanban')">
                <i class="bi bi-kanban-fill"></i><span class="small">Kanban</span>
              </button>
            </div>

            <div class="badge bg-light text-dark border p-2">
              Total: <strong>{{ filteredMembers().length }}</strong>
            </div>
          </div>
        </div>
      </div>

      <!-- LIST VIEW -->
      <div *ngIf="viewMode() === 'list'" class="card-premium border-0 shadow-sm overflow-hidden animate-fade-in">
        <div class="card-body p-0">
          <div class="table-responsive">
            <table class="table table-hover align-middle mb-0">
              <thead class="bg-light">
                <tr>
                  <th class="ps-4 py-3 text-muted x-small text-uppercase">{{ 'team.member' | translate }}</th>
                  <th class="py-3 text-muted x-small text-uppercase">{{ 'auth.email' | translate }}</th>
                  <th class="py-3 text-muted x-small text-uppercase">{{ 'team.role' | translate }}</th>
                  <th class="pe-4 py-3 text-end text-muted x-small text-uppercase">{{ 'common.actions' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let member of filteredMembers()">
                  <td class="ps-4">
                    <div class="d-flex align-items-center gap-3">
                      <div class="avatar-circle shadow-sm bg-primary bg-opacity-10 text-primary fw-bold transition-all">
                        {{ (member.firstName || 'U').charAt(0) }}{{ (member.lastName || '').charAt(0) }}
                      </div>
                      <div>
                        <div class="fw-bold text-dark">{{ member.firstName }} {{ member.lastName }}</div>
                        <div class="small text-muted" *ngIf="member.licenseNumber">{{ 'team.license' | translate }}: {{ member.licenseNumber }}</div>
                      </div>
                    </div>
                  </td>
                  <td>{{ member.email }}</td>
                  <td>
                    <span class="badge rounded-pill fw-normal px-3 py-2"
                      [ngClass]="getRoleBadgeClass(member.Role?.name)">
                      {{ getRoleLabel(member.Role?.name) }}
                    </span>
                  </td>
                  <td class="pe-4 text-end">
                    <button class="btn btn-sm btn-light border-0 text-danger rounded-circle hover-scale" (click)="removeMember(member.id)" 
                      [disabled]="member.id === authService.currentUser()?.id"
                      [title]="'common.delete' | translate">
                      <i class="bi bi-trash"></i>
                    </button>
                  </td>
                </tr>
                <tr *ngIf="filteredMembers().length === 0">
                  <td colspan="4" class="text-center py-5 text-muted">
                    <div class="py-4">
                      <i class="bi bi-people fs-1 d-block mb-3 opacity-25"></i>
                      <p class="mb-0">{{ 'team.noMembers' | translate }}</p>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- KANBAN VIEW (Odoo ERP Style by Role) -->
      <div *ngIf="viewMode() === 'kanban'" class="row g-3">
        <!-- Col 1: Médicos -->
        <div class="col-md-6 col-xl-3">
          <div class="card border-0 shadow-sm rounded-4 bg-light p-3 h-100 border-top border-4 border-info">
            <div class="d-flex justify-content-between align-items-center mb-3">
              <h6 class="fw-bold text-info mb-0 d-flex align-items-center gap-2">
                <i class="bi bi-heart-pulse-fill"></i> {{ langService.lang() === 'es' ? 'Médicos' : 'Doctors' }}
              </h6>
              <span class="badge bg-info text-white rounded-pill px-2">{{ doctorMembers().length }}</span>
            </div>
            <div class="d-flex flex-column gap-2" style="max-height: 600px; overflow-y: auto;">
              <div *ngFor="let m of doctorMembers()" class="card border-0 shadow-sm rounded-3 p-3 bg-white hover-card">
                <div class="d-flex align-items-center gap-2 mb-2">
                  <div class="avatar-circle shadow-sm bg-info bg-opacity-10 text-info fw-bold">
                    {{ (m.firstName || 'U').charAt(0) }}{{ (m.lastName || '').charAt(0) }}
                  </div>
                  <div>
                    <h6 class="fw-bold text-dark mb-0">{{ m.firstName }} {{ m.lastName }}</h6>
                    <span class="text-muted x-small">{{ m.email }}</span>
                  </div>
                </div>
                <div class="d-flex justify-content-between align-items-center pt-2 border-top">
                  <span class="badge bg-info bg-opacity-10 text-info">{{ m.licenseNumber || 'Médico' }}</span>
                  <button class="btn btn-xs btn-light rounded-circle text-danger" (click)="removeMember(m.id)" [disabled]="m.id === authService.currentUser()?.id">
                    <i class="bi bi-trash"></i>
                  </button>
                </div>
              </div>
              <div *ngIf="doctorMembers().length === 0" class="text-center py-4 text-muted small">
                Sin médicos registrados
              </div>
            </div>
          </div>
        </div>

        <!-- Col 2: Enfermería -->
        <div class="col-md-6 col-xl-3">
          <div class="card border-0 shadow-sm rounded-4 bg-light p-3 h-100 border-top border-4 border-success">
            <div class="d-flex justify-content-between align-items-center mb-3">
              <h6 class="fw-bold text-success mb-0 d-flex align-items-center gap-2">
                <i class="bi bi-bandaid-fill"></i> {{ langService.lang() === 'es' ? 'Enfermería' : 'Nursing' }}
              </h6>
              <span class="badge bg-success rounded-pill px-2">{{ nurseMembers().length }}</span>
            </div>
            <div class="d-flex flex-column gap-2" style="max-height: 600px; overflow-y: auto;">
              <div *ngFor="let m of nurseMembers()" class="card border-0 shadow-sm rounded-3 p-3 bg-white hover-card">
                <div class="d-flex align-items-center gap-2 mb-2">
                  <div class="avatar-circle shadow-sm bg-success bg-opacity-10 text-success fw-bold">
                    {{ (m.firstName || 'U').charAt(0) }}{{ (m.lastName || '').charAt(0) }}
                  </div>
                  <div>
                    <h6 class="fw-bold text-dark mb-0">{{ m.firstName }} {{ m.lastName }}</h6>
                    <span class="text-muted x-small">{{ m.email }}</span>
                  </div>
                </div>
                <div class="d-flex justify-content-between align-items-center pt-2 border-top">
                  <span class="badge bg-success bg-opacity-10 text-success">{{ m.licenseNumber || 'Enfermero/a' }}</span>
                  <button class="btn btn-xs btn-light rounded-circle text-danger" (click)="removeMember(m.id)" [disabled]="m.id === authService.currentUser()?.id">
                    <i class="bi bi-trash"></i>
                  </button>
                </div>
              </div>
              <div *ngIf="nurseMembers().length === 0" class="text-center py-4 text-muted small">
                Sin enfermeros/as registrados
              </div>
            </div>
          </div>
        </div>

        <!-- Col 3: Administración -->
        <div class="col-md-6 col-xl-3">
          <div class="card border-0 shadow-sm rounded-4 bg-light p-3 h-100 border-top border-4 border-warning">
            <div class="d-flex justify-content-between align-items-center mb-3">
              <h6 class="fw-bold text-warning mb-0 d-flex align-items-center gap-2">
                <i class="bi bi-shield-lock-fill"></i> {{ langService.lang() === 'es' ? 'Administración' : 'Admin & Staff' }}
              </h6>
              <span class="badge bg-warning text-dark rounded-pill px-2">{{ adminMembers().length }}</span>
            </div>
            <div class="d-flex flex-column gap-2" style="max-height: 600px; overflow-y: auto;">
              <div *ngFor="let m of adminMembers()" class="card border-0 shadow-sm rounded-3 p-3 bg-white hover-card">
                <div class="d-flex align-items-center gap-2 mb-2">
                  <div class="avatar-circle shadow-sm bg-warning bg-opacity-10 text-dark fw-bold">
                    {{ (m.firstName || 'U').charAt(0) }}{{ (m.lastName || '').charAt(0) }}
                  </div>
                  <div>
                    <h6 class="fw-bold text-dark mb-0">{{ m.firstName }} {{ m.lastName }}</h6>
                    <span class="text-muted x-small">{{ m.email }}</span>
                  </div>
                </div>
                <div class="d-flex justify-content-between align-items-center pt-2 border-top">
                  <span class="badge bg-warning bg-opacity-10 text-dark">{{ m.Role?.name }}</span>
                  <button class="btn btn-xs btn-light rounded-circle text-danger" (click)="removeMember(m.id)" [disabled]="m.id === authService.currentUser()?.id">
                    <i class="bi bi-trash"></i>
                  </button>
                </div>
              </div>
              <div *ngIf="adminMembers().length === 0" class="text-center py-4 text-muted small">
                Sin personal administrativo
              </div>
            </div>
          </div>
        </div>

        <!-- Col 4: Otros / Pacientes -->
        <div class="col-md-6 col-xl-3">
          <div class="card border-0 shadow-sm rounded-4 bg-light p-3 h-100 border-top border-4 border-secondary">
            <div class="d-flex justify-content-between align-items-center mb-3">
              <h6 class="fw-bold text-secondary mb-0 d-flex align-items-center gap-2">
                <i class="bi bi-people-fill"></i> {{ langService.lang() === 'es' ? 'Otros Miembros' : 'Other Roles' }}
              </h6>
              <span class="badge bg-secondary rounded-pill px-2">{{ otherMembers().length }}</span>
            </div>
            <div class="d-flex flex-column gap-2" style="max-height: 600px; overflow-y: auto;">
              <div *ngFor="let m of otherMembers()" class="card border-0 shadow-sm rounded-3 p-3 bg-white hover-card">
                <div class="d-flex align-items-center gap-2 mb-2">
                  <div class="avatar-circle shadow-sm bg-secondary bg-opacity-10 text-secondary fw-bold">
                    {{ (m.firstName || 'U').charAt(0) }}{{ (m.lastName || '').charAt(0) }}
                  </div>
                  <div>
                    <h6 class="fw-bold text-dark mb-0">{{ m.firstName }} {{ m.lastName }}</h6>
                    <span class="text-muted x-small">{{ m.email }}</span>
                  </div>
                </div>
                <div class="d-flex justify-content-between align-items-center pt-2 border-top">
                  <span class="badge bg-light text-muted border">{{ m.Role?.name || 'General' }}</span>
                  <button class="btn btn-xs btn-light rounded-circle text-danger" (click)="removeMember(m.id)" [disabled]="m.id === authService.currentUser()?.id">
                    <i class="bi bi-trash"></i>
                  </button>
                </div>
              </div>
              <div *ngIf="otherMembers().length === 0" class="text-center py-4 text-muted small">
                Sin otros miembros
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .avatar-circle {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.9rem;
    }
    .x-small { font-size: 0.75rem; letter-spacing: 0.5px; }
    .fade-in { animation: fadeIn 0.3s ease-in; }
    .slide-in { animation: slideIn 0.3s ease-out; }
    .hover-card {
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    .hover-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.08) !important;
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slideIn { from { transform: translateY(-10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  `]
})
export class TeamComponent implements OnInit {
  teamService = inject(TeamService);
  authService = inject(AuthService);
  langService = inject(LanguageService);
  showForm = false;
  viewMode = signal<'list' | 'kanban'>('list');
  searchTerm = signal('');

  filteredMembers = computed(() => {
    const term = this.searchTerm().toLowerCase();
    return this.teamService.members().filter(m => {
      const name = `${m.firstName || ''} ${m.lastName || ''}`.toLowerCase();
      const email = (m.email || '').toLowerCase();
      const role = (m.Role?.name || '').toLowerCase();
      return name.includes(term) || email.includes(term) || role.includes(term);
    });
  });

  doctorMembers = computed(() => this.filteredMembers().filter(m => m.Role?.name === 'DOCTOR'));
  nurseMembers = computed(() => this.filteredMembers().filter(m => m.Role?.name === 'NURSE'));
  adminMembers = computed(() => this.filteredMembers().filter(m => ['SUPERADMIN', 'ADMINISTRATIVE', 'STAFF'].includes(m.Role?.name || '')));
  otherMembers = computed(() => this.filteredMembers().filter(m => !['DOCTOR', 'NURSE', 'SUPERADMIN', 'ADMINISTRATIVE', 'STAFF'].includes(m.Role?.name || '')));

  newMember: any = {
    firstName: '',
    lastName: '',
    email: '',
    roleName: '',
    gender: 'Female',
    licenseNumber: ''
  };

  ngOnInit() {
    this.loadTeam();
  }

  loadTeam() {
    this.teamService.getTeam().subscribe({
      error: () => Swal.fire(this.langService.translate('common.error'), this.langService.lang() === 'es' ? 'No se pudo cargar el equipo' : 'Could not load team', 'error')
    });
  }

  toggleForm() {
    this.showForm = !this.showForm;
  }

  onSubmit() {
    Swal.fire({
      title: this.langService.translate('team.messages.loading'),
      didOpen: () => Swal.showLoading()
    });

    this.teamService.addMember(this.newMember).subscribe({
      next: () => {
        Swal.fire(this.langService.translate('common.success'), this.langService.translate('team.messages.success'), 'success');
        this.showForm = false;
        this.newMember = { firstName: '', lastName: '', email: '', roleName: '', gender: 'Female', licenseNumber: '' };
        this.loadTeam();
      },
      error: (err) => {
        Swal.fire(this.langService.translate('common.error'), err.error?.message || (this.langService.lang() === 'es' ? 'Error al añadir miembro' : 'Error adding member'), 'error');
      }
    });
  }

  removeMember(id: string) {
    Swal.fire({
      title: this.langService.translate('team.messages.confirmDelete'),
      text: this.langService.translate('team.messages.confirmDeleteText'),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: this.langService.translate('team.messages.yesDelete'),
      cancelButtonText: this.langService.translate('common.cancel')
    }).then((result) => {
      if (result.isConfirmed) {
        this.teamService.removeMember(id).subscribe({
          next: () => Swal.fire(this.langService.lang() === 'es' ? 'Eliminado' : 'Deleted', this.langService.lang() === 'es' ? 'El miembro ha sido eliminado.' : 'Member has been deleted.', 'success'),
          error: () => Swal.fire(this.langService.translate('common.error'), this.langService.lang() === 'es' ? 'No se pudo eliminar el miembro.' : 'Could not delete member.', 'error')
        });
      }
    });
  }

  getRoleBadgeClass(roleName: string | undefined): string {
    switch (roleName) {
      case 'DOCTOR': return 'bg-info-subtle text-info-emphasis';
      case 'NURSE': return 'bg-success-subtle text-success-emphasis';
      case 'ADMINISTRATIVE': return 'bg-warning-subtle text-warning-emphasis';
      default: return 'bg-secondary-subtle text-secondary';
    }
  }

  getRoleLabel(roleName: string | undefined): string {
    switch (roleName) {
      case 'DOCTOR': return this.langService.translate('roles.DOCTOR');
      case 'NURSE': return this.langService.translate('roles.NURSE');
      case 'ADMINISTRATIVE': return this.langService.translate('roles.STAFF');
      default: return roleName || (this.langService.lang() === 'es' ? 'Desconocido' : 'Unknown');
    }
  }
}
