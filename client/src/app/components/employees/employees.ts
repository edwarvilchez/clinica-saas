import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { LanguageService } from '../../services/language.service';
import { CurrencyService } from '../../services/currency.service';
import { TranslatePipe } from '../../services/translate.pipe';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-employees',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './employees.html',
  styleUrls: ['./employees.css']
})
export class EmployeesComponent implements OnInit {
  private http = inject(HttpClient);
  public langService = inject(LanguageService);
  public currencyService = inject(CurrencyService);

  employees = signal<any[]>([]);
  specialties = signal<any[]>([]);
  loading = signal<boolean>(true);
  searchTerm = signal<string>('');
  viewMode = signal<'list' | 'kanban'>('list');

  showModal = false;
  isEditing = false;

  currentEmployee: any = {
    code: '',
    firstName: '',
    lastName: '',
    documentId: '',
    email: '',
    phone: '',
    department: 'MEDICAL',
    position: 'Médico Especialista',
    hireDate: new Date().toISOString().split('T')[0],
    salaryUSD: 1200,
    salaryFrequency: 'MONTHLY',
    contractType: 'INDEFINITE',
    status: 'ACTIVE',
    isDoctor: true,
    specialtyId: null,
    medicalLicense: '',
    address: ''
  };

  filteredEmployees = computed(() => {
    const term = this.searchTerm().toLowerCase();
    return this.employees().filter(e =>
      e.firstName?.toLowerCase().includes(term) ||
      e.lastName?.toLowerCase().includes(term) ||
      e.documentId?.toLowerCase().includes(term) ||
      e.code?.toLowerCase().includes(term) ||
      e.position?.toLowerCase().includes(term) ||
      e.department?.toLowerCase().includes(term)
    );
  });

  medicalEmployees = computed(() => {
    return this.filteredEmployees().filter(e => e.department === 'MEDICAL' || e.isDoctor);
  });

  nursingEmployees = computed(() => {
    return this.filteredEmployees().filter(e => e.department === 'NURSING' || (e.position || '').toLowerCase().includes('enferm'));
  });

  adminEmployees = computed(() => {
    return this.filteredEmployees().filter(e => e.department === 'ADMIN' || e.department === 'ADMINISTRATION');
  });

  servicesEmployees = computed(() => {
    return this.filteredEmployees().filter(e => 
      e.department !== 'MEDICAL' && !e.isDoctor && e.department !== 'NURSING' && !(e.position || '').toLowerCase().includes('enferm') && e.department !== 'ADMIN' && e.department !== 'ADMINISTRATION'
    );
  });

  ngOnInit() {
    this.loadEmployees();
    this.loadSpecialties();
  }

  getHeaders() {
    const token = localStorage.getItem('token');
    return { Authorization: `Bearer ${token}` };
  }

  loadEmployees() {
    this.loading.set(true);
    this.http.get<any[]>('/api/employees', { headers: this.getHeaders() }).subscribe({
      next: (data) => {
        this.employees.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading employees:', err);
        this.loading.set(false);
      }
    });
  }

  loadSpecialties() {
    this.http.get<any[]>('/api/specialties', { headers: this.getHeaders() }).subscribe({
      next: (data) => this.specialties.set(data),
      error: (err) => console.error('Error loading specialties:', err)
    });
  }

  openCreateModal() {
    this.isEditing = false;
    this.currentEmployee = {
      code: `EMP-${Math.floor(100 + Math.random() * 900)}`,
      firstName: '',
      lastName: '',
      documentId: '',
      email: '',
      phone: '',
      department: 'MEDICAL',
      position: 'Médico Tratante',
      hireDate: new Date().toISOString().split('T')[0],
      salaryUSD: 1200,
      salaryFrequency: 'MONTHLY',
      contractType: 'INDEFINITE',
      status: 'ACTIVE',
      isDoctor: true,
      specialtyId: this.specialties()[0]?.id || null,
      medicalLicense: `MPPS-${Math.floor(10000 + Math.random() * 90000)}`,
      address: ''
    };
    this.showModal = true;
  }

  openEditModal(emp: any) {
    this.isEditing = true;
    this.currentEmployee = { ...emp };
    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
  }

  saveEmployee() {
    if (!this.currentEmployee.firstName || !this.currentEmployee.lastName || !this.currentEmployee.documentId) {
      Swal.fire('Validación', 'Nombre, Apellido y Cédula son obligatorios', 'warning');
      return;
    }

    if (this.isEditing) {
      this.http.put(`/api/employees/${this.currentEmployee.id}`, this.currentEmployee, { headers: this.getHeaders() }).subscribe({
        next: () => {
          Swal.fire('Éxito', 'Ficha del empleado actualizada', 'success');
          this.closeModal();
          this.loadEmployees();
        },
        error: (err) => Swal.fire('Error', err.error?.message || 'Error al actualizar', 'error')
      });
    } else {
      this.http.post('/api/employees', this.currentEmployee, { headers: this.getHeaders() }).subscribe({
        next: () => {
          Swal.fire('Éxito', 'Empleado registrado y sincronizado con RRHH / Médicos', 'success');
          this.closeModal();
          this.loadEmployees();
        },
        error: (err) => Swal.fire('Error', err.error?.message || 'Error al registrar empleado', 'error')
      });
    }
  }

  deleteEmployee(emp: any) {
    Swal.fire({
      title: '¿Desactivar empleado?',
      text: `Se dará de baja a ${emp.firstName} ${emp.lastName}`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Sí, dar de baja',
      cancelButtonText: 'Cancelar'
    }).then((res) => {
      if (res.isConfirmed) {
        this.http.delete(`/api/employees/${emp.id}`, { headers: this.getHeaders() }).subscribe({
          next: () => {
            Swal.fire('Listo', 'Empleado desactivado', 'success');
            this.loadEmployees();
          },
          error: (err) => Swal.fire('Error', err.error?.message || 'No se pudo eliminar', 'error')
        });
      }
    });
  }
}
