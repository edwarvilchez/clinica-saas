import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DrugService, Drug } from '../../services/drug.service';
import { AuthService } from '../../services/auth.service';
import { LanguageService } from '../../services/language.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-drug-guide',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './drug-guide.html'
})
export class DrugGuideComponent implements OnInit {
  private drugService = inject(DrugService);
  private authService = inject(AuthService);
  public lang = inject(LanguageService);

  drugs = signal<Drug[]>([]);
  loading = signal(false);
  searchTerm = '';
  selectedCategory = '';
  totalResults = 0;
  totalPages = 1;
  currentPage = 1;
  readonly limit = 20;

  categories = [
    'Analgesia', 'Antibiótico', 'Antiinflamatorio', 'Antihipertensivo',
    'Gastrointestinal', 'Vitamina', 'Cardiovascular', 'Neurología', 'Otros'
  ];

  selectedDrug?: Drug;
  drugModel: Drug = this.initDrug();
  editing = false;
  showDetailModal = signal(false);
  showFormModal = signal(false);

  ngOnInit() {
    this.loadDrugs();
  }

  loadDrugs() {
    this.loading.set(true);
    const params = {
      search: this.searchTerm,
      category: this.selectedCategory,
      limit: this.limit,
      offset: (this.currentPage - 1) * this.limit
    };

    this.drugService.getAll(params).subscribe({
      next: (res) => {
        this.drugs.set(res.drugs);
        this.totalResults = res.total;
        this.totalPages = Math.ceil(this.totalResults / this.limit);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        Swal.fire(this.lang.translate('common.error'), this.lang.translate('drug_guide.noResults'), 'error');
      }
    });
  }

  search() {
    this.currentPage = 1;
    this.loadDrugs();
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadDrugs();
    }
  }

  viewDetail(drug: Drug) {
    this.selectedDrug = drug;
    this.showDetailModal.set(true);
  }

  openCreateModal() {
    this.editing = false;
    this.drugModel = this.initDrug();
    this.showFormModal.set(true);
  }

  editDrug(drug: Drug) {
    this.editing = true;
    this.drugModel = { ...drug };
    this.showFormModal.set(true);
  }

  saveDrug() {
    if (!this.drugModel.name || !this.drugModel.activeComponents) {
      Swal.fire(this.lang.translate('common.warning'), this.lang.translate('drug_guide.validation'), 'warning');
      return;
    }
    const action = this.editing
      ? this.drugService.update(this.drugModel.id!, this.drugModel)
      : this.drugService.create(this.drugModel);

    action.subscribe({
      next: () => {
        this.showFormModal.set(false);
        this.loadDrugs();
        Swal.fire({
          icon: 'success',
          title: this.editing
            ? this.lang.translate('common.success')
            : this.lang.translate('common.success'),
          text: this.lang.translate('drug_guide.savedOk'),
          timer: 1500,
          showConfirmButton: false
        });
      },
      error: () => Swal.fire(this.lang.translate('common.error'), this.lang.translate('drug_guide.savedOk'), 'error')
    });
  }

  confirmDelete(drug: Drug) {
    const text = this.lang.translate('drug_guide.confirmDeleteText')
      .replace('{{name}}', drug.name);

    Swal.fire({
      title: this.lang.translate('drug_guide.confirmDelete'),
      text,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: this.lang.translate('drug_guide.yes'),
      cancelButtonText: this.lang.translate('drug_guide.no')
    }).then((result) => {
      if (result.isConfirmed) {
        this.drugService.delete(drug.id!).subscribe({
          next: () => {
            this.loadDrugs();
            Swal.fire(
              this.lang.translate('common.success'),
              this.lang.translate('drug_guide.deletedOk'),
              'success'
            );
          },
          error: () => Swal.fire(this.lang.translate('common.error'), '', 'error')
        });
      }
    });
  }

  private initDrug(): Drug {
    return {
      name: '', genericName: '', activeComponents: '',
      indications: '', posology: '', contraindications: '',
      adverseReactions: '', precautions: '', presentation: '', category: ''
    };
  }

  canEdit() { return this.authService.hasRole(['SUPERADMIN', 'DOCTOR', 'NURSE']); }
  canDelete() { return this.authService.hasRole(['SUPERADMIN']); }

  get pages(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }
}
