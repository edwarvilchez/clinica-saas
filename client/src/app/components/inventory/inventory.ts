import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { LanguageService } from '../../services/language.service';
import { CurrencyService } from '../../services/currency.service';
import { API_URL } from '../../api-config';
import Swal from 'sweetalert2';

interface InventoryItemData {
  id: string;
  code: string;
  name: string;
  nameEn?: string;
  itemType: 'PRODUCT' | 'SERVICE' | 'MEDICATION' | 'SUPPLY';
  category: string;
  description?: string;
  unit: string;
  costUSD: number;
  priceUSD: number;
  stockCurrent: number;
  stockMin: number;
  batchNumber?: string;
  expiryDate?: string;
  location?: string;
  isTaxExempt: boolean;
  specialtyId?: number;
  doctorId?: string;
  doctorFeePercent: number;
  doctorFeeFixedUSD: number;
  requiresDoctor: boolean;
  isActive: boolean;
  Doctor?: any;
  Specialty?: any;
}

interface InventoryMovementData {
  id: string;
  itemId: string;
  movementType: 'ENTRY' | 'EXIT' | 'CLINICAL_CONSUMPTION' | 'ADJUSTMENT' | 'RETURN';
  quantity: number;
  unitCostUSD: number;
  unitPriceUSD: number;
  totalAmountUSD: number;
  bcvRate: number;
  patientId?: string;
  doctorId?: string;
  doctorFeeId?: string;
  documentRef?: string;
  reason?: string;
  movementDate: string;
  InventoryItem?: any;
  Patient?: any;
  Doctor?: any;
  DoctorFee?: any;
}

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './inventory.html',
  styleUrls: ['./inventory.css']
})
export class InventoryComponent implements OnInit {
  private http = inject(HttpClient);
  public langService = inject(LanguageService);
  public currencyService = inject(CurrencyService);

  items = signal<InventoryItemData[]>([]);
  movements = signal<InventoryMovementData[]>([]);
  doctors = signal<any[]>([]);
  specialties = signal<any[]>([]);
  patients = signal<any[]>([]);
  alerts = signal<any>({ lowStockCount: 0, expiringCount: 0, expiredCount: 0, lowStockItems: [], expiringItems: [], expiredItems: [] });
  loading = signal<boolean>(true);

  // Tabs: 'products', 'services', 'kardex', 'alerts'
  activeTab = signal<'products' | 'services' | 'kardex' | 'alerts'>('products');
  viewMode = signal<'list' | 'kanban'>('list');
  searchTerm = signal<string>('');
  categoryFilter = signal<string>('ALL');

  // Modals
  showItemModal = false;
  showMovementModal = false;
  isEditing = false;

  // Item Form
  currentItem: any = {
    code: '',
    name: '',
    nameEn: '',
    itemType: 'PRODUCT',
    category: 'MEDICINE',
    description: '',
    unit: 'UNIDAD',
    costUSD: 0,
    priceUSD: 0,
    stockCurrent: 0,
    stockMin: 5,
    batchNumber: '',
    expiryDate: '',
    location: 'Almacén General',
    isTaxExempt: true,
    specialtyId: '',
    doctorId: '',
    doctorFeePercent: 70,
    doctorFeeFixedUSD: 0,
    requiresDoctor: false
  };

  // Movement Form
  currentMovement: any = {
    itemId: '',
    movementType: 'CLINICAL_CONSUMPTION',
    quantity: 1,
    unitPriceUSD: 0,
    unitCostUSD: 0,
    patientId: '',
    doctorId: '',
    documentRef: '',
    reason: '',
    generateDoctorFee: true
  };

  // Computeds
  productItems = computed(() => {
    const term = this.searchTerm().toLowerCase();
    const cat = this.categoryFilter();
    return this.items().filter(it => {
      const isProduct = it.itemType !== 'SERVICE';
      const matchesSearch = it.code.toLowerCase().includes(term) || it.name.toLowerCase().includes(term) || (it.batchNumber || '').toLowerCase().includes(term);
      const matchesCat = cat === 'ALL' || it.category === cat;
      return isProduct && matchesSearch && matchesCat;
    });
  });

  serviceItems = computed(() => {
    const term = this.searchTerm().toLowerCase();
    return this.items().filter(it => {
      const isService = it.itemType === 'SERVICE';
      const docName = `${it.Doctor?.User?.firstName || ''} ${it.Doctor?.User?.lastName || ''}`.toLowerCase();
      const matchesSearch = it.code.toLowerCase().includes(term) || it.name.toLowerCase().includes(term) || docName.includes(term);
      return isService && matchesSearch;
    });
  });

  optimalProducts = computed(() => {
    return this.productItems().filter(it => it.stockCurrent > it.stockMin);
  });

  lowStockProducts = computed(() => {
    return this.productItems().filter(it => it.stockCurrent > 0 && it.stockCurrent <= it.stockMin);
  });

  outOfStockProducts = computed(() => {
    return this.productItems().filter(it => it.stockCurrent <= 0);
  });

  expiringProducts = computed(() => {
    const now = new Date();
    const in30Days = new Date();
    in30Days.setDate(now.getDate() + 30);
    return this.productItems().filter(it => {
      if (!it.expiryDate) return false;
      const exp = new Date(it.expiryDate);
      return exp <= in30Days;
    });
  });

  totalStockValuationUSD = computed(() => {
    return this.items()
      .filter(it => it.itemType !== 'SERVICE')
      .reduce((sum, it) => sum + (parseFloat(it.costUSD.toString() || '0') * parseFloat(it.stockCurrent.toString() || '0')), 0);
  });

  ngOnInit() {
    this.loadAllData();
  }

  getHeaders() {
    const token = localStorage.getItem('token');
    return { Authorization: `Bearer ${token}` };
  }

  loadAllData() {
    this.loading.set(true);
    const headers = this.getHeaders();

    this.http.get<InventoryItemData[]>(`${API_URL}/inventory/items`, { headers }).subscribe({
      next: (items) => {
        this.items.set(items || []);
        this.http.get<InventoryMovementData[]>(`${API_URL}/inventory/movements`, { headers }).subscribe({
          next: (movs) => this.movements.set(movs || [])
        });
        this.http.get<any>(`${API_URL}/inventory/alerts`, { headers }).subscribe({
          next: (al) => this.alerts.set(al || {})
        });
        this.loadCatalogs();
      },
      error: () => this.loading.set(false)
    });
  }

  loadCatalogs() {
    const headers = this.getHeaders();
    this.http.get<any[]>(`${API_URL}/doctors`, { headers }).subscribe(d => this.doctors.set(d || []));
    this.http.get<any[]>(`${API_URL}/specialties`, { headers }).subscribe(s => this.specialties.set(s || []));
    this.http.get<any[]>(`${API_URL}/patients`, { headers }).subscribe(p => {
      this.patients.set(p || []);
      this.loading.set(false);
    });
  }

  // Open Create Item
  openCreateItemModal(type: 'PRODUCT' | 'SERVICE') {
    this.isEditing = false;
    this.currentItem = {
      code: type === 'SERVICE' ? `SRV-${Date.now() % 10000}` : `MED-${Date.now() % 10000}`,
      name: '',
      nameEn: '',
      itemType: type,
      category: type === 'SERVICE' ? 'CONSULTATION' : 'MEDICINE',
      description: '',
      unit: type === 'SERVICE' ? 'SERVICIO' : 'UNIDAD',
      costUSD: 0,
      priceUSD: type === 'SERVICE' ? 50.00 : 10.00,
      stockCurrent: type === 'SERVICE' ? 999 : 20,
      stockMin: 5,
      batchNumber: '',
      expiryDate: '',
      location: type === 'SERVICE' ? 'Consultorios Médicos' : 'Farmacia Central',
      isTaxExempt: true,
      specialtyId: '',
      doctorId: '',
      doctorFeePercent: 70,
      doctorFeeFixedUSD: 0,
      requiresDoctor: type === 'SERVICE'
    };
    this.showItemModal = true;
  }

  openEditItemModal(item: InventoryItemData) {
    this.isEditing = true;
    this.currentItem = {
      id: item.id,
      code: item.code,
      name: item.name,
      nameEn: item.nameEn,
      itemType: item.itemType,
      category: item.category,
      description: item.description,
      unit: item.unit,
      costUSD: item.costUSD,
      priceUSD: item.priceUSD,
      stockCurrent: item.stockCurrent,
      stockMin: item.stockMin,
      batchNumber: item.batchNumber,
      expiryDate: item.expiryDate,
      location: item.location,
      isTaxExempt: item.isTaxExempt,
      specialtyId: item.specialtyId || '',
      doctorId: item.doctorId || '',
      doctorFeePercent: item.doctorFeePercent || 70,
      doctorFeeFixedUSD: item.doctorFeeFixedUSD || 0,
      requiresDoctor: item.requiresDoctor
    };
    this.showItemModal = true;
  }

  saveItem() {
    if (!this.currentItem.code || !this.currentItem.name) {
      Swal.fire('Atención', 'Código y nombre son obligatorios', 'warning');
      return;
    }

    const payload = {
      ...this.currentItem,
      specialtyId: this.currentItem.specialtyId ? parseInt(this.currentItem.specialtyId) : null,
      doctorId: this.currentItem.doctorId || null
    };

    const headers = this.getHeaders();
    if (this.isEditing) {
      this.http.put(`${API_URL}/inventory/items/${this.currentItem.id}`, payload, { headers }).subscribe({
        next: () => {
          this.showItemModal = false;
          this.loadAllData();
          Swal.fire('Actualizado', 'Ítem de inventario actualizado con éxito', 'success');
        },
        error: (err) => Swal.fire('Error', err.error?.message || 'Error al actualizar', 'error')
      });
    } else {
      this.http.post(`${API_URL}/inventory/items`, payload, { headers }).subscribe({
        next: () => {
          this.showItemModal = false;
          this.loadAllData();
          Swal.fire('Registrado', 'Nuevo ítem agregado al catálogo', 'success');
        },
        error: (err) => Swal.fire('Error', err.error?.message || 'Error al guardar', 'error')
      });
    }
  }

  deleteItem(item: InventoryItemData) {
    Swal.fire({
      title: '¿Eliminar ítem del inventario?',
      text: `${item.name} (${item.code})`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.http.delete(`${API_URL}/inventory/items/${item.id}`, { headers: this.getHeaders() }).subscribe({
          next: () => {
            this.loadAllData();
            Swal.fire('Eliminado', 'Ítem retirado del inventario', 'success');
          },
          error: (err) => Swal.fire('Error', err.error?.message || 'Error al eliminar', 'error')
        });
      }
    });
  }

  // Open Movement / Clinical Consumption Modal
  openMovementModal(item?: InventoryItemData) {
    const selectedItem = item || (this.items().length > 0 ? this.items()[0] : null);
    this.currentMovement = {
      itemId: selectedItem ? selectedItem.id : '',
      movementType: selectedItem?.itemType === 'SERVICE' ? 'CLINICAL_CONSUMPTION' : 'ENTRY',
      quantity: 1,
      unitPriceUSD: selectedItem ? selectedItem.priceUSD : 0,
      unitCostUSD: selectedItem ? selectedItem.costUSD : 0,
      patientId: this.patients().length > 0 ? this.patients()[0].id : '',
      doctorId: selectedItem?.doctorId || (this.doctors().length > 0 ? this.doctors()[0].id : ''),
      documentRef: `MOV-${Date.now() % 100000}`,
      reason: selectedItem?.itemType === 'SERVICE' ? 'Atención y procedimiento médico a paciente' : 'Ingreso de mercancía / factura de proveedor',
      generateDoctorFee: true
    };
    this.showMovementModal = true;
  }

  onMovementItemChange() {
    const it = this.items().find(i => i.id === this.currentMovement.itemId);
    if (it) {
      this.currentMovement.unitPriceUSD = it.priceUSD;
      this.currentMovement.unitCostUSD = it.costUSD;
      if (it.doctorId) {
        this.currentMovement.doctorId = it.doctorId;
      }
      if (it.itemType === 'SERVICE') {
        this.currentMovement.movementType = 'CLINICAL_CONSUMPTION';
      }
    }
  }

  saveMovement() {
    if (!this.currentMovement.itemId || !this.currentMovement.quantity || parseFloat(this.currentMovement.quantity) <= 0) {
      Swal.fire('Atención', 'Seleccione un ítem y cantidad válida', 'warning');
      return;
    }

    const payload = {
      ...this.currentMovement,
      bcvRate: this.currencyService.rate
    };

    this.http.post<any>(`${API_URL}/inventory/movements`, payload, { headers: this.getHeaders() }).subscribe({
      next: (res) => {
        this.showMovementModal = false;
        this.loadAllData();
        let extraMsg = '';
        if (res.doctorFee) {
          extraMsg = `<div class="alert alert-success p-2 small mt-2"><strong>Honorario Médico Generado en CXP:</strong> $${res.doctorFee.netPayableUSD} (Ret. ISLR: -$${res.doctorFee.retentionIslrUSD})</div>`;
        }
        Swal.fire({
          title: '¡Movimiento Registrado!',
          html: `<p>${res.message}</p>${extraMsg}`,
          icon: 'success',
          confirmButtonColor: '#10b981'
        });
      },
      error: (err) => Swal.fire('Error', err.error?.message || 'Error al procesar movimiento', 'error')
    });
  }

  formatDate(d?: string): string {
    if (!d) return 'N/A';
    const dt = new Date(d);
    return dt.toLocaleDateString('es-VE');
  }

  formatDateTime(d?: string): string {
    if (!d) return 'N/A';
    const dt = new Date(d);
    return dt.toLocaleString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
}
