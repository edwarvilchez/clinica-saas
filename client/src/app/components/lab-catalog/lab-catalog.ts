import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormControl } from '@angular/forms';
import { RouterModule } from '@angular/router';
import Swal from 'sweetalert2';
import { LabCatalogService, LabTest, LabCombo } from '../../services/lab-catalog.service';
import { LanguageService } from '../../services/language.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { CurrencyService } from '../../services/currency.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-lab-catalog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, TranslatePipe],
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
    public authService: AuthService,
    private fb: FormBuilder
  ) {
    this.canManage.set(this.authService.hasRole(['SUPERADMIN', 'DOCTOR', 'ADMINISTRATIVE', 'ADMIN']));
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
      confirmButtonColor: '#10b981',
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

  openPresetsModal() {
    if (!this.canManage()) return;

    const presets = [
      { name: 'Hematología Completa', category: 'Hematología', price: 8.00, desc: 'Hemoglobina, Hematocrito, Contaje Blanco y Diferencial, Plaquetas.' },
      { name: 'Glicemia', category: 'Química', price: 5.00, desc: 'Nivel de glucosa en sangre en ayunas.' },
      { name: 'Urea', category: 'Química', price: 5.00, desc: 'Evaluación de la función renal.' },
      { name: 'Creatinina', category: 'Química', price: 5.00, desc: 'Evaluación precisa de la función renal.' },
      { name: 'Colesterol Total', category: 'Química', price: 5.00, desc: 'Perfil lipídico básico.' },
      { name: 'Triglicéridos', category: 'Química', price: 5.00, desc: 'Perfil lipídico básico.' },
      { name: 'Ácido Úrico', category: 'Química', price: 5.00, desc: 'Detección de hiperuricemia.' },
      { name: 'Examen General de Orina', category: 'Urianálisis', price: 5.00, desc: 'Análisis físico, químico y microscópico.' },
      { name: 'Examen de Heces', category: 'Coprología', price: 5.00, desc: 'Detección de parásitos y sangre oculta.' },
      { name: 'VDRL', category: 'Serología', price: 6.00, desc: 'Prueba de detección de sífilis.' },
      { name: 'HIV (1ra y 2da Gen)', category: 'Serología', price: 15.00, desc: 'Prueba de detección de anticuerpos HIV.' },
      { name: 'Perfil Hepático', category: 'Química', price: 20.00, desc: 'TGO, TGP, Bilirrubinas, Fosfatasa Alcalina.' },
      { name: 'PT / PTT', category: 'Especiales', price: 12.00, desc: 'Pruebas de coagulación sanguínea.' },
      { name: 'Proteína C Reactiva (PCR)', category: 'Serología', price: 10.00, desc: 'Marcador de inflamación aguda.' },
      { name: 'Factor Reumatoide (RA)', category: 'Serología', price: 10.00, desc: 'Detección de artritis reumatoide.' },
      { name: 'Perfil Tiroideo (TSH, T3, T4)', category: 'Especiales', price: 30.00, desc: 'Evaluación de la función tiroidea.' },
      { name: 'Beta HCG (Embarazo)', category: 'Serología', price: 12.00, desc: 'Prueba cuantitativa de embarazo.' }
    ];

    Swal.fire({
      title: this.langService.translate('lab_catalog.commonTests'),
      width: '700px',
      html: `
        <div class="text-start">
          <p class="text-muted small mb-3">Seleccione los exámenes que desea agregar rápidamente a su catálogo con precios base sugeridos ($).</p>
          <div class="row g-2 border rounded-3 p-3 bg-light" style="max-height: 400px; overflow-y: auto;">
            ${presets.map((p, i) => `
              <div class="col-md-6 mb-2">
                <div class="form-check p-2 border rounded-3 bg-white hover-shadow transition h-100">
                  <input class="form-check-input swal-preset-check ms-0 me-2" type="checkbox" value="${i}" id="preset-${i}">
                  <label class="form-check-label d-block" for="preset-${i}">
                    <div class="fw-bold small">${p.name}</div>
                    <div class="d-flex justify-content-between align-items-center mt-1">
                      <span class="badge bg-secondary opacity-75 x-small">${p.category}</span>
                      <span class="fw-bold text-primary small">$${p.price.toFixed(2)}</span>
                    </div>
                  </label>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: this.langService.translate('lab_catalog.addCommon'),
      cancelButtonText: this.langService.translate('common.cancel'),
      confirmButtonColor: '#10b981',
      showLoaderOnConfirm: true,
      preConfirm: () => {
        const checks = document.querySelectorAll('.swal-preset-check:checked');
        const selectedIndices = Array.from(checks).map((c: any) => parseInt(c.value));
        
        if (selectedIndices.length === 0) {
          Swal.showValidationMessage('Debe seleccionar al menos un examen');
          return false;
        }

        const selectedTests = selectedIndices.map(idx => presets[idx]);
        // Sequential creation for simplicity/stability in small batches
        const promises = selectedTests.map(t => 
            this.catalogService.createTest({
                name: t.name,
                category: t.category,
                price: t.price,
                description: t.desc,
                isActive: true
            }).toPromise()
        );

        return Promise.all(promises);
      }
    }).then((result) => {
      if (result.isConfirmed) {
        Swal.fire('¡Éxito!', `${result.value.length} exámenes agregados correctamente.`, 'success');
        this.loadData();
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
      confirmButtonColor: '#10b981',
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
      confirmButtonColor: '#10b981',
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
