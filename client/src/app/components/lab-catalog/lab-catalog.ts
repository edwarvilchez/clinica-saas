import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormControl } from '@angular/forms';
import { RouterModule } from '@angular/router';
import Swal from 'sweetalert2';
import { LabCatalogService, LabTest, LabCombo } from '../../services/lab-catalog.service';
import { LanguageService } from '../../services/language.service';
import { CurrencyService } from '../../services/currency.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-lab-catalog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './lab-catalog.html',
  styleUrl: './lab-catalog.css'
})
export class LabCatalog implements OnInit {
  activeTab = signal<'tests' | 'combos'>('tests');
  searchControl = new FormControl('');
  
  tests = signal<LabTest[]>([]);
  combos = signal<LabCombo[]>([]);
  categories = signal<string[]>(['Hematología', 'Química', 'Serología', 'Urianálisis', 'Coprología', 'Especiales']);

  filteredTests = computed(() => {
    const term = this.searchControl.value?.toLowerCase() || '';
    return this.tests().filter(t => 
      t.name.toLowerCase().includes(term) || 
      t.category.toLowerCase().includes(term)
    );
  });

  filteredCombos = computed(() => {
    const term = this.searchControl.value?.toLowerCase() || '';
    return this.combos().filter(c => 
      c.name.toLowerCase().includes(term) || 
      c.tests?.some(t => t.name.toLowerCase().includes(term))
    );
  });
  
  currentUser = signal<any>(null);
  canManage = signal(false);
  
  constructor(
    private catalogService: LabCatalogService,
    public langService: LanguageService,
    public currencyService: CurrencyService,
    private authService: AuthService,
    private fb: FormBuilder
  ) {
    this.currentUser.set(this.authService.currentUser());
    const role = this.currentUser()?.Role?.name;
    this.canManage.set(['SUPERADMIN', 'DOCTOR', 'ADMINISTRATIVE'].includes(role));
  }

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.catalogService.getTests().subscribe(data => this.tests.set(data));
    this.catalogService.getCombos().subscribe(data => this.combos.set(data));
  }

  openTestModal(test?: LabTest) {
    if (!this.canManage()) return;

    Swal.fire({
      title: test ? this.langService.translate('lab_catalog.modals.editTest') : this.langService.translate('lab_catalog.modals.newTest'),
      html: `
        <div class="text-start">
          <label class="form-label small fw-bold">${this.langService.translate('lab_catalog.modals.testName')}</label>
          <input id="swal-test-name" class="form-control mb-3" placeholder="Ej: Hematología Completa" value="${test?.name || ''}">
          
          <label class="form-label small fw-bold">${this.langService.translate('lab_catalog.modals.price')}</label>
          <input id="swal-test-price" type="number" class="form-control mb-3" placeholder="0.00" value="${test?.price || ''}">
          
          <label class="form-label small fw-bold">${this.langService.translate('lab_catalog.modals.category')}</label>
          <select id="swal-test-category" class="form-select mb-3">
            ${this.categories().map(c => `<option value="${c}" ${test?.category === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>

          <label class="form-label small fw-bold">${this.langService.translate('lab_catalog.modals.description')}</label>
          <textarea id="swal-test-desc" class="form-control" rows="2">${test?.description || ''}</textarea>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: this.langService.translate('common.save'),
      cancelButtonText: this.langService.translate('common.cancel'),
      confirmButtonColor: '#0ea5e9',
      preConfirm: () => {
        const name = (document.getElementById('swal-test-name') as HTMLInputElement).value;
        const price = (document.getElementById('swal-test-price') as HTMLInputElement).value;
        const category = (document.getElementById('swal-test-category') as HTMLSelectElement).value;
        const description = (document.getElementById('swal-test-desc') as HTMLTextAreaElement).value;

        if (!name || !price) {
          Swal.showValidationMessage(this.langService.translate('common.error'));
          return false;
        }
        return { name, price: parseFloat(price), category, description, isActive: true };
      }
    }).then((result) => {
      if (result.isConfirmed) {
        if (test?.id) {
          this.catalogService.updateTest(test.id, result.value).subscribe(() => {
            Swal.fire(this.langService.translate('common.success'), '', 'success');
            this.loadData();
          });
        } else {
          this.catalogService.createTest(result.value).subscribe(() => {
            Swal.fire(this.langService.translate('common.success'), '', 'success');
            this.loadData();
          });
        }
      }
    });
  }

  deleteTest(id: string) {
    Swal.fire({
      title: this.langService.translate('payments.confirmDelete'),
      text: this.langService.translate('payments.confirmDeleteText'),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: this.langService.translate('payments.yesDelete'),
      cancelButtonText: this.langService.translate('common.cancel')
    }).then((result) => {
      if (result.isConfirmed) {
        this.catalogService.deleteTest(id).subscribe(() => {
          Swal.fire(this.langService.translate('payments.deleted'), '', 'success');
          this.loadData();
        });
      }
    });
  }

  importCsv() {
    if (!this.canManage()) return;

    Swal.fire({
      title: this.langService.translate('lab_catalog.modals.importTitle'),
      text: this.langService.translate('lab_catalog.modals.importText'),
      input: 'file',
      inputAttributes: {
        'accept': '.csv',
        'aria-label': 'Subir archivo de exámenes'
      },
      showCancelButton: true,
      confirmButtonText: this.langService.translate('common.save'),
      cancelButtonText: this.langService.translate('common.cancel'),
      confirmButtonColor: '#0ea5e9',
      showLoaderOnConfirm: true,
      preConfirm: (file) => {
        if (!file) {
          Swal.showValidationMessage(this.langService.translate('common.error'));
          return false;
        }
        return this.catalogService.importTests(file).toPromise();
      },
      allowOutsideClick: () => !Swal.isLoading()
    }).then((result) => {
      if (result.isConfirmed) {
        const res = result.value;
        Swal.fire({
          title: this.langService.translate('lab_catalog.modals.importSuccess'),
          html: `
            <div class="text-start small">
              <p class="mb-1 text-success fw-bold">✓ ${this.langService.translate('lab_catalog.modals.imported')}: ${res.successCount}</p>
              <p class="mb-2 text-danger fw-bold">✗ ${this.langService.translate('lab_catalog.modals.failed')}: ${res.errorCount}</p>
              ${res.errors.length > 0 ? `
                <div class="bg-light p-2 rounded border" style="max-height: 100px; overflow-y: auto;">
                  ${res.errors.map((e: any) => `<div class="mb-1 border-bottom pb-1">Row: ${JSON.stringify(e.record)}<br><span class="text-danger">${e.error}</span></div>`).join('')}
                </div>
              ` : ''}
            </div>
          `,
          icon: res.errorCount === 0 ? 'success' : 'info'
        });
        this.loadData();
      }
    });
  }

  openComboModal(combo?: LabCombo) {
    if (!this.canManage()) return;

    const availableTests = this.tests();
    
    Swal.fire({
      title: combo ? this.langService.translate('lab_catalog.modals.editCombo') : this.langService.translate('lab_catalog.modals.newCombo'),
      width: '600px',
      html: `
        <div class="text-start">
          <label class="form-label small fw-bold">${this.langService.translate('lab_catalog.modals.comboName')}</label>
          <input id="swal-combo-name" class="form-control mb-3" placeholder="Ej: Perfil 20" value="${combo?.name || ''}">
          
          <label class="form-label small fw-bold">${this.langService.translate('lab_catalog.modals.suggestedPrice')}</label>
          <input id="swal-combo-price" type="number" class="form-control mb-3" placeholder="0.00" value="${combo?.totalPrice || ''}">
          
          <label class="form-label small fw-bold">${this.langService.translate('lab_catalog.modals.selectTests')}</label>
          <div class="border rounded-3 p-2 mb-3" style="max-height: 200px; overflow-y: auto;">
            ${availableTests.map(t => `
              <div class="form-check mb-1">
                <input class="form-check-input swal-combo-test-check" type="checkbox" value="${t.id}" id="check-${t.id}" 
                  ${combo?.tests?.some(ct => ct.id === t.id) ? 'checked' : ''}>
                <label class="form-check-label small" for="check-${t.id}">
                  ${t.name} <span class="text-muted">($${t.price})</span>
                </label>
              </div>
            `).join('')}
          </div>

          <label class="form-label small fw-bold">${this.langService.translate('lab_catalog.modals.description')}</label>
          <textarea id="swal-combo-desc" class="form-control" rows="2">${combo?.description || ''}</textarea>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: this.langService.translate('common.save'),
      cancelButtonText: this.langService.translate('common.cancel'),
      confirmButtonColor: '#0ea5e9',
      preConfirm: () => {
        const name = (document.getElementById('swal-combo-name') as HTMLInputElement).value;
        const totalPrice = (document.getElementById('swal-combo-price') as HTMLInputElement).value;
        const description = (document.getElementById('swal-combo-desc') as HTMLTextAreaElement).value;
        const selectedChecks = document.querySelectorAll('.swal-combo-test-check:checked');
        const testIds = Array.from(selectedChecks).map((c: any) => c.value);

        if (!name || !totalPrice) {
          Swal.showValidationMessage(this.langService.translate('common.error'));
          return false;
        }
        return { name, totalPrice: parseFloat(totalPrice), description, testIds, isActive: true };
      }
    }).then((result) => {
      if (result.isConfirmed) {
        if (combo?.id) {
          this.catalogService.updateCombo(combo.id, result.value).subscribe(() => {
            Swal.fire(this.langService.translate('common.success'), '', 'success');
            this.loadData();
          });
        } else {
          this.catalogService.createCombo(result.value).subscribe(() => {
            Swal.fire(this.langService.translate('common.success'), '', 'success');
            this.loadData();
          });
        }
      }
    });
  }

  deleteCombo(id: string) {
    Swal.fire({
      title: this.langService.translate('payments.confirmDelete'),
      text: this.langService.translate('payments.confirmDeleteText'),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: this.langService.translate('payments.yesDelete'),
      cancelButtonText: this.langService.translate('common.cancel')
    }).then((result) => {
      if (result.isConfirmed) {
        this.catalogService.deleteCombo(id).subscribe(() => {
          Swal.fire(this.langService.translate('payments.deleted'), '', 'success');
          this.loadData();
        });
      }
    });
  }
}
