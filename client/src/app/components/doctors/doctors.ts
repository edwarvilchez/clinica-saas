import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { LanguageService } from '../../services/language.service';
import { API_URL } from '../../api-config';

@Component({
  selector: 'app-doctors',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="h-100">
      <div class="d-flex justify-content-between align-items-center compact-header">
        <div>
          <h4 class="mb-1">{{ langService.translate('doctors.title') }}</h4>
          <p class="text-muted small mb-0">{{ langService.translate('doctors.subtitle') }}</p>
        </div>
        <button class="btn btn-primary-premium btn-sm" (click)="createNewDoctor()">
          <i class="bi bi-person-plus-fill me-2"></i> {{ langService.translate('doctors.new') }}
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
                [placeholder]="langService.translate('doctors.searchPlaceholder')" 
                [(ngModel)]="searchTerm" 
                [ngModelOptions]="{standalone: true}">
            </div>
          </div>
          <div class="col-md-3">
            <select 
              class="form-select glass-morphism border rounded-3 py-1"
              [(ngModel)]="specialtyFilter"
              [ngModelOptions]="{standalone: true}">
              <option value="all">{{ langService.translate('doctors.allSpecialties') }}</option>
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
            <p class="text-primary small fw-bold mb-2">{{ doctor.Specialty?.name || 'Especialista' }}</p>
            
            <div class="d-flex justify-content-center gap-2 mb-2">
              <span 
                class="badge rounded-pill px-2 py-1 cursor-pointer" 
                [ngClass]="doctor.User.isActive ? 'bg-success bg-opacity-10 text-success' : 'bg-danger bg-opacity-10 text-danger'"
                style="font-size: 0.75rem;"
                (click)="toggleStatus(doctor)">
                {{ doctor.User.isActive ? 'Activo' : 'Inactivo' }}
              </span>
              <span class="badge bg-light text-muted rounded-pill px-2 py-1" style="font-size: 0.75rem;">Lic: {{ doctor.licenseNumber }}</span>
            </div>

            <div class="d-grid gap-1">
              <button class="btn btn-light rounded-pill py-1 border-0 btn-sm" (click)="viewProfile(doctor)">{{ langService.translate('doctors.viewProfile') }}</button>
              <button 
                class="btn rounded-pill py-1 btn-sm" 
                [ngClass]="doctor.User.isActive ? 'btn-primary-premium' : 'btn-secondary opacity-50'"
                [disabled]="!doctor.User.isActive"
                (click)="scheduleAppointment(doctor)">
                {{ langService.translate('doctors.schedule') }}
              </button>
            </div>
          </div>
        </div>
        
        <div class="col-12 text-center py-4" *ngIf="filteredDoctors().length === 0">
          <p class="text-muted">{{ langService.translate('doctors.noResults') }}</p>
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
    private router: Router
  ) {}

  ngOnInit() {
    this.loadDoctors();
    this.loadSpecialties();
  }

  getHeaders() {
    return new HttpHeaders({ 'Authorization': `Bearer ${localStorage.getItem('token')}` });
  }

  loadDoctors() {
    this.http.get<any[]>(`${API_URL}/doctors`, { headers: this.getHeaders() })
      .subscribe(data => this.doctors.set(data));
  }

  loadSpecialties() {
    this.http.get<any[]>(`${API_URL}/specialties`, { headers: this.getHeaders() })
      .subscribe(data => this.specialties.set(data));
  }

  viewProfile(doctor: any) {
    const specialtyName = doctor.Specialty?.name || 'Especialista';
    const statusBadge = `<span class="badge bg-success bg-opacity-10 text-success rounded-pill px-2 py-1">Disponible</span>`;
    
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
              <span class="text-muted"><i class="bi bi-envelope me-2"></i>Email</span>
              <span class="fw-bold text-dark">${doctor.email || doctor.User.email}</span>
            </div>
            <div class="d-flex justify-content-between mb-2 border-bottom pb-2">
              <span class="text-muted"><i class="bi bi-telephone me-2"></i>Teléfono</span>
              <span class="fw-bold text-dark">${doctor.phone || 'No registrado'}</span>
            </div>
            <div class="d-flex justify-content-between mb-0">
              <span class="text-muted"><i class="bi bi-card-heading me-2"></i>Licencia</span>
              <span class="fw-bold text-dark">${doctor.licenseNumber}</span>
            </div>
          </div>
        </div>
      `,
      showCloseButton: true,
      showConfirmButton: true,
      confirmButtonText: 'Agendar Cita',
      confirmButtonColor: '#0ea5e9',
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
    // Ensure specialties are loaded
    if (this.specialties().length === 0) {
      Swal.fire({
        title: 'Cargando...',
        text: 'Obteniendo especialidades médicas',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });
      
      this.loadSpecialties();
      
      // Wait for specialties to load
      setTimeout(() => {
        Swal.close();
        this.showDoctorModal();
      }, 1000);
    } else {
      this.showDoctorModal();
    }
  }

  showDoctorModal() {
    const specialtiesOptions = this.specialties().length > 0 
      ? this.specialties().map(s => `<option value="${s.id}">${s.name}</option>`).join('')
      : '<option value="">No hay especialidades disponibles</option>';

    Swal.fire({
      title: 'Nuevo Doctor',
      html: `
        <div class="text-start">
          <div class="row g-2">
            <div class="col-md-6">
              <label class="form-label small fw-bold mb-1">Nombre</label>
              <input id="firstName" class="form-control form-control-sm" placeholder="Juan">
            </div>
            <div class="col-md-6">
              <label class="form-label small fw-bold mb-1">Apellido</label>
              <input id="lastName" class="form-control form-control-sm" placeholder="Pérez">
            </div>
            <div class="col-md-6">
              <label class="form-label small fw-bold mb-1">Email</label>
              <input id="email" type="email" class="form-control form-control-sm" placeholder="doctor@medicus.com">
            </div>
            <div class="col-md-6">
              <label class="form-label small fw-bold mb-1">Teléfono</label>
              <input id="phone" class="form-control form-control-sm" placeholder="+58412-1234567">
            </div>
            <div class="col-md-6">
              <label class="form-label small fw-bold mb-1">Licencia Médica</label>
              <input id="licenseNumber" class="form-control form-control-sm" placeholder="12345">
            </div>
            <div class="col-md-6">
              <label class="form-label small fw-bold mb-1">Especialidad</label>
              <select id="specialtyId" class="form-select form-select-sm">
                <option value="">Seleccionar...</option>
                ${specialtiesOptions}
              </select>
            </div>
            <div class="col-12">
              <label class="form-label small fw-bold mb-1">Contraseña</label>
              <input id="password" type="password" class="form-control form-control-sm" placeholder="Mínimo 6 caracteres">
            </div>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Crear Doctor',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#0ea5e9',
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
          Swal.showValidationMessage('Por favor completa todos los campos');
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
                title: '¡Doctor Creado!',
                text: 'El doctor ha sido registrado exitosamente en el sistema.',
                icon: 'success',
                confirmButtonColor: '#0ea5e9'
              });
            },
            error: (err) => {
              Swal.fire({
                title: 'Error',
                text: err.error?.message || 'No se pudo crear el doctor. Verifica los datos.',
                icon: 'error',
                confirmButtonColor: '#ef4444'
              });
            }
          });
      }
    });
  }

  deleteDoctor(id: string) {
    Swal.fire({
      title: '¿Eliminar Doctor?',
      text: "El doctor dejará de tener acceso al sistema.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.http.delete(`${API_URL}/doctors/${id}`, { headers: this.getHeaders() })
          .subscribe({
            next: () => {
              this.loadDoctors();
              Swal.fire('Eliminado', 'El doctor ha sido retirado del sistema.', 'success');
            },
            error: () => Swal.fire('Error', 'No se pudo completar la acción', 'error')
          });
      }
    });
  }
  toggleStatus(doctor: any) {
    const action = doctor.User.isActive ? 'desactivar' : 'activar';
    
    Swal.fire({
      title: `¿${action.charAt(0).toUpperCase() + action.slice(1)} Doctor?`,
      text: `El doctor ${doctor.User.firstName} ${doctor.User.lastName} quedará ${doctor.User.isActive ? 'inactivo' : 'activo'} en el sistema.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: doctor.User.isActive ? '#ef4444' : '#28a745',
      cancelButtonColor: '#64748b',
      confirmButtonText: `Sí, ${action}`,
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.http.patch(`${API_URL}/doctors/${doctor.id}/toggle-status`, {}, { headers: this.getHeaders() })
          .subscribe({
            next: (response: any) => {
              this.loadDoctors();
              Swal.fire({
                title: 'Éxito',
                text: response.message,
                icon: 'success',
                timer: 2000,
                showConfirmButton: false
              });
            },
            error: (err) => {
              Swal.fire('Error', err.error?.message || 'No se pudo cambiar el estado', 'error');
            }
          });
      }
    });
  }
}
