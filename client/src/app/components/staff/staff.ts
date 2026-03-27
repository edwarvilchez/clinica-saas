import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { API_URL } from '../../api-config';
import { LanguageService } from '../../services/language.service';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-staff',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, TranslatePipe],
  templateUrl: './staff.html',
  styleUrl: './staff.css',
})
export class Staff implements OnInit {
  staffList = signal<any[]>([]);
  searchTerm = signal('');
  departmentFilter = signal('all');
  showAdvancedFilters = signal(false);

  filteredStaff = computed(() => {
    const term = this.searchTerm().toLowerCase();
    const department = this.departmentFilter();
    
    return this.staffList().filter(s => {
      const matchesSearch = 
        s.User.firstName.toLowerCase().includes(term) || 
        s.User.lastName.toLowerCase().includes(term) ||
        s.position.toLowerCase().includes(term) ||
        s.departmentName.toLowerCase().includes(term);
      
      const matchesDepartment = department === 'all' || s.departmentName === department;
      
      return matchesSearch && matchesDepartment;
    });
  });

  constructor(
    private http: HttpClient,
    public langService: LanguageService
  ) {}

  ngOnInit() {
    this.loadStaff();
  }

  getHeaders() {
    return new HttpHeaders({ 'Authorization': `Bearer ${localStorage.getItem('token')}` });
  }

  loadStaff() {
    this.http.get<any>(`${API_URL}/staff`, { headers: this.getHeaders() })
      .subscribe(data => {
        const list = Array.isArray(data) ? data : (data.staff || []);
        this.staffList.set(list);
      });
  }

  toggleAdvancedFilters() {
    this.showAdvancedFilters.set(!this.showAdvancedFilters());
  }

  clearFilters() {
    this.searchTerm.set('');
    this.departmentFilter.set('all');
    Swal.fire({
      title: 'Filtros Limpiados',
      text: 'Se han restablecido todos los filtros',
      icon: 'success',
      timer: 1500,
      showConfirmButton: false
    });
  }

  createNewStaff() {
    Swal.fire({
      title: 'Nuevo Miembro del Personal',
      html: `
        <div class="text-start">
          <div class="row g-2">
            <div class="col-md-6">
              <label class="form-label small fw-bold mb-1">Nombre</label>
              <input id="firstName" class="form-control form-control-sm" placeholder="Carlos">
            </div>
            <div class="col-md-6">
              <label class="form-label small fw-bold mb-1">Apellido</label>
              <input id="lastName" class="form-control form-control-sm" placeholder="Rodríguez">
            </div>
            <div class="col-md-6">
              <label class="form-label small fw-bold mb-1">Email</label>
              <input id="email" type="email" class="form-control form-control-sm" placeholder="staff@clinicasaas.com">
            </div>
            <div class="col-md-6">
              <label class="form-label small fw-bold mb-1">Teléfono</label>
              <input id="phone" class="form-control form-control-sm" placeholder="+58412-1234567">
            </div>
            <div class="col-md-6">
              <label class="form-label small fw-bold mb-1">ID Empleado</label>
              <input id="employeeId" class="form-control form-control-sm" placeholder="EMP-001">
            </div>
            <div class="col-md-6">
              <label class="form-label small fw-bold mb-1">Cargo</label>
              <select id="position" class="form-select form-select-sm">
                <option value="Recepcionista">Recepcionista</option>
                <option value="Asistente Administrativo">Asistente Administrativo</option>
                <option value="Coordinador">Coordinador</option>
                <option value="Gerente">Gerente</option>
                <option value="Contador">Contador</option>
                <option value="Recursos Humanos">Recursos Humanos</option>
                <option value="Limpieza">Limpieza</option>
                <option value="Seguridad">Seguridad</option>
                <option value="Mantenimiento">Mantenimiento</option>
              </select>
            </div>
            <div class="col-12">
              <label class="form-label small fw-bold mb-1">Departamento</label>
              <select id="departmentName" class="form-select form-select-sm">
                <option value="Administración">Administración</option>
                <option value="Recepción">Recepción</option>
                <option value="Contabilidad">Contabilidad</option>
                <option value="Recursos Humanos">Recursos Humanos</option>
                <option value="Servicios Generales">Servicios Generales</option>
                <option value="Seguridad">Seguridad</option>
                <option value="Mantenimiento">Mantenimiento</option>
                <option value="Sistemas">Sistemas</option>
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
      confirmButtonText: 'Crear Personal',
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
        const email = (document.getElementById('email') as HTMLInputElement).value;
        const phone = (document.getElementById('phone') as HTMLInputElement).value;
        const employeeId = (document.getElementById('employeeId') as HTMLInputElement).value;
        const position = (document.getElementById('position') as HTMLSelectElement).value;
        const departmentName = (document.getElementById('departmentName') as HTMLSelectElement).value;
        const password = (document.getElementById('password') as HTMLInputElement).value;

        if (!firstName || !lastName || !email || !phone || !employeeId || !password) {
          Swal.showValidationMessage('Por favor completa todos los campos obligatorios');
          return false;
        }

        return { firstName, lastName, email, phone, employeeId, position, departmentName, password };
      }
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        const staffData = {
          username: result.value.email.split('@')[0],
          email: result.value.email,
          password: result.value.password,
          firstName: result.value.firstName,
          lastName: result.value.lastName,
          phone: result.value.phone,
          employeeId: result.value.employeeId,
          position: result.value.position,
          departmentName: result.value.departmentName
        };

        this.http.post(`${API_URL}/staff`, staffData, { headers: this.getHeaders() })
          .subscribe({
            next: () => {
              this.loadStaff();
              Swal.fire({
                title: '¡Personal Creado!',
                text: 'El miembro del personal ha sido registrado exitosamente.',
                icon: 'success',
                confirmButtonColor: '#10b981'
              });
            },
            error: (err) => {
              Swal.fire({
                title: 'Error',
                text: err.error?.message || 'No se pudo crear el registro. Verifica los datos.',
                icon: 'error',
                confirmButtonColor: '#ef4444'
              });
            }
          });
      }
    });
  }

  deleteStaff(id: string) {
    Swal.fire({
      title: '¿Eliminar personal?',
      text: "Esta acción no se puede deshacer.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.http.delete(`${API_URL}/staff/${id}`, { headers: this.getHeaders() })
          .subscribe({
            next: () => {
              this.loadStaff();
              Swal.fire({
                title: '¡Eliminado!',
                text: 'El miembro del personal ha sido removido.',
                icon: 'success',
                confirmButtonColor: '#10b981'
              });
            },
            error: () => {
              Swal.fire({
                title: 'Error',
                text: 'No se pudo eliminar el registro',
                icon: 'error',
                confirmButtonColor: '#ef4444'
              });
            }
          });
      }
    });
  }
}
