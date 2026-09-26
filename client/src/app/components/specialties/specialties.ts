import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { LanguageService } from '../../services/language.service';
import { CurrencyService } from '../../services/currency.service';
import { TranslatePipe } from '../../services/translate.pipe';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-specialties',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './specialties.html',
  styleUrls: ['./specialties.css']
})
export class SpecialtiesComponent implements OnInit {
  private http = inject(HttpClient);
  public langService = inject(LanguageService);
  public currencyService = inject(CurrencyService);

  specialties = signal<any[]>([]);
  loading = signal<boolean>(true);
  searchTerm = signal<string>('');
  viewMode = signal<'list' | 'kanban'>('kanban');

  // Modal / Form state
  showModal = false;
  isEditing = false;
  currentSpecialty: any = {
    code: '',
    name: '',
    nameEn: '',
    description: '',
    baseFeeUSD: 40.00,
    departmentId: null,
    isActive: true
  };

  filteredSpecialties = computed(() => {
    const term = this.searchTerm().toLowerCase();
    return this.specialties().filter(s =>
      s.name?.toLowerCase().includes(term) ||
      s.nameEn?.toLowerCase().includes(term) ||
      s.code?.toLowerCase().includes(term) ||
      s.Department?.name?.toLowerCase().includes(term)
    );
  });

  ngOnInit() {
    this.loadSpecialties();
  }

  loadSpecialties() {
    this.loading.set(true);
    const token = localStorage.getItem('token');
    this.http.get<any[]>('/api/specialties', {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe({
      next: (data) => {
        this.specialties.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading specialties:', err);
        this.loading.set(false);
      }
    });
  }

  openCreateModal() {
    this.isEditing = false;
    this.currentSpecialty = {
      code: `ESP-${Math.floor(100 + Math.random() * 900)}`,
      name: '',
      nameEn: '',
      description: '',
      baseFeeUSD: 40.00,
      departmentId: null,
      isActive: true
    };
    this.showModal = true;
  }

  openEditModal(specialty: any) {
    this.isEditing = true;
    this.currentSpecialty = { ...specialty };
    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
  }

  saveSpecialty() {
    if (!this.currentSpecialty.name) {
      Swal.fire('Atención', 'El nombre de la especialidad es obligatorio', 'warning');
      return;
    }

    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    if (this.isEditing) {
      this.http.put(`/api/specialties/${this.currentSpecialty.id}`, this.currentSpecialty, { headers }).subscribe({
        next: () => {
          Swal.fire('Éxito', 'Especialidad actualizada correctamente', 'success');
          this.closeModal();
          this.loadSpecialties();
        },
        error: (err) => Swal.fire('Error', err.error?.message || 'Error al actualizar', 'error')
      });
    } else {
      this.http.post('/api/specialties', this.currentSpecialty, { headers }).subscribe({
        next: () => {
          Swal.fire('Éxito', 'Especialidad registrada correctamente', 'success');
          this.closeModal();
          this.loadSpecialties();
        },
        error: (err) => Swal.fire('Error', err.error?.message || 'Error al guardar', 'error')
      });
    }
  }

  deleteSpecialty(specialty: any) {
    Swal.fire({
      title: '¿Eliminar especialidad?',
      text: `Se eliminará "${specialty.name}" del catálogo`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        const token = localStorage.getItem('token');
        this.http.delete(`/api/specialties/${specialty.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        }).subscribe({
          next: () => {
            Swal.fire('Eliminada', 'Especialidad eliminada con éxito', 'success');
            this.loadSpecialties();
          },
          error: (err) => Swal.fire('Error', err.error?.message || 'No se pudo eliminar', 'error')
        });
      }
    });
  }
}
