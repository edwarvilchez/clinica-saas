import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { LanguageService } from '../../services/language.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { CurrencyService } from '../../services/currency.service';
import { AuthService } from '../../services/auth.service';
import { ExportService } from '../../services/export.service';
import { API_URL, BASE_URL } from '../../api-config';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-payments',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, TranslatePipe],
  templateUrl: './payments.html',
  styleUrl: './payments.css',
})
export class Payments implements OnInit {
  payments = signal<any[]>([]);
  searchTerm = signal('');

  updateSearch(event: any) {
    this.searchTerm.set(event.target.value);
  }

  filteredPayments = computed(() => {
    const term = this.searchTerm().toLowerCase();
    return this.payments().filter(p => 
      (p.reference?.toLowerCase()?.includes(term) || false) || 
      (p.Patient?.User?.firstName?.toLowerCase()?.includes(term) || false) ||
      (p.Patient?.User?.lastName?.toLowerCase()?.includes(term) || false) ||
      (p.concept?.toLowerCase()?.includes(term) || false) ||
      (p.Appointment?.reason?.toLowerCase()?.includes(term) || false)
    );
  });

  pendingTotal = computed(() => {
    return this.payments()
      .filter(p => p.status === 'Pending')
      .reduce((acc, p) => acc + parseFloat(p.amount), 0);
  });

  paidTotal = computed(() => {
    return this.payments()
      .filter(p => p.status === 'Paid')
      .reduce((acc, p) => acc + parseFloat(p.amount), 0);
  });

  lastPayment = computed(() => {
    const sorted = [...this.payments()].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return sorted.length > 0 ? sorted[0] : null;
  });

  constructor(
    private http: HttpClient,
    public langService: LanguageService,
    public currencyService: CurrencyService,
    public authService: AuthService,
    private exportService: ExportService
  ) {}

  ngOnInit() {
    this.loadPayments();
  }

  getHeaders() {
    return new HttpHeaders({ 'Authorization': `Bearer ${localStorage.getItem('token')}` });
  }

  loadPayments() {
    this.http.get<any[]>(`${API_URL}/payments`, { headers: this.getHeaders() })
      .subscribe({
        next: data => {
          console.log('Payments loaded:', data);
          this.payments.set(data);
        },
        error: err => console.error('Error loading payments:', err)
      });
  }

  createNewPayment() {
    if (this.authService.hasRole(['PATIENT'])) {
      this.createPatientPayment();
    } else {
      this.createAdminPayment();
    }
  }

  createPatientPayment() {
    this.http.get<any>(`${API_URL}/appointments`, { headers: this.getHeaders() })
      .subscribe(response => {
        // Handle both direct array and paginated object
        const appointments = Array.isArray(response) ? response : (response.appointments || []);
        
        // Filtrar citas pendientes o confirmadas que no estén canceladas/completadas
        const validAppointments = appointments.filter((a: any) => a.status !== 'Cancelled' && a.status !== 'Completed');
        
        let appointmentOptions = `<option value="">${this.langService.translate('payments.select')}</option>`;
        if (validAppointments.length > 0) {
            appointmentOptions += validAppointments.map((a: any) => 
                `<option value="${a.id}">${new Date(a.date).toLocaleDateString()} - Dr. ${a.Doctor?.User?.lastName || 'Medico'} (${a.reason})</option>`
            ).join('');
        } else {
            appointmentOptions = `<option value="" disabled>${this.langService.translate('common.noResults')}</option>`;
        }

        Swal.fire({
          title: this.langService.translate('payments.registerTitle'),
          html: `
            <div class="text-start">
              <div class="mb-3">
                <label class="form-label small fw-bold mb-1">${this.langService.translate('payments.selectAppointment')}</label>
                <select id="apptId" class="form-select form-select-sm">
                  ${appointmentOptions}
                </select>
              </div>

              <div class="mb-3">
                <label class="form-label small fw-bold mb-1">${this.langService.translate('payments.method')}</label>
                <select id="method" class="form-select form-select-sm" onchange="const d=document.getElementById('details'); if(this.value==='Efectivo'){d.classList.add('d-none');} else {d.classList.remove('d-none');}">
                    <option value="">${this.langService.translate('payments.select')}</option>
                    <option value="Transferencia">${this.langService.translate('sidebar.transfer')}</option>
                    <option value="Pago Móvil">${this.langService.translate('sidebar.mobile')}</option>
                    <option value="Efectivo">${this.langService.translate('sidebar.cash')}</option>
                    <option value="Zelle">Zelle</option>
                </select>
              </div>

          <div id="details" class="d-none">
            <div class="mb-3">
                <label class="form-label small fw-bold mb-1">${this.langService.translate('payments.bankPlatform')}</label>
                <input id="bank" class="form-control form-control-sm" placeholder="${this.langService.translate('payments.bankPlatformPlaceholder')}">
            </div>
            
            <div class="row g-2 mb-3">
                <div class="col-6">
                    <label class="form-label small fw-bold mb-1">${this.langService.translate('payments.payCurrency')}</label>
                    <select id="payCurrency" class="form-select form-select-sm">
                        <option value="USD">USD ($)</option>
                        <option value="VES">VES (Bs.)</option>
                    </select>
                </div>
                <div class="col-6">
                    <label class="form-label small fw-bold mb-1">${this.langService.translate('payments.amount')}</label>
                    <input id="amount" type="number" class="form-control form-control-sm" placeholder="0.00">
                </div>
            </div>

            <div class="row g-2 mb-3">
                <div class="col-12">
                    <label class="form-label small fw-bold mb-1">${this.langService.translate('payments.reference')}</label>
                    <input id="ref" class="form-control form-control-sm" placeholder="${this.langService.translate('payments.refPlaceholder')}">
                </div>
            </div>

             <div class="mb-3">
                <label class="form-label small fw-bold mb-1">${this.langService.translate('payments.payDate')}</label>
                <input id="date" type="date" class="form-control form-control-sm" value="${new Date().toISOString().split('T')[0]}">
            </div>
            <div class="mb-3">
                <label class="form-label small fw-bold mb-1">${this.langService.translate('payments.attachReceipt')}</label>
                <input id="receiptFile" type="file" class="form-control form-control-sm" accept="image/*,application/pdf">
            </div>
          </div>
        </div>
      `,
          showCancelButton: true,
          confirmButtonText: this.langService.translate('payments.newPayment'),
          cancelButtonText: this.langService.translate('common.cancel'),
          preConfirm: () => {
            const appointmentId = (document.getElementById('apptId') as HTMLSelectElement).value;
            const apptSelect = document.getElementById('apptId') as HTMLSelectElement;
            const apptText = apptSelect.options[apptSelect.selectedIndex].text;
            const method = (document.getElementById('method') as HTMLSelectElement).value;
            const bank = (document.getElementById('bank') as HTMLInputElement).value;
            const reference = (document.getElementById('ref') as HTMLInputElement).value;
            const rawAmount = parseFloat((document.getElementById('amount') as HTMLInputElement).value);
            const selectedCurr = (document.getElementById('payCurrency') as HTMLSelectElement).value;
            const date = (document.getElementById('date') as HTMLInputElement).value;
            const fileInput = document.getElementById('receiptFile') as HTMLInputElement;
            const file = fileInput?.files ? fileInput.files[0] : null;

            if (!appointmentId) {
                Swal.showValidationMessage('Debe seleccionar una cita');
                return false;
            }
            if (!method) {
                Swal.showValidationMessage('Debe seleccionar un método de pago');
                return false;
            }

            const formData = new FormData();
            formData.append('appointmentId', appointmentId);
            formData.append('instrument', method);
            formData.append('currency', selectedCurr);
            formData.append('status', 'Pending');

            if (method === 'Efectivo') {
                formData.append('concept', 'Pago en Consultorio (Efectivo)');
                formData.append('amount', '0');
                formData.append('method', 'Cash');
            } else {
                if (!bank) {
                    Swal.showValidationMessage('Debe indicar el Banco o Plataforma del pago');
                    return false;
                }
                if (!reference) {
                    Swal.showValidationMessage('Debe indicar el número de referencia');
                    return false;
                }
                if (!rawAmount || rawAmount <= 0) {
                    Swal.showValidationMessage('Debe indicar un monto válido mayor a 0');
                    return false;
                }

                // Convert to base currency (USD) for storage consistency
                const finalAmount = selectedCurr === 'VES' ? (rawAmount / this.currencyService.rate()) : rawAmount;

                formData.append('bank', bank);
                formData.append('reference', reference);
                formData.append('amount', finalAmount.toString());
                formData.append('concept', `Pago Cita: ${apptText} (${rawAmount} ${selectedCurr})`);
                formData.append('createdAt', date ? new Date(date).toISOString() : new Date().toISOString());
                if (file) {
                    formData.append('receipt', file);
                }
            }

            return formData;
          }
        }).then((result) => {
            if (result.isConfirmed) {
                const data = result.value;
                if (data.get('instrument') === 'Efectivo') {
                    Swal.fire({
                        title: 'Pago en Efectivo',
                        text: 'Recuerde realizar su pago al llegar al consultorio para ser atendido.',
                        icon: 'info',
                        confirmButtonText: 'Entendido'
                    }).then(() => {
                        this.submitPayment(data);
                    });
                } else {
                    this.submitPayment(data);
                }
            }
        });
      });
  }

  submitPayment(data: any) {
    this.http.post(`${API_URL}/payments`, data, { headers: this.getHeaders() })
      .subscribe({
        next: () => {
          this.loadPayments();
          Swal.fire('Registrado', 'Su pago ha sido registrado y está en proceso de verificación.', 'success');
        },
        error: (err) => {
          const msg = err.error?.message || err.error?.error || 'Error registrando pago';
          Swal.fire('Error', msg, 'error');
        }
      });
  }

  updatePayment(id: string, data: any) {
    this.http.put(`${API_URL}/payments/${id}`, data, { headers: this.getHeaders() })
      .subscribe({
        next: () => {
          this.loadPayments();
          Swal.fire(this.langService.translate('payments.updated'), this.langService.translate('payments.updatedMsg'), 'success');
        },
        error: (err) => {
          const msg = err.error?.message || err.error?.error || 'Error actualizando pago';
          Swal.fire('Error', msg, 'error');
        }
      });
  }

  deletePayment(id: string) {
    Swal.fire({
      title: this.langService.translate('payments.confirmDelete'),
      text: this.langService.translate('payments.confirmDeleteText'),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: this.langService.translate('payments.yesDelete'),
      cancelButtonText: this.langService.translate('common.cancel'),
      confirmButtonColor: '#ef4444'
    }).then((result) => {
      if (result.isConfirmed) {
        this.http.delete(`${API_URL}/payments/${id}`, { headers: this.getHeaders() })
          .subscribe({
            next: () => {
              this.loadPayments();
              Swal.fire(this.langService.translate('payments.deleted'), this.langService.translate('payments.deletedMsg'), 'success');
            },
            error: (err) => {
              Swal.fire('Error', err.error?.message || 'Error eliminando pago', 'error');
            }
          });
      }
    });
  }

  editPatientPayment(payment: any) {
    this.http.get<any>(`${API_URL}/appointments`, { headers: this.getHeaders() })
      .subscribe(response => {
        const appointments = Array.isArray(response) ? response : (response.appointments || []);
        const validAppointments = appointments.filter((a: any) => a.status !== 'Cancelled' && a.status !== 'Completed');
        const appointmentOptions = validAppointments.map((a: any) => 
            `<option value="${a.id}" ${a.id === payment.appointmentId ? 'selected' : ''}>${new Date(a.date).toLocaleDateString()} - Dr. ${a.Doctor?.User?.lastName || 'Medico'} (${a.reason})</option>`
        ).join('');

        Swal.fire({
          title: this.langService.translate('payments.editTitle'),
          html: `
            <div class="text-start">
              <div class="mb-3">
                <label class="form-label small fw-bold mb-1">${this.langService.translate('payments.selectAppointment')}</label>
                <select id="apptId" class="form-select form-select-sm">
                  ${appointmentOptions}
                </select>
              </div>

              <div class="mb-3">
                <label class="form-label small fw-bold mb-1">${this.langService.translate('payments.method')}</label>
                <select id="method" class="form-select form-select-sm">
                    <option value="Transferencia" ${payment.instrument === 'Transferencia' ? 'selected' : ''}>${this.langService.translate('sidebar.transfer')}</option>
                    <option value="Pago Móvil" ${payment.instrument === 'Pago Móvil' ? 'selected' : ''}>${this.langService.translate('sidebar.mobile')}</option>
                    <option value="Zelle" ${payment.instrument === 'Zelle' ? 'selected' : ''}>Zelle</option>
                </select>
              </div>

              <div id="details">
                <div class="mb-3">
                    <label class="form-label small fw-bold mb-1">${this.langService.translate('payments.bankPlatform')}</label>
                    <input id="bank" class="form-control form-control-sm" value="${payment.bank || ''}" placeholder="${this.langService.translate('payments.bankPlatformPlaceholder')}">
                </div>
                
                <div class="row g-2 mb-3">
                    <div class="col-6">
                        <label class="form-label small fw-bold mb-1">${this.langService.translate('payments.payCurrency')}</label>
                        <select id="payCurrency" class="form-select form-select-sm">
                            <option value="USD" ${payment.concept.includes('USD') ? 'selected' : ''}>USD ($)</option>
                            <option value="VES" ${payment.concept.includes('VES') ? 'selected' : ''}>VES (Bs.)</option>
                        </select>
                    </div>
                    <div class="col-6">
                        <label class="form-label small fw-bold mb-1">${this.langService.translate('payments.amount')}</label>
                        <input id="amount" type="number" class="form-control form-control-sm" value="${payment.amount}" placeholder="0.00">
                    </div>
                </div>

                <div class="row g-2 mb-3">
                    <div class="col-12">
                        <label class="form-label small fw-bold mb-1">${this.langService.translate('payments.reference')}</label>
                        <input id="ref" class="form-control form-control-sm" value="${payment.reference || ''}" placeholder="${this.langService.translate('payments.refPlaceholder')}">
                    </div>
                </div>

                 <div class="mb-3">
                    <label class="form-label small fw-bold mb-1">${this.langService.translate('payments.payDate')}</label>
                    <input id="date" type="date" class="form-control form-control-sm" value="${new Date(payment.createdAt).toISOString().split('T')[0]}">
                </div>
                <div class="mb-3">
                    <label class="form-label small fw-bold mb-1">${this.langService.translate('payments.updateReceipt')}</label>
                    <input id="receiptFile" type="file" class="form-control form-control-sm" accept="image/*,application/pdf">
                    ${payment.receiptUrl ? `<div class="x-small text-muted mt-1">${this.langService.translate('payments.hasAttachment')}</div>` : ''}
                </div>
              </div>
            </div>
          `,
          showCancelButton: true,
          confirmButtonText: this.langService.translate('payments.saveChanges'),
          cancelButtonText: this.langService.translate('common.cancel'),
          preConfirm: () => {
            const appointmentId = (document.getElementById('apptId') as HTMLSelectElement).value;
            const apptSelect = document.getElementById('apptId') as HTMLSelectElement;
            const apptText = apptSelect.options[apptSelect.selectedIndex].text;
            const method = (document.getElementById('method') as HTMLSelectElement).value;
            const bank = (document.getElementById('bank') as HTMLInputElement).value;
            const reference = (document.getElementById('ref') as HTMLInputElement).value;
            const rawAmount = parseFloat((document.getElementById('amount') as HTMLInputElement).value);
            const selectedCurr = (document.getElementById('payCurrency') as HTMLSelectElement).value;
            const date = (document.getElementById('date') as HTMLInputElement).value;
            const fileInput = document.getElementById('receiptFile') as HTMLInputElement;
            const file = fileInput?.files ? fileInput.files[0] : null;

            if (!bank) { Swal.showValidationMessage('Indique el Banco'); return false; }
            if (!reference) { Swal.showValidationMessage('Indique la Referencia'); return false; }
            if (!rawAmount || rawAmount <= 0) { Swal.showValidationMessage('Monto no válido'); return false; }

            const formData = new FormData();
            formData.append('appointmentId', appointmentId);
            formData.append('instrument', method);
            formData.append('currency', selectedCurr);
            
            const finalAmount = selectedCurr === 'VES' ? (rawAmount / this.currencyService.rate()) : rawAmount;
            formData.append('bank', bank);
            formData.append('reference', reference);
            formData.append('amount', finalAmount.toString());
            formData.append('concept', `Pago Cita: ${apptText} (${rawAmount} ${selectedCurr})`);
            formData.append('createdAt', date ? new Date(date).toISOString() : new Date().toISOString());
            if (file) formData.append('receipt', file);

            return formData;
          }
        }).then((result) => {
            if (result.isConfirmed) {
                this.updatePayment(payment.id, result.value);
            }
        });
      });
  }

  createAdminPayment() {
    this.http.get<any>(`${API_URL}/patients`, { headers: this.getHeaders() })
      .subscribe(response => {
        const patients = Array.isArray(response) ? response : (response.patients || []);
        const patientOptions = patients.map((p: any) => 
          `<option value="${p.id}">${p.User.firstName} ${p.User.lastName} (${p.documentId || 'N/A'})</option>`
        ).join('');

        Swal.fire({
          title: this.langService.translate('payments.newPayment'),
          html: `
            <div class="text-start">
              <div class="mb-3">
                <label class="form-label small fw-bold mb-1">${this.langService.translate('payments.patient')}</label>
                <select id="patientId" class="form-select form-select-sm">
                  ${patientOptions}
                </select>
              </div>
              <div class="mb-3">
                <label class="form-label small fw-bold mb-1">${this.langService.translate('payments.concept')}</label>
                <input id="concept" class="form-control form-control-sm" placeholder="${this.langService.translate('common.search')}">
              </div>
              
              <div class="row g-2 mb-3">
                <div class="col-md-6">
                  <label class="form-label small fw-bold mb-1">${this.langService.translate('sidebar.instrument')}</label>
                  <select id="instrument" class="form-select form-select-sm" onchange="const b = document.getElementById('bankGrp'); const r = document.getElementById('refGrp'); if(this.value === 'Efectivo'){ b.classList.add('d-none'); r.classList.add('d-none'); } else { b.classList.remove('d-none'); r.classList.remove('d-none'); }">
                    <option value="Efectivo">${this.langService.translate('sidebar.cash')}</option>
                    <option value="Transferencia">${this.langService.translate('sidebar.transfer')}</option>
                    <option value="Pago Móvil">${this.langService.translate('sidebar.mobile')}</option>
                    <option value="Débito">${this.langService.translate('sidebar.debit')}</option>
                    <option value="Crédito">${this.langService.translate('sidebar.credit')}</option>
                  </select>
                </div>
                <div class="col-md-6">
                  <label class="form-label small fw-bold mb-1">${this.langService.translate('sidebar.currency')}</label>
                  <select id="payCurrency" class="form-select form-select-sm">
                    <option value="USD">USD ($)</option>
                    <option value="VES">VES (Bs.)</option>
                  </select>
                </div>
              </div>

              <div class="mb-3 d-none" id="bankGrp">
                <label class="form-label small fw-bold mb-1">${this.langService.translate('sidebar.bank')}</label>
                <input id="bank" class="form-control form-control-sm" placeholder="Ej: Banesco, Mercantil...">
              </div>

              <div class="row g-2">
                <div class="col-md-6">
                  <label class="form-label small fw-bold mb-1">${this.langService.translate('payments.amount')}</label>
                  <input id="amount" type="number" class="form-control form-control-sm" placeholder="0.00">
                </div>
                <div class="col-md-6 d-none" id="refGrp">
                  <label class="form-label small fw-bold mb-1">${this.langService.translate('payments.reference')}</label>
                  <input id="reference" class="form-control form-control-sm" placeholder="REF-XXXXX">
                </div>
              </div>

              <div class="mt-3">
                <div class="form-check form-switch">
                  <input class="form-check-input" type="checkbox" id="markAsPaid">
                  <label class="form-check-label small" for="markAsPaid">${this.langService.translate('payments.paid')}</label>
                </div>
              </div>
            </div>
          `,
          showCancelButton: true,
          confirmButtonText: this.langService.translate('payments.newPayment'),
          cancelButtonText: this.langService.translate('common.cancel'),
          confirmButtonColor: '#10b981',
          cancelButtonColor: '#64748b',
          preConfirm: () => {
            const patientId = (document.getElementById('patientId') as HTMLSelectElement).value;
            const concept = (document.getElementById('concept') as HTMLInputElement).value;
            const amount = (document.getElementById('amount') as HTMLInputElement).value;
            const reference = (document.getElementById('reference') as HTMLInputElement).value;
            const instrument = (document.getElementById('instrument') as HTMLSelectElement).value;
            const bank = (document.getElementById('bank') as HTMLInputElement).value;
            const currency = (document.getElementById('payCurrency') as HTMLSelectElement).value;
            const isPaid = (document.getElementById('markAsPaid') as HTMLInputElement).checked;

            if (!patientId || !concept || !amount) {
              Swal.showValidationMessage(this.langService.translate('common.error'));
              return false;
            }

            let finalAmount = parseFloat(amount);
            if (currency === 'VES') {
                finalAmount = finalAmount / this.currencyService.rate();
            }

            return { 
                patientId, 
                concept, 
                amount: finalAmount, 
                reference, 
                instrument, 
                bank,
                currency,
                status: isPaid ? 'Paid' : 'Pending' 
            };
          }
        }).then(result => {
          if (result.isConfirmed) {
            this.submitPayment(result.value);
          }
        });
      });
  }

  collectPayment(id: string) {
    Swal.fire({
      title: '¿Confirmar cobro?',
      text: "El estado del pago cambiará a 'Pagado'.",
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#22c55e',
      confirmButtonText: 'Sí, cobrar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.http.post(`${API_URL}/payments/collect/${id}`, {}, { headers: this.getHeaders() })
          .subscribe(() => {
            this.loadPayments();
            Swal.fire('¡Éxito!', 'Pago cobrado correctamente.', 'success');
          });
      }
    });
  }

  viewReceipt(payment: any) {
    Swal.fire({
      title: this.langService.translate('payments.receipt'),
      html: `
        <div class="text-start border p-3 rounded bg-light">
          <div class="d-flex justify-content-between mb-2">
            <strong>${this.langService.translate('payments.reference')}:</strong> <span>#${payment.reference || 'N/A'}</span>
          </div>
          <div class="d-flex justify-content-between mb-2">
            <strong>${this.langService.translate('payments.patient')}:</strong> <span>${payment.Patient?.User?.firstName} ${payment.Patient?.User?.lastName}</span>
          </div>
          ${payment.Appointment ? `
          <div class="mb-3 p-2 bg-light rounded-3 border-start border-primary border-3">
            <p class="x-small text-muted mb-1 text-uppercase fw-bold">Cita Asociada</p>
            <div class="small fw-bold">${new Date(payment.Appointment.date).toLocaleDateString()} - ${payment.Appointment.reason}</div>
            ${payment.Appointment.Doctor ? `<div class="x-small text-primary mt-1">Dr. ${payment.Appointment.Doctor.User.firstName} ${payment.Appointment.Doctor.User.lastName}</div>` : ''}
          </div>
          ` : ''}
          <div class="d-flex justify-content-between mb-2">
            <strong>${this.langService.translate('payments.concept')}:</strong> <span>${payment.concept}</span>
          </div>
          <div class="d-flex justify-content-between mb-2">
            <strong>${this.langService.translate('payments.amount')}:</strong> 
            <div class="text-end">
              <span class="fw-bold text-success d-block">${this.currencyService.formatAmount(payment.amount, 'USD')}</span>
              <span class="small text-muted">${this.currencyService.formatAmount(payment.amount, 'VES')}</span>
            </div>
          </div>
          <div class="d-flex justify-content-between mb-2">
            <strong>${this.langService.translate('payments.fecha')}:</strong> <span>${new Date(payment.createdAt).toLocaleDateString()}</span>
          </div>
          <div class="d-flex justify-content-between mb-2" *ngIf="payment.instrument">
            <strong>${this.langService.translate('sidebar.instrument')}:</strong> <span>${payment.instrument}</span>
          </div>
          <div class="d-flex justify-content-between mb-2" *ngIf="payment.bank">
            <strong>${this.langService.translate('sidebar.bank')}:</strong> <span>${payment.bank}</span>
          </div>
          <div class="d-flex justify-content-between">
            <strong>${this.langService.translate('common.status')}:</strong> 
            <span class="badge ${payment.status === 'Paid' ? 'bg-success' : 'bg-warning'} text-white">
              ${payment.status === 'Paid' ? this.langService.translate('payments.paid') : this.langService.translate('payments.pending')}
            </span>
          </div>
          ${payment.receiptUrl ? `
          <div class="mt-3 text-center border-top pt-3">
            <p class="small fw-bold mb-2">${this.langService.translate('payments.receipt')}</p>
            <a href="${BASE_URL}${payment.receiptUrl}" target="_blank" class="btn btn-sm btn-outline-primary rounded-pill w-100">
              <i class="bi bi-eye-fill me-1"></i> Ver Comprobante Adjunto
            </a>
          </div>` : ''}
        </div>
      `,
      confirmButtonText: this.langService.translate('common.cancel'),
      confirmButtonColor: '#10b981',
      showCancelButton: true,
      cancelButtonText: `<i class="bi bi-printer me-1"></i> ${this.langService.translate('common.printing')}`,
      cancelButtonColor: '#64748b'
    }).then(result => {
      if (result.dismiss === Swal.DismissReason.cancel) {
        window.print();
      }
    });
  }

  exportReport() {
    if (this.filteredPayments().length === 0) {
      Swal.fire('Atención', 'No hay datos para exportar', 'warning');
      return;
    }

    const headers = ['Referencia', 'Paciente', 'Concepto', 'Monto', 'Fecha', 'Estado'];
    const rows = this.filteredPayments().map(p => [
      p.reference || 'N/A',
      `${p.Patient?.User?.firstName} ${p.Patient?.User?.lastName}`,
      p.concept,
      p.amount,
      new Date(p.createdAt).toLocaleDateString(),
      p.status
    ]);

    Swal.fire({
      title: 'Exportar Reporte de Pagos',
      text: 'Seleccione el formato de descarga',
      icon: 'question',
      showDenyButton: true,
      showCancelButton: true,
      confirmButtonText: '<i class="bi bi-file-pdf"></i> PDF',
      denyButtonText: '<i class="bi bi-file-excel"></i> Excel',
      cancelButtonText: '<i class="bi bi-file-text"></i> CSV',
      confirmButtonColor: '#ef4444',
      denyButtonColor: '#22c55e',
      cancelButtonColor: '#64748b',
    }).then((result) => {
      const filename = `Reporte_Pagos_ClinicaSaaS_${new Date().toISOString().split('T')[0]}`;
      const title = 'Listado de Pagos - Clinica SaaS';
      const user = this.authService.currentUser();
      const branding = {
        name: user?.businessName || (user?.accountType === 'PROFESSIONAL' ? `${user.firstName} ${user.lastName}` : 'Clinica SaaS Platform'),
        professional: user ? `${user.firstName} ${user.lastName}` : undefined,
        tagline: this.langService.translate('payments.subtitle')
      };
      
      if (result.isConfirmed) {
        this.exportService.exportToPdf(filename, title, headers, rows, branding);
      } else if (result.isDenied) {
        this.exportService.exportToExcel(filename, headers, rows, branding);
      } else if (result.dismiss === Swal.DismissReason.cancel) {
        this.exportService.exportToCsv(filename, headers, rows);
      }
    });
  }
}
