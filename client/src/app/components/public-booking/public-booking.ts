import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import Swal from 'sweetalert2';
import { Subscription } from 'rxjs';
import { LanguageService } from '../../services/language.service';
import { API_URL, APP_VERSION } from '../../api-config';

@Component({
  selector: 'app-public-booking',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './public-booking.html',
  styleUrl: './public-booking.css',
})
export class PublicBooking implements OnInit, OnDestroy {
  bookingForm: FormGroup;
  version = APP_VERSION;
  doctors = signal<any[]>([]);
  timeSlots: string[] = [];
  loading = signal(false);
  step = signal(1);
  private formSub?: Subscription;
  private readonly STORAGE_KEY = 'ClinicaSaaS_booking_draft';

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private router: Router,
    public langService: LanguageService
  ) {
    this.bookingForm = this.fb.group({
      // Patient info
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.pattern(/^[0-9+\-\s()]+$/)]],
      documentId: ['', Validators.required],
      
      // Appointment info
      doctorId: ['', Validators.required],
      appointmentDate: ['', Validators.required],
      appointmentTime: ['', Validators.required],
      reason: ['', Validators.required],
      notes: ['']
    });
    
    this.generateTimeSlots();
  }

  ngOnInit() {
    this.loadDoctors();
    this.restoreDraft();
    
    this.formSub = this.bookingForm.valueChanges.subscribe(values => {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(values));
    });
  }

  ngOnDestroy() {
    if (this.formSub) {
      this.formSub.unsubscribe();
    }
  }

  restoreDraft() {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    if (saved) {
      try {
        const values = JSON.parse(saved);
        this.bookingForm.patchValue(values);
      } catch (e) {
        console.error('Error restoring booking draft:', e);
      }
    }
  }

  loadDoctors() {
    // Public endpoint - no auth required
    this.http.get<any[]>('http://localhost:5000/api/public/doctors')
      .subscribe({
        next: (data) => this.doctors.set(data),
        error: (err) => console.error('Error loading doctors:', err)
      });
  }

  generateTimeSlots() {
    const slots: string[] = [];
    for (let hour = 8; hour <= 18; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        if (hour === 18 && minute > 0) break;
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        slots.push(timeString);
      }
    }
    this.timeSlots = slots;
  }

  getMinDate(): string {
    const today = new Date();
    return today.toISOString().split('T')[0];
  }

  nextStep() {
    if (this.step() === 1) {
      // Validate personal info
      const personalFields = ['firstName', 'lastName', 'email', 'phone', 'documentId'];
      let valid = true;
      personalFields.forEach(field => {
        const control = this.bookingForm.get(field);
        if (control?.invalid) {
          control.markAsTouched();
          valid = false;
        }
      });
      if (valid) this.step.set(2);
    }
  }

  previousStep() {
    this.step.set(1);
  }

  onSubmit() {
    if (this.bookingForm.valid) {
      this.loading.set(true);
      const formValue = this.bookingForm.value;
      
      const combinedDateTime = `${formValue.appointmentDate}T${formValue.appointmentTime}:00`;
      
      const bookingData = {
        patientInfo: {
          firstName: formValue.firstName,
          lastName: formValue.lastName,
          email: formValue.email,
          phone: formValue.phone,
          documentId: formValue.documentId
        },
        appointmentInfo: {
          doctorId: formValue.doctorId,
          date: combinedDateTime,
          reason: formValue.reason,
          notes: formValue.notes
        }
      };

      this.http.post(`${API_URL}/public/appointments`, bookingData)
        .subscribe({
          next: (response: any) => {
            this.loading.set(false);
            
            const doctor = this.doctors().find(d => d.id === formValue.doctorId);
            const doctorName = doctor ? `${doctor.User.firstName} ${doctor.User.lastName}` : 'Doctor';
            
            // Generate WhatsApp and Calendar links
            const waLink = this.getWhatsAppLink(formValue, doctorName);
            const calendarLink = this.getGoogleCalendarLink(formValue, doctorName);
            
            Swal.fire({
              title: this.langService.translate('public_booking.success.title'),
              html: `
                <p class="mb-3">${this.langService.translate('public_booking.success.msg')}</p>
                <div class="alert alert-info">
                  <small>${this.langService.translate('public_booking.success.notification')}</small>
                </div>
                <div style="display: flex; gap: 10px; justify-content: center; margin-top: 20px;">
                  <a href="${waLink}" target="_blank" style="background-color: #25D366; color: white; padding: 10px 20px; border-radius: 5px; text-decoration: none; font-weight: bold; display: flex; align-items: center; gap: 5px;">
                    <i class="bi bi-whatsapp"></i> WhatsApp
                  </a>
                  <a href="${calendarLink}" target="_blank" style="background-color: #4285F4; color: white; padding: 10px 20px; border-radius: 5px; text-decoration: none; font-weight: bold; display: flex; align-items: center; gap: 5px;">
                    <i class="bi bi-calendar-event"></i> ${this.langService.translate('public_booking.success.calendar')}
                  </a>
                </div>
                ${response.accountExists ? '' : `
                  <div class="mt-4 p-3" style="background-color: #f0f9ff; border-radius: 8px;">
                    <p class="mb-2"><strong>${this.langService.translate('public_booking.success.didYouKnow')}</strong></p>
                    <small>${this.langService.translate('public_booking.success.accountBenefits')}</small>
                    <br>
                    <a href="/register" class="btn btn-sm btn-primary mt-2">${this.langService.translate('public_booking.success.createAccount')}</a>
                  </div>
                `}
              `,
              icon: 'success',
              showConfirmButton: true,
              confirmButtonText: this.langService.translate('public_booking.success.gotIt'),
              confirmButtonColor: '#10b981'
            }).then(() => {
              localStorage.removeItem(this.STORAGE_KEY);
              this.bookingForm.reset();
              this.step.set(1);
            });
          },
          error: (error) => {
            this.loading.set(false);
            Swal.fire({
              title: 'Error',
              text: error.error?.message || this.langService.translate('public_booking.errors.general'),
              icon: 'error',
              confirmButtonColor: '#ef4444'
            });
          }
        });
    } else {
      Object.keys(this.bookingForm.controls).forEach(key => {
        const control = this.bookingForm.get(key);
        if (control?.invalid) {
          control.markAsTouched();
        }
      });
    }
  }

  getWhatsAppLink(formData: any, doctorName: string): string {
    const patientName = `${formData.firstName} ${formData.lastName}`;
    const dateTime = `${formData.appointmentDate} ${formData.appointmentTime}`;
    const isEs = this.langService.lang() === 'es';
    
    const message = encodeURIComponent(
      `*${isEs ? 'Confirmación de Cita - Clínica MedicalCare 888' : 'Appointment Confirmation - MedicalCare 888 Clinic'}*\n\n` +
      `${isEs ? 'Hola' : 'Hello'} ${patientName}, ${isEs ? 'tu cita ha sido agendada' : 'your appointment has been scheduled'}:\n\n` +
      `*Doctor:* ${doctorName}\n` +
      `*${isEs ? 'Fecha' : 'Date'}:* ${dateTime}\n` +
      `*${isEs ? 'Motivo' : 'Reason'}:* ${formData.reason}\n\n` +
      `${isEs ? 'Te esperamos. Si necesitas cancelar o reagendar, contáctanos al 0424-1599101.' : 'We look forward to seeing you. If you need to cancel or reschedule, contact us at +58 424-1599101.'}`
    );
    const cleanPhone = formData.phone.replace(/\D/g, '');
    return `https://wa.me/${cleanPhone}?text=${message}`;
  }

  getGoogleCalendarLink(formData: any, doctorName: string): string {
    const patientName = `${formData.firstName} ${formData.lastName}`;
    const combinedDateTime = `${formData.appointmentDate}T${formData.appointmentTime}:00`;
    const [datePart, timePart] = combinedDateTime.split('T');
    const startTime = datePart.replace(/-/g, '') + 'T' + timePart.replace(/:/g, '') + '00Z';
    
    const dateObj = new Date(combinedDateTime);
    const endDateObj = new Date(dateObj.getTime() + 30 * 60000);
    const endDateISO = endDateObj.toISOString().split('.')[0];
    const endTime = endDateISO.replace(/-/g, '').replace(/:/g, '') + 'Z';

    const details = `Cita con Dr. ${doctorName}\nPaciente: ${patientName}\nMotivo: ${formData.reason}`;
    const location = 'Clínica MedicalCare 888';
    const isEs = this.langService.lang() === 'es';
    const title = isEs ? 'Cita Médica: ' : 'Medical Appointment: ';

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title + formData.reason)}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(location)}&dates=${startTime}/${endTime}&add=cgk888digital@gmail.com`;
  }

  getErrorMessage(fieldName: string): string {
    const control = this.bookingForm.get(fieldName);
    if (control?.hasError('required')) {
      return this.langService.translate('public_booking.errors.required');
    }
    if (control?.hasError('email')) {
      return this.langService.translate('public_booking.errors.email');
    }
    if (control?.hasError('pattern')) {
      return this.langService.translate('public_booking.errors.pattern');
    }
    return '';
  }
}
