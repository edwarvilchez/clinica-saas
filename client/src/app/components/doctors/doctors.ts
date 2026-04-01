import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { LanguageService } from '../../services/language.service';
import { AuthService } from '../../services/auth.service';
import { API_URL } from '../../api-config';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-doctors',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, TranslatePipe],
  template: `
    <div class="h-100 animate-fade-in">
      <div class="d-flex justify-content-between align-items-center compact-header">
        <div>
          <h4 class="mb-1">{{ 'doctors.title' | translate }}</h4>
          <p class="text-muted small mb-0">{{ 'doctors.subtitle' | translate }}</p>
        </div>
        <button class="btn btn-primary-premium btn-sm" (click)="createNewDoctor()">
          <i class="bi bi-person-plus-fill me-2"></i> {{ 'doctors.new' | translate }}
        </button>
      </div>

      <div class="card-premium border-0 compact-card mb-3">
        <div class="row g-2 align-items-center">
          <div class="col-md-9">
            <div class="input-group glass-morphism rounded-3 border">
              <span class="input-group-text bg-transparent border-0 py-1">
                <i class="bi bi-search text-muted"></i>
              </span>
              <input 
                type="text" 
                class="form-control bg-transparent border-0 py-1 shadow-none" 
                [placeholder]="'doctors.searchPlaceholder' | translate" 
                [(ngModel)]="searchTerm" 
                [ngModelOptions]="{standalone: true}">
            </div>
          </div>
          <div class="col-md-3">
            <select 
              class="form-select glass-morphism border rounded-3 py-1"
              [(ngModel)]="specialtyFilter"
              [ngModelOptions]="{standalone: true}">
              <option value="all">{{ 'doctors.allSpecialties' | translate }}</option>
              <option *ngFor="let specialty of specialties()" [value]="specialty.id">
                {{ specialty.name }}
              </option>
            </select>
          </div>
        </div>
      </div>

      <div class="row g-3" style="max-height: calc(100vh - 280px); overflow-y: auto;">
        <div class="col-md-4" *ngFor="let doctor of filteredDoctors()">
          <div class="card-premium border-0 p-3 h-100 text-center animate-fade-in">
            <div class="position-absolute top-0 end-0 p-2">
              <button 
                class="btn btn-sm btn-light border-0 text-danger rounded-circle" 
                (click)="deleteDoctor(doctor.id)">
                <i class="bi bi-trash"></i>
              </button>
            </div>
            <img 
              [src]="'https://ui-avatars.com/api/?name=' + doctor.User.firstName + '+' + doctor.User.lastName + '&background=0ea5e9&color=fff'" 
              class="rounded-circle shadow-sm mb-2" 
              width="80">
            <h6 class="fw-bold mb-1">Dr. {{ doctor.User.firstName }} {{ doctor.User.lastName }}</h6>
            <p class="text-primary small fw-bold mb-2">{{ doctor.Specialty?.name || ('doctors.specialist' | translate) }}</p>
            
            <div class="d-flex justify-content-center gap-2 mb-2">
              <span 
                class="badge rounded-pill px-2 py-1 cursor-pointer" 
                [ngClass]="doctor.User.isActive ? 'bg-success bg-opacity-10 text-success' : 'bg-danger bg-opacity-10 text-danger'"
                style="font-size: 0.75rem;"
                (click)="toggleStatus(doctor)">
                {{ doctor.User.isActive ? ('common.active' | translate) : ('common.inactive' | translate) }}
              </span>
              <span 
                *ngIf="isAdmin()"
                class="badge rounded-pill px-2 py-1 cursor-pointer" 
                [ngClass]="doctor.User.subscriptionBypass ? 'bg-warning bg-opacity-20 text-warning' : 'bg-light text-muted'"
                style="font-size: 0.75rem;"
                (click)="toggleBypass(doctor)"
                [title]="'doctors.messages.toggleBypassTooltip' | translate">
                <i class="bi" [ngClass]="doctor.User.subscriptionBypass ? 'bi-star-fill' : 'bi-star'"></i>
              </span>
              <span class="badge bg-light text-muted rounded-pill px-2 py-1" style="font-size: 0.75rem;">{{ 'doctors.fields.license' | translate }}: {{ doctor.licenseNumber }}</span>
            </div>

            <div class="d-grid gap-1">
              <button class="btn btn-light rounded-pill py-1 border-0 btn-sm" (click)="viewProfile(doctor)">{{ 'doctors.viewProfile' | translate }}</button>
              <button 
                class="btn rounded-pill py-1 btn-sm" 
                [ngClass]="doctor.User.isActive ? 'btn-primary-premium' : 'btn-secondary opacity-50'"
                [disabled]="!doctor.User.isActive"
                (click)="scheduleAppointment(doctor)">
                {{ 'doctors.schedule' | translate }}
              </button>
            </div>
          </div>
        </div>
        
        <div class="col-12 text-center py-4" *ngIf="filteredDoctors().length === 0">
          <p class="text-muted">{{ 'doctors.noResults' | translate }}</p>
        </div>
      </div>
    </div>
  `,
  styleUrl: './doctors.css',
})
// Component for managing doctors
export class Doctors implements OnInit {
  doctors = signal<any[]>([]);
  specialties = signal<any[]>([]);
  searchTerm = signal('');
  specialtyFilter = signal('all');

  filteredDoctors = computed(() => {
    const term = this.searchTerm().toLowerCase();
    const specialty = this.specialtyFilter();
    
    return this.doctors().filter(d => {
      const matchesSearch = 
        d.User.firstName.toLowerCase().includes(term) || 
        d.User.lastName.toLowerCase().includes(term) ||
        d.Specialty?.name.toLowerCase().includes(term);
      
      const matchesSpecialty = specialty === 'all' || d.specialtyId === parseInt(specialty);
      
      return matchesSearch && matchesSpecialty;
    });
  });


  constructor(
    private http: HttpClient,
    public langService: LanguageService,
    private router: Router,
    private authService: AuthService
  ) {}

  isAdmin() {
    const user = this.authService.currentUser();
    const authorizedEmails = ['cgk888digital@gmail.com', 'admin@clinicasaas.com'];
    return this.authService.hasRole(['SUPERADMIN']) && authorizedEmails.includes(user?.email);
  }

  ngOnInit() {
    this.loadDoctors();
    this.loadSpecialties();
  }

  getHeaders() {
    return new HttpHeaders({ 'Authorization': `Bearer ${localStorage.getItem('token')}` });
  }

  loadDoctors() {
    this.http.get<any>(`${API_URL}/doctors`, { headers: this.getHeaders() })
      .subscribe(data => {
        const list = Array.isArray(data) ? data : (data.doctors || []);
        this.doctors.set(list);
      });
  }

  loadSpecialties() {
    this.http.get<any[]>(`${API_URL}/specialties`, { headers: this.getHeaders() })
      .subscribe(data => this.specialties.set(data));
  }

  viewProfile(doctor: any) {
    const t = (k: string) => this.langService.translate(k);
    const specialtyName = doctor.Specialty?.name || t('doctors.specialist');
    const statusBadge = `<span class="badge bg-success bg-opacity-10 text-success rounded-pill px-2 py-1">${t('doctors.available')}</span>`;
    
    Swal.fire({
      title: `<span class="fs-4 fw-bold">Dr. ${doctor.User.firstName} ${doctor.User.lastName}</span>`,
      html: `
        <div class="text-center mb-4">
          <img src="https://ui-avatars.com/api/?name=${doctor.User.firstName}+${doctor.User.lastName}&background=0ea5e9&color=fff" 
               class="rounded-circle shadow-sm mb-3" width="100">
          <p class="text-primary fw-bold mb-1">${specialtyName}</p>
          <div class="mb-3">${statusBadge}</div>
          
          <div class="text-start bg-light p-3 rounded-3 small">
            <div class="d-flex justify-content-between mb-2 border-bottom pb-2">
              <span class="text-muted"><i class="bi bi-envelope me-2"></i>${t('doctors.fields.email')}</span>
              <span class="fw-bold text-dark">${doctor.email || doctor.User.email}</span>
            </div>
            <div class="d-flex justify-content-between mb-2 border-bottom pb-2">
              <span class="text-muted"><i class="bi bi-telephone me-2"></i>${t('doctors.fields.phone')}</span>
              <span class="fw-bold text-dark">${doctor.phone || 'No registrado'}</span>
            </div>
            <div class="d-flex justify-content-between mb-0">
              <span class="text-muted"><i class="bi bi-card-heading me-2"></i>${t('doctors.fields.license')}</span>
              <span class="fw-bold text-dark">${doctor.licenseNumber}</span>
            </div>
          </div>
        </div>
      `,
      showCloseButton: true,
      showConfirmButton: true,
      confirmButtonText: t('doctors.schedule'),
      confirmButtonColor: '#10b981',
      customClass: {
        popup: 'rounded-4 border-0 shadow-lg'
      }
    }).then((result) => {
      if (result.isConfirmed) {
        this.scheduleAppointment(doctor);
      }
    });
  }

  scheduleAppointment(doctor: any) {
    this.router.navigate(['/appointments'], { queryParams: { doctorId: doctor.id } });
  }

  createNewDoctor() {
    confirmButtonColor: '#10b981'
    if (this.specialties().length === 0) {
      Swal.fire({
        title: this.langService.translate('common.loading'),
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });
      
      this.loadSpecialties();
      
      setTimeout(() => {
        Swal.close();
        this.showDoctorModal();
      }, 1000);
    } else {
      this.showDoctorModal();
    }
  }

  showDoctorModal() {
    const t = (k: string) => this.langService.translate(k);
    const specialtiesOptions = this.specialties().length > 0 
      ? this.specialties().map(s => `<option value="${s.id}">${s.name}</option>`).join('')
      : `<option value="">${this.langService.lang() === 'es' ? 'No hay especialidades' : 'No specialties'}</option>`;

    Swal.fire({
      title: t('doctors.new'),
      html: `
        <div class="text-start">
          <div class="row g-2">
            <div class="col-md-6">
              <label class="form-label small fw-bold mb-1">${t('doctors.fields.firstName')}</label>
              <input id="firstName" class="form-control form-control-sm" placeholder="Juan">
            </div>
            <div class="col-md-6">
              <label class="form-label small fw-bold mb-1">${t('doctors.fields.lastName')}</label>
              <input id="lastName" class="form-control form-control-sm" placeholder="Pérez">
            </div>
            <div class="col-md-6">
              <label class="form-label small fw-bold mb-1">${t('doctors.fields.email')}</label>
              <input id="email" type="email" class="form-control form-control-sm" placeholder="doctor@clinicasaas.com">
            </div>
            <div class="col-md-6">
              <label class="form-label small fw-bold mb-1">${t('doctors.fields.phone')}</label>
              <input id="phone" class="form-control form-control-sm" placeholder="+58412-1234567">
            </div>
            <div class="col-md-6">
              <label class="form-label small fw-bold mb-1">${t('doctors.fields.license')}</label>
              <input id="licenseNumber" class="form-control form-control-sm" placeholder="12345">
            </div>
            <div class="col-md-6">
              <label class="form-label small fw-bold mb-1">${t('doctors.fields.specialty')}</label>
              <select id="specialtyId" class="form-select form-select-sm">
                <option value="">${this.langService.lang() === 'es' ? 'Seleccionar...' : 'Select...'}</option>
                ${specialtiesOptions}
              </select>
            </div>
            <div class="col-12">
              <label class="form-label small fw-bold mb-1">${t('doctors.fields.password')}</label>
              <input id="password" type="password" class="form-control form-control-sm" placeholder="${t('doctors.fields.passwordPlaceholder')}">
            </div>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: t('doctors.new'),
      cancelButtonText: t('common.cancel'),
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#64748b',
      width: '600px',
      customClass: {
        popup: 'swal-no-overflow'
      },
      preConfirm: () => {
        const firstName = (document.getElementById('firstName') as HTMLInputElement).value;
        const lastName = (document.getElementById('lastName') as HTMLInputElement).value;
        const email = (document.getElementById('email') as HTMLInputElement).value;
        const phone = (document.getElementById('phone') as HTMLInputElement).value;
        const licenseNumber = (document.getElementById('licenseNumber') as HTMLInputElement).value;
        const specialtyId = (document.getElementById('specialtyId') as HTMLSelectElement).value;
        const password = (document.getElementById('password') as HTMLInputElement).value;

        if (!firstName || !lastName || !email || !phone || !licenseNumber || !specialtyId || !password) {
          Swal.showValidationMessage(t('doctors.messages.completeRequired'));
          return false;
        }
        return { firstName, lastName, email, phone, licenseNumber, specialtyId, password };
      }
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        const doctorData = {
          username: result.value.email.split('@')[0],
          email: result.value.email,
          password: result.value.password,
          firstName: result.value.firstName,
          lastName: result.value.lastName,
          phone: result.value.phone,
          licenseNumber: result.value.licenseNumber,
          specialtyId: parseInt(result.value.specialtyId)
        };

        this.http.post(`${API_URL}/doctors`, doctorData, { headers: this.getHeaders() })
          .subscribe({
            next: () => {
              this.loadDoctors();
              Swal.fire({
                title: t('doctors.messages.created'),
                text: t('doctors.messages.createdMsg'),
                icon: 'success',
                confirmButtonColor: '#10b981'
              });
            },
            error: (err) => {
              Swal.fire({
                title: t('common.error'),
                text: err.error?.message || (this.langService.lang() === 'es' ? 'No se pudo crear el doctor.' : 'Could not create doctor.'),
                icon: 'error',
                confirmButtonColor: '#ef4444'
              });
            }
          });
      }
    });
  }

  deleteDoctor(id: string) {
    const t = (k: string) => this.langService.translate(k);
    Swal.fire({
      title: t('doctors.messages.confirmDelete'),
      text: t('doctors.messages.confirmDeleteMsg'),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: t('doctors.messages.deleteConfirmBtn'),
      cancelButtonText: t('common.cancel')
    }).then((result) => {
      if (result.isConfirmed) {
        this.http.delete(`${API_URL}/doctors/${id}`, { headers: this.getHeaders() })
          .subscribe({
            next: () => {
              this.loadDoctors();
              Swal.fire(t('doctors.messages.deleted'), t('doctors.messages.deletedMsg'), 'success');
            },
            error: () => Swal.fire(t('common.error'), t('common.error'), 'error')
          });
      }
    });
  }
  
  toggleStatus(doctor: any) {
    const t = (k: string) => this.langService.translate(k);
    const actionKey = doctor.User.isActive ? 'common.deactivate' : 'common.activate';
    const action = t(actionKey);
    const status = doctor.User.isActive ? t('doctors.inactive') : t('doctors.active');
    
    Swal.fire({
      title: t('doctors.messages.toggleStatus').replace('{action}', action),
      text: t('doctors.messages.toggleStatusMsg').replace('{name}', `${doctor.User.firstName} ${doctor.User.lastName}`).replace('{status}', status.toLowerCase()),
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: doctor.User.isActive ? '#ef4444' : '#28a745',
      cancelButtonColor: '#64748b',
      confirmButtonText: `Sí, ${action}`,
      cancelButtonText: t('common.cancel')
    }).then((result) => {
      if (result.isConfirmed) {
        this.http.patch(`${API_URL}/doctors/${doctor.id}/toggle-status`, {}, { headers: this.getHeaders() })
          .subscribe({
            next: (response: any) => {
              this.loadDoctors();
              Swal.fire({
                title: t('common.success'),
                text: response.message,
                icon: 'success',
                timer: 2000,
                showConfirmButton: false
              });
            },
            error: (err) => {
              Swal.fire(t('common.error'), err.error?.message || t('common.error'), 'error');
            }
          });
      }
    });
  }
  
  toggleBypass(doctor: any) {
    const t = (k: string) => this.langService.translate(k);
    const actionKey = doctor.User.subscriptionBypass ? 'common.deactivate' : 'common.activate';
    const action = t(actionKey);
    const action2 = doctor.User.subscriptionBypass 
      ? (this.langService.lang() === 'es' ? 'dejará de saltar' : 'will no longer bypass')
      : (this.langService.lang() === 'es' ? 'saltará' : 'will bypass');

    Swal.fire({
      title: t('doctors.messages.toggleBypass').replace('{action}', action),
      text: t('doctors.messages.toggleBypassMsg').replace('{name}', `${doctor.User.firstName} ${doctor.User.lastName}`).replace('{action2}', action2),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#f59e0b',
      cancelButtonColor: '#64748b',
      confirmButtonText: `Sí, ${action}`,
      cancelButtonText: t('common.cancel')
    }).then((result) => {
      if (result.isConfirmed) {
        this.http.patch(`${API_URL}/doctors/${doctor.id}/toggle-bypass`, {}, { headers: this.getHeaders() })
          .subscribe({
            next: (response: any) => {
              this.loadDoctors();
              Swal.fire({
                title: 'VIP',
                text: response.message,
                icon: 'success',
                timer: 2000,
                showConfirmButton: false
              });
            },
            error: (err) => {
              Swal.fire(t('common.error'), err.error?.message || t('common.error'), 'error');
            }
          });
      }
    });
  }

}
