import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { LanguageService } from '../../services/language.service';
import { CurrencyService } from '../../services/currency.service';
import { TranslatePipe } from '../../services/translate.pipe';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-sales',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './sales.html',
  styleUrls: ['./sales.css']
})
export class SalesComponent implements OnInit {
  private http = inject(HttpClient);
  public langService = inject(LanguageService);
  public currencyService = inject(CurrencyService);

  activeTab = signal<'quotes' | 'packages' | 'services'>('quotes');
  viewMode = signal<'list' | 'kanban'>('list');
  loading = signal<boolean>(true);

  // Packages & Combos (Plantillas predeterminadas)
  packages = signal<any[]>([]);
  packageSearch = signal<string>('');
  showPackageModal = false;
  editingPackage = false;
  currentPackage: any = {
    code: '',
    name: '',
    category: 'SURGERY',
    description: '',
    totalPriceUSD: 0,
    estimatedDurationHours: 2.0,
    items: [],
    notes: ''
  };
  pkgItemTemp: any = {
    concept: '',
    type: 'FACILITY',
    quantity: 1,
    unitPriceUSD: 0
  };

  // Clinical Services
  services = signal<any[]>([]);
  serviceSearch = signal<string>('');
  showServiceModal = false;
  editingService = false;
  currentService: any = {
    code: '',
    name: '',
    nameEn: '',
    category: 'CONSULTATION',
    priceUSD: 0,
    costUSD: 0,
    isTaxExempt: true,
    requiresDoctor: false,
    isActive: true
  };

  // Quotes / Presupuestos
  quotes = signal<any[]>([]);
  quoteSearch = signal<string>('');
  patients = signal<any[]>([]);
  insuranceCompanies = signal<any[]>([]);
  showQuoteModal = false;
  viewingQuote: any = null;
  showQuoteDetailModal = false;

  currentQuote: any = {
    patientId: null,
    patientName: '',
    patientDocumentId: '',
    patientPhone: '',
    patientEmail: '',
    insuranceCompanyId: null,
    title: 'Presupuesto de Servicios Clínicos',
    currency: 'USD',
    exchangeRateBCV: 36.50,
    bcvRate: 36.50,
    discountAmount: 0,
    notes: '',
    validUntil: '',
    items: []
  };

  quoteItemTemp: any = {
    serviceId: null,
    concept: '',
    description: '',
    quantity: 1,
    unitPriceUSD: 0,
    discountPercent: 0
  };

  filteredPackages = computed(() => {
    const term = this.packageSearch().toLowerCase();
    return this.packages().filter(p =>
      p.name?.toLowerCase().includes(term) ||
      p.code?.toLowerCase().includes(term) ||
      p.category?.toLowerCase().includes(term) ||
      p.description?.toLowerCase().includes(term)
    );
  });

  filteredServices = computed(() => {
    const term = this.serviceSearch().toLowerCase();
    return this.services().filter(s =>
      s.name?.toLowerCase().includes(term) ||
      s.code?.toLowerCase().includes(term) ||
      s.category?.toLowerCase().includes(term)
    );
  });

  filteredQuotes = computed(() => {
    const term = this.quoteSearch().toLowerCase();
    return this.quotes().filter(q =>
      q.quoteNumber?.toLowerCase().includes(term) ||
      q.patientName?.toLowerCase().includes(term) ||
      q.patientDocumentId?.toLowerCase().includes(term) ||
      q.title?.toLowerCase().includes(term) ||
      q.status?.toLowerCase().includes(term)
    );
  });

  getQuotesByStage(stage: string): any[] {
    return this.filteredQuotes().filter(q => (q.status || 'DRAFT') === stage || (stage === 'SENT' && q.status === 'ISSUED'));
  }

  getQuotesTotalUSD(stage: string): number {
    return this.getQuotesByStage(stage).reduce((acc, q) => acc + (parseFloat(q.totalUSD || q.totalAmountUSD) || 0), 0);
  }

  ngOnInit() {
    this.currentQuote.exchangeRateBCV = this.currencyService.rate || 36.50;
    this.currentQuote.bcvRate = this.currencyService.rate || 36.50;
    this.loadServices();
    this.loadPackages();
    this.loadQuotes();
    this.loadPatients();
    this.loadInsuranceCompanies();
  }

  getHeaders() {
    const token = localStorage.getItem('token');
    return { Authorization: `Bearer ${token}` };
  }

  loadPackages() {
    this.http.get<any[]>('/api/sales/packages', { headers: this.getHeaders() }).subscribe({
      next: (data) => this.packages.set(data),
      error: (err) => console.error('Error loading packages:', err)
    });
  }

  loadServices() {
    this.loading.set(true);
    this.http.get<any[]>('/api/sales/services', { headers: this.getHeaders() }).subscribe({
      next: (data) => {
        this.services.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading services:', err);
        this.loading.set(false);
      }
    });
  }

  loadQuotes() {
    this.loading.set(true);
    this.http.get<any[]>('/api/sales/quotes', { headers: this.getHeaders() }).subscribe({
      next: (data) => {
        this.quotes.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading quotes:', err);
        this.loading.set(false);
      }
    });
  }

  loadPatients() {
    this.http.get<any[]>('/api/patients', { headers: this.getHeaders() }).subscribe({
      next: (data) => this.patients.set(data),
      error: (err) => console.error('Error loading patients:', err)
    });
  }

  loadInsuranceCompanies() {
    this.http.get<any[]>('/api/insurance/companies', { headers: this.getHeaders() }).subscribe({
      next: (data) => this.insuranceCompanies.set(data),
      error: (err) => console.error('Error loading insurers:', err)
    });
  }

  // --- SERVICE MANAGEMENT ---
  openCreateServiceModal() {
    this.editingService = false;
    this.currentService = {
      code: `SRV-${Math.floor(1000 + Math.random() * 9000)}`,
      name: '',
      nameEn: '',
      category: 'CONSULTATION',
      priceUSD: 50,
      costUSD: 20,
      isTaxExempt: true,
      requiresDoctor: true,
      isActive: true
    };
    this.showServiceModal = true;
  }

  openEditServiceModal(service: any) {
    this.editingService = true;
    this.currentService = { ...service };
    this.showServiceModal = true;
  }

  closeServiceModal() {
    this.showServiceModal = false;
  }

  saveService() {
    if (!this.currentService.name || this.currentService.priceUSD <= 0) {
      Swal.fire('Validación', 'El nombre y el precio USD deben ser válidos', 'warning');
      return;
    }

    if (this.editingService) {
      this.http.put(`/api/sales/services/${this.currentService.id}`, this.currentService, { headers: this.getHeaders() }).subscribe({
        next: () => {
          Swal.fire('Éxito', 'Servicio actualizado correctamente', 'success');
          this.closeServiceModal();
          this.loadServices();
        },
        error: (err) => Swal.fire('Error', err.error?.message || 'Error al actualizar', 'error')
      });
    } else {
      this.http.post('/api/sales/services', this.currentService, { headers: this.getHeaders() }).subscribe({
        next: () => {
          Swal.fire('Éxito', 'Servicio creado correctamente', 'success');
          this.closeServiceModal();
          this.loadServices();
        },
        error: (err) => Swal.fire('Error', err.error?.message || 'Error al guardar', 'error')
      });
    }
  }

  deleteService(service: any) {
    Swal.fire({
      title: '¿Desactivar servicio?',
      text: `Se desactivará el servicio "${service.name}"`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, continuar',
      cancelButtonText: 'Cancelar'
    }).then((res) => {
      if (res.isConfirmed) {
        this.http.delete(`/api/sales/services/${service.id}`, { headers: this.getHeaders() }).subscribe({
          next: () => {
            Swal.fire('Listo', 'Servicio eliminado', 'success');
            this.loadServices();
          },
          error: (err) => Swal.fire('Error', err.error?.message || 'Error al eliminar', 'error')
        });
      }
    });
  }

  // --- PACKAGES / COMBOS MANAGEMENT ---
  openCreatePackageModal() {
    this.editingPackage = false;
    this.currentPackage = {
      code: `PKG-${Math.floor(1000 + Math.random() * 9000)}`,
      name: '',
      category: 'SURGERY',
      description: '',
      totalPriceUSD: 0,
      estimatedDurationHours: 2.0,
      items: [],
      notes: ''
    };
    this.pkgItemTemp = { concept: '', type: 'FACILITY', quantity: 1, unitPriceUSD: 0 };
    this.showPackageModal = true;
  }

  openEditPackageModal(pkg: any) {
    this.editingPackage = true;
    this.currentPackage = JSON.parse(JSON.stringify(pkg));
    if (!this.currentPackage.items) this.currentPackage.items = [];
    this.pkgItemTemp = { concept: '', type: 'FACILITY', quantity: 1, unitPriceUSD: 0 };
    this.showPackageModal = true;
  }

  closePackageModal() {
    this.showPackageModal = false;
  }

  addPkgItem() {
    if (!this.pkgItemTemp.concept || this.pkgItemTemp.unitPriceUSD < 0) {
      Swal.fire('Atención', 'Ingrese el concepto y precio del componente del combo', 'warning');
      return;
    }
    this.currentPackage.items.push({
      concept: this.pkgItemTemp.concept,
      type: this.pkgItemTemp.type || 'FACILITY',
      quantity: Number(this.pkgItemTemp.quantity || 1),
      unitPriceUSD: Number(this.pkgItemTemp.unitPriceUSD || 0)
    });
    this.recalculatePackageTotal();
    this.pkgItemTemp = { concept: '', type: 'FACILITY', quantity: 1, unitPriceUSD: 0 };
  }

  removePkgItem(index: number) {
    this.currentPackage.items.splice(index, 1);
    this.recalculatePackageTotal();
  }

  recalculatePackageTotal() {
    this.currentPackage.totalPriceUSD = this.currentPackage.items.reduce(
      (acc: number, item: any) => acc + (Number(item.quantity) * Number(item.unitPriceUSD)),
      0
    );
  }

  savePackage() {
    if (!this.currentPackage.name || !this.currentPackage.code) {
      Swal.fire('Validación', 'El código y nombre del paquete son obligatorios', 'warning');
      return;
    }

    if (this.editingPackage) {
      this.http.put(`/api/sales/packages/${this.currentPackage.id}`, this.currentPackage, { headers: this.getHeaders() }).subscribe({
        next: () => {
          Swal.fire('Éxito', 'Combo/Plantilla actualizado correctamente', 'success');
          this.closePackageModal();
          this.loadPackages();
        },
        error: (err) => Swal.fire('Error', err.error?.message || 'Error al actualizar combo', 'error')
      });
    } else {
      this.http.post('/api/sales/packages', this.currentPackage, { headers: this.getHeaders() }).subscribe({
        next: () => {
          Swal.fire('Éxito', 'Combo/Plantilla creado correctamente', 'success');
          this.closePackageModal();
          this.loadPackages();
        },
        error: (err) => Swal.fire('Error', err.error?.message || 'Error al guardar combo', 'error')
      });
    }
  }

  deletePackage(pkg: any) {
    Swal.fire({
      title: '¿Eliminar paquete o combo?',
      text: `Se eliminará la plantilla "${pkg.name}"`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((res) => {
      if (res.isConfirmed) {
        this.http.delete(`/api/sales/packages/${pkg.id}`, { headers: this.getHeaders() }).subscribe({
          next: () => {
            Swal.fire('Listo', 'Paquete eliminado', 'success');
            this.loadPackages();
          },
          error: (err) => Swal.fire('Error', err.error?.message || 'Error al eliminar', 'error')
        });
      }
    });
  }

  applyPackageToQuote(pkg: any) {
    if (!pkg || !pkg.items || pkg.items.length === 0) {
      // Add as a single line item
      this.currentQuote.items.push({
        serviceId: null,
        concept: pkg.name,
        description: pkg.name,
        quantity: 1,
        unitPriceUSD: Number(pkg.totalPriceUSD || 0),
        discountPercent: 0,
        totalUSD: Number(pkg.totalPriceUSD || 0)
      });
    } else {
      // Add all individual items from the package template so user can customize/modify prices individually
      for (const item of pkg.items) {
        const uPrice = Number(item.unitPriceUSD || 0);
        const qty = Number(item.quantity || 1);
        this.currentQuote.items.push({
          serviceId: null,
          concept: item.concept,
          description: item.concept,
          quantity: qty,
          unitPriceUSD: uPrice,
          discountPercent: 0,
          totalUSD: qty * uPrice
        });
      }
    }
    Swal.fire({
      icon: 'success',
      title: 'Plantilla cargada',
      text: `Se cargaron los ítems del combo "${pkg.name}". Puede modificar los precios unitarios manualmente si lo desea.`,
      timer: 2000,
      showConfirmButton: false
    });
  }

  // --- QUOTE BUILDER ---
  openCreateQuoteModal() {
    const today = new Date();
    const expiry = new Date();
    expiry.setDate(today.getDate() + 15);

    this.currentQuote = {
      patientId: null,
      patientName: '',
      patientDocumentId: '',
      patientPhone: '',
      patientEmail: '',
      insuranceCompanyId: null,
      title: 'Presupuesto de Servicios Clínicos',
      currency: 'USD',
      exchangeRateBCV: this.currencyService.rate || 36.50,
      bcvRate: this.currencyService.rate || 36.50,
      discountAmount: 0,
      notes: 'Presupuesto emitido a solicitud del paciente. Válido por 15 días continuos. Servicios médicos exentos de IVA según Art. 18 Ley IVA (Venezuela).',
      validUntil: expiry.toISOString().split('T')[0],
      items: []
    };
    this.showQuoteModal = true;
  }

  closeQuoteModal() {
    this.showQuoteModal = false;
  }

  onPatientSelect(patientId: any) {
    const patient = this.patients().find(p => p.id == patientId);
    if (patient) {
      const user = patient.User || {};
      const fullName = `${patient.firstName || user.firstName || ''} ${patient.lastName || user.lastName || ''}`.trim() || patient.name || '';
      this.currentQuote.patientId = patient.id;
      this.currentQuote.patientName = fullName;
      this.currentQuote.patientDocumentId = patient.documentNumber || patient.documentId || patient.idCard || patient.medicalRecordNumber || '';
      this.currentQuote.patientPhone = patient.phone || user.phone || '';
      this.currentQuote.patientEmail = patient.email || user.email || '';
      if (patient.insuranceCompanyId) {
        this.currentQuote.insuranceCompanyId = patient.insuranceCompanyId;
      }
    }
  }

  onServiceSelectInQuote(serviceId: any) {
    const srv = this.services().find(s => s.id == serviceId);
    if (srv) {
      this.quoteItemTemp.concept = srv.name;
      this.quoteItemTemp.description = srv.name;
      this.quoteItemTemp.unitPriceUSD = Number(srv.priceUSD);
    }
  }

  addQuoteItem() {
    const concept = this.quoteItemTemp.concept || this.quoteItemTemp.description;
    if (!concept || this.quoteItemTemp.unitPriceUSD < 0) {
      Swal.fire('Atención', 'Seleccione un servicio o ingrese concepto y precio unitario', 'warning');
      return;
    }

    const qty = Number(this.quoteItemTemp.quantity || 1);
    const uPrice = Number(this.quoteItemTemp.unitPriceUSD || 0);
    const disc = Number(this.quoteItemTemp.discountPercent || 0);
    const total = qty * uPrice * (1 - disc / 100);

    this.currentQuote.items.push({
      serviceId: this.quoteItemTemp.serviceId || null,
      concept: concept,
      description: concept,
      quantity: qty,
      unitPriceUSD: uPrice,
      discountPercent: disc,
      totalUSD: total
    });

    this.quoteItemTemp = {
      serviceId: null,
      concept: '',
      description: '',
      quantity: 1,
      unitPriceUSD: 0,
      discountPercent: 0
    };
  }

  updateItemSubtotal(item: any) {
    const qty = Number(item.quantity || 1);
    const uPrice = Number(item.unitPriceUSD || 0);
    const disc = Number(item.discountPercent || 0);
    item.totalUSD = qty * uPrice * (1 - disc / 100);
  }

  removeQuoteItem(index: number) {
    this.currentQuote.items.splice(index, 1);
  }

  getQuoteSubtotalUSD(): number {
    return this.currentQuote.items.reduce((acc: number, item: any) => {
      const qty = Number(item.quantity || 1);
      const uPrice = Number(item.unitPriceUSD || 0);
      const disc = Number(item.discountPercent || 0);
      return acc + (qty * uPrice * (1 - disc / 100));
    }, 0);
  }

  getQuoteTotalUSD(): number {
    const sub = this.getQuoteSubtotalUSD();
    const discount = Number(this.currentQuote.discountAmount || 0);
    return Math.max(0, sub - discount);
  }

  getQuoteTotalVES(): number {
    const totalUSD = this.getQuoteTotalUSD();
    const rate = Number(this.currentQuote.bcvRate || this.currentQuote.exchangeRateBCV) || 36.50;
    return totalUSD * rate;
  }

  saveQuote() {
    if (!this.currentQuote.patientName) {
      Swal.fire('Validación', 'El nombre del paciente es requerido', 'warning');
      return;
    }
    if (this.currentQuote.items.length === 0) {
      Swal.fire('Validación', 'Debe agregar al menos un ítem al presupuesto', 'warning');
      return;
    }

    const payload = {
      patientId: this.currentQuote.patientId || null,
      patientName: this.currentQuote.patientName,
      patientDocumentId: this.currentQuote.patientDocumentId,
      patientPhone: this.currentQuote.patientPhone,
      patientEmail: this.currentQuote.patientEmail,
      insuranceCompanyId: this.currentQuote.insuranceCompanyId || null,
      title: this.currentQuote.title || 'Presupuesto de Servicios Clínicos',
      bcvRate: Number(this.currentQuote.bcvRate || this.currentQuote.exchangeRateBCV || 36.50),
      notes: this.currentQuote.notes,
      items: this.currentQuote.items.map((it: any) => ({
        serviceId: it.serviceId || null,
        concept: it.concept || it.description,
        quantity: Number(it.quantity || 1),
        unitPriceUSD: Number(it.unitPriceUSD || 0),
        discountPercent: Number(it.discountPercent || 0)
      }))
    };

    this.http.post('/api/sales/quotes', payload, { headers: this.getHeaders() }).subscribe({
      next: () => {
        Swal.fire('Éxito', 'Presupuesto generado correctamente', 'success');
        this.closeQuoteModal();
        this.loadQuotes();
      },
      error: (err) => Swal.fire('Error', err.error?.message || 'Error al generar presupuesto', 'error')
    });
  }

  viewQuoteDetails(quote: any) {
    this.http.get<any>(`/api/sales/quotes?id=${quote.id}`, { headers: this.getHeaders() }).subscribe({
      next: (quotesList) => {
        const found = Array.isArray(quotesList) ? quotesList.find(q => q.id === quote.id) : quotesList;
        this.viewingQuote = found || quote;
        this.showQuoteDetailModal = true;
      },
      error: () => {
        this.viewingQuote = quote;
        this.showQuoteDetailModal = true;
      }
    });
  }

  closeQuoteDetailModal() {
    this.showQuoteDetailModal = false;
    this.viewingQuote = null;
  }

  updateQuoteStatus(quote: any, newStatus: string) {
    this.http.patch(`/api/sales/quotes/${quote.id}/status`, { status: newStatus }, { headers: this.getHeaders() }).subscribe({
      next: () => {
        Swal.fire('Actualizado', `Estado cambiado a: ${newStatus}`, 'success');
        if (this.viewingQuote) this.viewingQuote.status = newStatus;
        quote.status = newStatus;
        this.loadQuotes();
      },
      error: (err) => Swal.fire('Error', err.error?.message || 'Error al cambiar estado', 'error')
    });
  }

  deleteQuote(quote: any) {
    Swal.fire({
      title: '¿Eliminar presupuesto?',
      text: `Se eliminará el presupuesto "${quote.quoteNumber}"`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((res) => {
      if (res.isConfirmed) {
        this.http.delete(`/api/sales/quotes/${quote.id}`, { headers: this.getHeaders() }).subscribe({
          next: () => {
            Swal.fire('Listo', 'Presupuesto eliminado', 'success');
            this.loadQuotes();
          },
          error: (err) => Swal.fire('Error', err.error?.message || 'Error al eliminar', 'error')
        });
      }
    });
  }

  printQuote() {
    window.print();
  }
}
