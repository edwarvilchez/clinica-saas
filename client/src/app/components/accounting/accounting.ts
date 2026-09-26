import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { LanguageService } from '../../services/language.service';
import { CurrencyService } from '../../services/currency.service';
import { RouterModule } from '@angular/router';
import { TranslatePipe } from '../../services/translate.pipe';
import Swal from 'sweetalert2';

// Accounting VEN-NIF component
@Component({
  selector: 'app-accounting',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TranslatePipe],
  templateUrl: './accounting.html',
  styleUrls: ['./accounting.css']
})
export class AccountingComponent implements OnInit {
  private http = inject(HttpClient);
  public langService = inject(LanguageService);
  public currencyService = inject(CurrencyService);

  activeTab = signal<'journal' | 'chart' | 'trial' | 'retentions'>('journal');
  viewMode = signal<'list' | 'kanban'>('list');
  loading = signal<boolean>(true);

  accounts = signal<any[]>([]);
  journalEntries = signal<any[]>([]);
  trialBalance = signal<any[]>([]);
  retentions = signal<any[]>([]);

  standardEntries = computed(() => {
    return this.journalEntries().filter(e => parseFloat(e.totalDebitUSD || 0) < 500);
  });

  highValueEntries = computed(() => {
    return this.journalEntries().filter(e => parseFloat(e.totalDebitUSD || 0) >= 500);
  });

  totalJournalUSD = computed(() => {
    return this.journalEntries().reduce((sum, e) => sum + parseFloat(e.totalDebitUSD || 0), 0);
  });

  // Modal Asiento Contable
  showEntryModal = false;
  entryConcept = '';
  entryDate = new Date().toISOString().split('T')[0];
  entryItems: any[] = [
    { accountId: '', debitUSD: 0, creditUSD: 0, description: '' },
    { accountId: '', debitUSD: 0, creditUSD: 0, description: '' }
  ];

  totalDebitUSD = computed(() => {
    return this.entryItems.reduce((sum, item) => sum + parseFloat(item.debitUSD || 0), 0);
  });

  totalCreditUSD = computed(() => {
    return this.entryItems.reduce((sum, item) => sum + parseFloat(item.creditUSD || 0), 0);
  });

  isBalanced = computed(() => {
    return Math.abs(this.totalDebitUSD() - this.totalCreditUSD()) < 0.01 && this.totalDebitUSD() > 0;
  });

  ngOnInit() {
    this.loadAllAccountingData();
  }

  loadAllAccountingData() {
    this.loading.set(true);
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    this.http.get<any[]>('/api/accounting/accounts', { headers }).subscribe(acc => this.accounts.set(acc));
    this.http.get<any[]>('/api/accounting/journal-entries', { headers }).subscribe(entries => this.journalEntries.set(entries));
    this.http.get<any[]>('/api/accounting/trial-balance', { headers }).subscribe(tb => this.trialBalance.set(tb));
    this.http.get<any[]>('/api/accounting/retentions', { headers }).subscribe({
      next: (ret) => {
        this.retentions.set(ret);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  openEntryModal() {
    this.entryConcept = '';
    this.entryDate = new Date().toISOString().split('T')[0];
    this.entryItems = [
      { accountId: this.accounts()[0]?.id || '', debitUSD: 0, creditUSD: 0, description: '' },
      { accountId: this.accounts()[1]?.id || '', debitUSD: 0, creditUSD: 0, description: '' }
    ];
    this.showEntryModal = true;
  }

  addItemRow() {
    this.entryItems.push({ accountId: this.accounts()[0]?.id || '', debitUSD: 0, creditUSD: 0, description: '' });
  }

  removeItemRow(index: number) {
    if (this.entryItems.length > 2) {
      this.entryItems.splice(index, 1);
    }
  }

  saveJournalEntry() {
    if (!this.entryConcept) {
      Swal.fire('Atención', 'El concepto del asiento es requerido', 'warning');
      return;
    }

    if (!this.isBalanced()) {
      Swal.fire('Asiento Descuadrado', 'El total Debe debe ser igual al total Haber', 'error');
      return;
    }

    const token = localStorage.getItem('token');
    const payload = {
      entryDate: this.entryDate,
      concept: this.entryConcept,
      bcvRate: this.currencyService.rate,
      items: this.entryItems
    };

    this.http.post('/api/accounting/journal-entries', payload, {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe({
      next: () => {
        Swal.fire('Éxito', 'Asiento contable registrado en el Libro Diario', 'success');
        this.showEntryModal = false;
        this.loadAllAccountingData();
      },
      error: (err) => Swal.fire('Error', err.error?.message || 'Error al guardar asiento', 'error')
    });
  }
}
