import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { LanguageService } from '../../services/language.service';
import { API_URL } from '../../api-config';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-nurses',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, TranslatePipe],
  templateUrl: './nurses.html',
  styleUrl: './nurses.css',
})
export class Nurses implements OnInit {
  nurses = signal<any[]>([]);
  searchTerm = signal('');
  shiftFilter = signal('all');
  showAdvancedFilters = signal(false);

  filteredNurses = computed(() => {
    const term = this.searchTerm().toLowerCase();
    const shift = this.shiftFilter();
    
    return this.nurses().filter(n => {
      const matchesSearch = 
        n.User.firstName.toLowerCase().includes(term) || 
        n.User.lastName.toLowerCase().includes(term) ||
        n.specialization.toLowerCase().includes(term);
      
      const matchesShift = shift === 'all' || n.shift === shift;
      
      return matchesSearch && matchesShift;
    });
  });

  constructor(
    private http: HttpClient,
    public langService: LanguageService
  ) {}

  ngOnInit() {
    this.loadNurses();
  }

  getHeaders() {
    return new HttpHeaders({ 'Authorization': `Bearer ${localStorage.getItem('token')}` });
  }

  loadNurses() {
    this.http.get<any>(`${API_URL}/nurses`, { headers: this.getHeaders() })
      .subscribe(data => {
        const list = Array.isArray(data) ? data : (data.nurses || []);
        this.nurses.set(list);
      });
  }

  toggleAdvancedFilters() {
    this.showAdvancedFilters.set(!this.showAdvancedFilters());
  }

  clearFilters() {
    this.searchTerm.set('');
    this.shiftFilter.set('all');
    Swal.fire({
      title: this.langService.translate('nurses.filtersCleared'),
      text: this.langService.translate('nurses.filtersClearedMsg'),
      icon: 'success',
      timer: 1500,
      showConfirmButton: false
    });
  }

  createNewNurse() {
    Swal.fire({
      title: this.langService.translate('nurses.new'),
      html: `
        <div class="text-start">
          <div class="row g-2">
            <div class="col-md-6">
              <label class="form-label small fw-bold mb-1">${this.langService.translate('nurses.fields.firstName')}</label>
              <input id="firstName" class="form-control form-control-sm" placeholder="María">
            </div>
            <div class="col-md-6">
              <label class="form-label small fw-bold mb-1">${this.langService.translate('nurses.fields.lastName')}</label>
              <input id="lastName" class="form-control form-control-sm" placeholder="González">
            </div>
            <div class="col-md-6">
              <label class="form-label small fw-bold mb-1">${this.langService.translate('nurses.fields.email')}</label>
              <input id="email" type="email" class="form-control form-control-sm" placeholder="enfermera@clinicasaas.com">
            </div>
            <div class="col-md-6">
              <label class="form-label small fw-bold mb-1">${this.langService.translate('nurses.fields.phone')}</label>
              <input id="phone" class="form-control form-control-sm" placeholder="+58412-1234567">
            </div>
            <div class="col-md-6">
              <label class="form-label small fw-bold mb-1">${this.langService.translate('nurses.fields.license')}</label>
              <input id="licenseNumber" class="form-control form-control-sm" placeholder="ENF-12345">
            </div>
            <div class="col-md-6">
              <label class="form-label small fw-bold mb-1">${this.langService.translate('nurses.fields.shift')}</label>
              <select id="shift" class="form-select form-select-sm">
                <option value="Mañana">${this.langService.translate('nurses.shifts.morning')}</option>
                <option value="Tarde">${this.langService.translate('nurses.shifts.afternoon')}</option>
                <option value="Noche">${this.langService.translate('nurses.shifts.night')}</option>
                <option value="Rotativo">${this.langService.translate('nurses.shifts.rotating')}</option>
              </select>
            </div>
            <div class="col-12">
              <label class="form-label small fw-bold mb-1">${this.langService.translate('nurses.fields.specialization')}</label>
              <select id="specialization" class="form-select form-select-sm">
                <option value="Enfermería General">${this.langService.translate('nurses.specialties.general')}</option>
                <option value="Cuidados Intensivos">${this.langService.translate('nurses.specialties.icu')}</option>
                <option value="Pediatría">${this.langService.translate('nurses.specialties.pediatrics')}</option>
                <option value="Quirófano">${this.langService.translate('nurses.specialties.surgery')}</option>
                <option value="Emergencias">${this.langService.translate('nurses.specialties.emergency')}</option>
                <option value="Geriatría">${this.langService.translate('nurses.specialties.geriatrics')}</option>
                <option value="Neonatología">${this.langService.translate('nurses.specialties.neonatology')}</option>
                <option value="Oncología">${this.langService.translate('nurses.specialties.oncology')}</option>
              </select>
            </div>
            <div class="col-12">
              <label class="form-label small fw-bold mb-1">${this.langService.translate('nurses.fields.password')}</label>
              <input id="password" type="password" class="form-control form-control-sm" placeholder="${this.langService.translate('nurses.fields.passwordPlaceholder')}">
            </div>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: this.langService.translate('nurses.new'),
      cancelButtonText: this.langService.translate('common.cancel'),
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
        const shift = (document.getElementById('shift') as HTMLSelectElement).value;
        const specialization = (document.getElementById('specialization') as HTMLSelectElement).value;
        const password = (document.getElementById('password') as HTMLInputElement).value;

        if (!firstName || !lastName || !email || !phone || !licenseNumber || !password) {
          Swal.showValidationMessage(this.langService.translate('nurses.messages.completeRequired'));
          return false;
        }

        return { firstName, lastName, email, phone, licenseNumber, shift, specialization, password };
      }
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        const nurseData = {
          username: result.value.email.split('@')[0],
          email: result.value.email,
          password: result.value.password,
          firstName: result.value.firstName,
          lastName: result.value.lastName,
          phone: result.value.phone,
          licenseNumber: result.value.licenseNumber,
          shift: result.value.shift,
          specialization: result.value.specialization
        };

        this.http.post(`${API_URL}/nurses`, nurseData, { headers: this.getHeaders() })
          .subscribe({
            next: () => {
              this.loadNurses();
              Swal.fire({
                title: this.langService.translate('nurses.messages.created'),
                text: this.langService.translate('nurses.messages.createdMsg'),
                icon: 'success',
                confirmButtonColor: '#10b981'
              });
            },
            error: (err) => {
              Swal.fire({
                title: this.langService.translate('common.error'),
                text: err.error?.message || 'No se pudo crear el registro.',
                icon: 'error',
                confirmButtonColor: '#ef4444'
              });
            }
          });
      }
    });
  }

  deleteNurse(id: string) {
    Swal.fire({
      title: this.langService.translate('nurses.messages.confirmDelete'),
      text: this.langService.translate('nurses.messages.confirmDeleteText'),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: this.langService.translate('nurses.messages.yesDelete'),
      cancelButtonText: this.langService.translate('common.cancel')
    }).then((result) => {
      if (result.isConfirmed) {
        this.http.delete(`${API_URL}/nurses/${id}`, { headers: this.getHeaders() })
          .subscribe({
            next: () => {
              this.loadNurses();
              Swal.fire({
                title: this.langService.translate('nurses.messages.deleted'),
                text: this.langService.translate('nurses.messages.deletedMsg'),
                icon: 'success',
                confirmButtonColor: '#10b981'
              });
            },
            error: () => {
              Swal.fire({
                title: this.langService.translate('common.error'),
                text: this.langService.translate('nurses.messages.errorDelete'),
                icon: 'error',
                confirmButtonColor: '#ef4444'
              });
            }
          });
      }
    });
  }
}
