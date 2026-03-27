import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { LanguageService } from '../../services/language.service';
import { ExportService } from '../../services/export.service';
import { AuthService } from '../../services/auth.service';
import { API_URL } from '../../api-config';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-patients',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, TranslatePipe],
  templateUrl: './patients.html',
  styleUrl: './patients.css',
})
export class Patients implements OnInit {
  patients = signal<any[]>([]);
  searchTerm = signal('');
  genderFilter = signal('all');
  showAdvancedFilters = signal(false);
  
  filteredPatients = computed(() => {
    const term = this.searchTerm().toLowerCase();
    const gender = this.genderFilter();
    
    return this.patients().filter(p => {
      const matchesSearch = 
        p.User.firstName.toLowerCase().includes(term) || 
        p.User.lastName.toLowerCase().includes(term) ||
        p.documentId.toLowerCase().includes(term);
      
      const matchesGender = gender === 'all' || p.gender === gender;
      
      return matchesSearch && matchesGender;
    });
  });

  constructor(
    private http: HttpClient,
    private router: Router,
    public langService: LanguageService,
    private exportService: ExportService,
    public authService: AuthService
  ) {}

  ngOnInit() {
    this.loadPatients();
  }

  getHeaders() {
    return new HttpHeaders({ 'Authorization': `Bearer ${localStorage.getItem('token')}` });
  }

  loadPatients() {
    this.http.get<any>(`${API_URL}/patients`, { headers: this.getHeaders() })
      .subscribe(data => {
        const list = Array.isArray(data) ? data : (data.patients || []);
        this.patients.set(list);
      });
  }

  viewHistory(id: string) {
    this.router.navigate(['/history'], { queryParams: { id } });
  }

  toggleAdvancedFilters() {
    this.showAdvancedFilters.set(!this.showAdvancedFilters());
  }

  clearFilters() {
    this.searchTerm.set('');
    this.genderFilter.set('all');
    Swal.fire({
      title: 'Filtros Limpiados',
      text: 'Se han restablecido todos los filtros',
      icon: 'success',
      timer: 1500,
      showConfirmButton: false
    });
  }

  deletePatient(id: string) {
    Swal.fire({
      title: '¿Estás seguro?',
      text: "Esta acción eliminará al paciente y todos sus registros asociados.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.http.delete(`${API_URL}/patients/${id}`, { headers: this.getHeaders() })
          .subscribe({
            next: () => {
              this.loadPatients();
              Swal.fire({
                title: 'Eliminado',
                text: 'El paciente ha sido borrado del sistema.',
                icon: 'success',
                confirmButtonColor: '#10b981'
              });
            },
            error: () => {
              Swal.fire('Error', 'No se pudo eliminar al paciente', 'error');
            }
          });
      }
    });
  }

  createNewPatient() {
    Swal.fire({
      title: 'Nuevo Paciente',
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
              <label class="form-label small fw-bold mb-1">Documento ID</label>
              <input id="documentId" class="form-control form-control-sm" placeholder="V-12345678">
            </div>
            <div class="col-md-6">
              <label class="form-label small fw-bold mb-1">Teléfono</label>
              <input id="phone" class="form-control form-control-sm" placeholder="+58412-1234567">
            </div>
            <div class="col-md-6">
              <label class="form-label small fw-bold mb-1">Email</label>
              <input id="email" type="email" class="form-control form-control-sm" placeholder="juan@email.com">
            </div>
            <div class="col-md-6">
              <label class="form-label small fw-bold mb-1">Género</label>
              <select id="gender" class="form-select form-select-sm">
                <option value="Male">Masculino</option>
                <option value="Female">Femenino</option>
                <option value="Other">Otro</option>
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
      confirmButtonText: 'Crear Paciente',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#64748b',
      width: '600px',
      customClass: {
        popup: 'swal-no-overflow'
      },
      preConfirm: () => {
        const firstName = (document.getElementById('firstName') as HTMLInputElement).value;
        const lastName = (document.getElementById('lastName') as HTMLInputElement).value;
        const documentId = (document.getElementById('documentId') as HTMLInputElement).value;
        const email = (document.getElementById('email') as HTMLInputElement).value;
        const phone = (document.getElementById('phone') as HTMLInputElement).value;
        const gender = (document.getElementById('gender') as HTMLSelectElement).value;
        const password = (document.getElementById('password') as HTMLInputElement).value;

        if (!firstName || !lastName || !documentId || !email || !phone || !password) {
          Swal.showValidationMessage('Por favor completa todos los campos obligatorios');
          return false;
        }

        return { firstName, lastName, documentId, email, phone, gender, password };
      }
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        const patientData = {
          username: result.value.email.split('@')[0],
          email: result.value.email,
          password: result.value.password,
          firstName: result.value.firstName,
          lastName: result.value.lastName,
          documentId: result.value.documentId,
          phone: result.value.phone,
          gender: result.value.gender
        };

        this.http.post(`${API_URL}/patients`, patientData, { headers: this.getHeaders() })
          .subscribe({
            next: () => {
              this.loadPatients();
              Swal.fire({
                title: '¡Paciente Creado!',
                text: 'El paciente ha sido registrado exitosamente en el sistema.',
                icon: 'success',
                confirmButtonColor: '#10b981'
              });
            },
            error: (err) => {
              Swal.fire({
                title: 'Error',
                text: err.error?.message || 'No se pudo crear el paciente. Verifica los datos.',
                icon: 'error',
                confirmButtonColor: '#ef4444'
              });
            }
          });
      }
    });
  }

  exportReport() {
    if (this.filteredPatients().length === 0) {
      Swal.fire('Atención', 'No hay datos para exportar', 'warning');
      return;
    }

    const headers = ['Paciente', 'Email', 'Documento ID', 'Género', 'Teléfono'];
    const rows = this.filteredPatients().map(p => [
      `${p.User.firstName} ${p.User.lastName}`,
      p.User.email,
      p.documentId,
      p.gender,
      p.phone
    ]);

    Swal.fire({
      title: 'Exportar Listado de Pacientes',
      text: 'Seleccione el formato de descarga',
      icon: 'question',
      showDenyButton: true,
      showCancelButton: true,
      confirmButtonText: '<i class="bi bi-file-pdf"></i> PDF',
      denyButtonText: '<i class="bi bi-file-excel"></i> Excel',
      cancelButtonText: '<i class="bi bi-file-text"></i> CSV',
      confirmButtonColor: '#ef4444',
      denyButtonColor: '#22c55e',
      cancelButtonColor: '#64748b',
    }).then((result) => {
      const filename = `Listado_Pacientes_ClinicaSaaS_${new Date().toISOString().split('T')[0]}`;
      const title = 'Listado de Pacientes - Clinica SaaS';
      const user = this.authService.currentUser();
      const branding = {
        name: user?.businessName || (user?.accountType === 'PROFESSIONAL' ? `${user.firstName} ${user.lastName}` : 'Clinica SaaS Platform'),
        professional: user ? `${user.firstName} ${user.lastName}` : undefined,
        tagline: this.langService.translate('patients_list.subtitle')
      };
      
      if (result.isConfirmed) {
        this.exportService.exportToPdf(filename, title, headers, rows, branding);
      } else if (result.isDenied) {
        this.exportService.exportToExcel(filename, headers, rows, branding);
      } else if (result.dismiss === Swal.DismissReason.cancel) {
        this.exportService.exportToCsv(filename, headers, rows);
      }
    });
  }
}
