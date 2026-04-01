import { Component, OnInit, inject } from '@angular/core';
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
      <div class="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 class="fw-bold text-dark mb-1">{{ 'team.title' | translate }}</h2>
          <p class="text-muted">{{ 'team.subtitle' | translate }}</p>
        </div>
        <button class="btn btn-primary-premium transition-all" (click)="toggleForm()">
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
                <label class="form-label small fw-bold text-muted">{{ 'medical_history.name' | translate }}</label>
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
                  <option value="ADMINISTRATIVE">{{ 'roles.STAFF' | translate }}</option>
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

      <!-- Team List -->
      <div class="card-premium border-0 shadow-sm overflow-hidden animate-fade-in">
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
                <tr *ngFor="let member of teamService.members()">
                  <td class="ps-4">
                    <div class="d-flex align-items-center gap-3">
                      <div class="avatar-circle shadow-sm bg-primary bg-opacity-10 text-primary fw-bold transition-all">
                        {{ member.firstName.charAt(0) }}{{ member.lastName.charAt(0) }}
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
                <tr *ngIf="teamService.members().length === 0">
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
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slideIn { from { transform: translateY(-10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  `]
})
export class TeamComponent implements OnInit {
  teamService = inject(TeamService);
  authService = inject(AuthService);
  langService = inject(LanguageService);
  showForm = false;

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
    // Generate a temporary password if backend expects it, or backend generates it.
    // My backend code: password: password || 'ClinicaSaaS123'
    // So distinct input is not needed per user request "invitation".

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
