import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AppointmentService } from '../../services/appointment.service';
import { API_URL } from '../../api-config';
import { VideoConsultationService } from '../../services/video-consultation.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import Swal from 'sweetalert2';
import { LanguageService } from '../../services/language.service';
import { ExportService } from '../../services/export.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-appointments',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ReactiveFormsModule],
  templateUrl: './appointments.html',
  styleUrl: './appointments.css',
})
export class Appointments implements OnInit {
  appointments = signal<any[]>([]);
  patients = signal<any[]>([]);
  doctors = signal<any[]>([]);
  specialties = signal<any[]>([]);
  selectedSpecialty = signal<string | number>('all');
  dateFilter = signal<'day' | 'week' | 'month'>('month');
  
  appointmentForm: FormGroup;
  showModal = signal(false);
  whatsappSending = signal(false);
  timeSlots: string[] = [];
  isPatient = signal(false);
  currentPatient = signal<any>(null);
  modalSpecialty = signal<string | number>('all');

  selectedDate = signal<string>(new Date().toISOString().split('T')[0]);

  filteredAppointments = computed(() => {
    const specialtyId = this.selectedSpecialty();
    const filter = this.dateFilter();
    let result = this.appointments();

    // 1. Filter by Specialty
    if (specialtyId !== 'all') {
      result = result.filter(appt => 
        appt.Doctor?.specialtyId == specialtyId || appt.Doctor?.Specialty?.id == specialtyId
      );
    }

    // 2. Filter by Date
    // Helper to get local YYYY-MM-DD string from a Date object or ISO string
    const getLocalDateString = (dateInput: string | Date): string => {
      const d = new Date(dateInput);
      const year = d.getFullYear();
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      const day = d.getDate().toString().padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const targetDateStr = this.selectedDate(); // "YYYY-MM-DD" from input
    // Only parse if we need week/month logic
    const [y, m, d] = targetDateStr.split('-').map(Number);
    const targetDate = new Date(y, m - 1, d); // Local midnight object for range calcs

    result = result.filter(appt => {
      if (!appt.date) return false;
      const apptDateStr = getLocalDateString(appt.date);

      if (filter === 'day') {
        // Direct string match is safest for same local day
        // Check if apptDateStr matches our target YYYY-MM-DD
        // However, getLocalDateString uses browser local time for 'appt.date' (ISO).
        // If appt.date is 2026-02-10T14:00:00 (local), getLocalDateString -> 2026-02-10.
        // If targetDateStr is 2026-02-10. Match.
        return apptDateStr === targetDateStr;
      } else if (filter === 'week') {
        // Range Check
        const apptDate = new Date(appt.date);
        const apptLocal = new Date(apptDate.getFullYear(), apptDate.getMonth(), apptDate.getDate());
        
        const startOfWeek = new Date(targetDate);
        startOfWeek.setDate(targetDate.getDate() - targetDate.getDay()); // Sunday
        startOfWeek.setHours(0,0,0,0);
        
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6); // Saturday
        endOfWeek.setHours(23,59,59,999);

        return apptLocal >= startOfWeek && apptLocal <= endOfWeek;
      } else if (filter === 'month') {
        const apptY = parseInt(apptDateStr.split('-')[0]);
        const apptM = parseInt(apptDateStr.split('-')[1]);
        return apptY === y && apptM === m;
      }
      return true;
    });

    return result;
  });

  filteredDoctors = computed(() => {
    const specialtyId = this.selectedSpecialty();
    if (specialtyId === 'all') {
      return this.doctors();
    }
    return this.doctors().filter(d => 
      d.specialtyId == specialtyId || d.Specialty?.id == specialtyId
    );
  });

  filteredDoctorsModal = computed(() => {
    const specialtyId = this.modalSpecialty();
    if (specialtyId === 'all') {
      return this.doctors();
    }
    return this.doctors().filter(d => 
      d.specialtyId == specialtyId || d.Specialty?.id == specialtyId
    );
  });


  constructor(
    private appointmentService: AppointmentService,
    private videoConsultationService: VideoConsultationService,
    private http: HttpClient,
    private fb: FormBuilder,
    public langService: LanguageService,
    private route: ActivatedRoute,
    private router: Router,
    private exportService: ExportService,
    public authService: AuthService
  ) {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    this.isPatient.set(user.role === 'PATIENT' || user.roleId === 3);

    this.appointmentForm = this.fb.group({
      patientId: ['', Validators.required],
      doctorId: ['', Validators.required],
      appointmentDate: ['', Validators.required],
      appointmentTime: ['', Validators.required],
      reason: ['', Validators.required],
      type: ['In-Person', Validators.required],
      notes: ['']
    });
    
    this.generateTimeSlots();
  }

  ngOnInit() {
    this.loadAppointments();
    this.loadDropdownData();

    if (this.isPatient()) {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (user && user.id) {
          this.appointmentService.getPatientByUserId(user.id).subscribe({
            next: (patient) => {
              this.currentPatient.set(patient);
              this.appointmentForm.patchValue({ patientId: patient.id });
              this.appointmentForm.get('patientId')?.disable(); // Disable patient selection for patients
            },
            error: (err) => console.error('Error loading patient profile:', err)
          });
        }
    }

    // Check for doctorId in query params
    this.route.queryParams.subscribe(params => {
      if (params['doctorId']) {
        // Wait for doctors to load if necessary, but for now just set logic
        // We might need to wait for loadDropdownData to complete, but reactive forms don't strictly require options to be present to set value
        this.appointmentForm.patchValue({ doctorId: Number(params['doctorId']) });
        this.openNewAppointmentModal();
      }
    });
  }
  
  generateTimeSlots() {
    const slots: string[] = [];
    for (let hour = 8; hour <= 18; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        if (hour === 18 && minute > 0) break; // Stop at 18:00
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

  loadAppointments() {
    this.appointmentService.getAppointments().subscribe({
      next: (data: any) => {
        const list = Array.isArray(data) ? data : data.appointments ?? [];
        this.appointments.set(list);
      },
      error: (err) => console.error('[ERROR] loading appointments:', err)
    });
  }
  
  getHeaders() {
    return new HttpHeaders({ 'Authorization': `Bearer ${localStorage.getItem('token')}` });
  }

  loadDropdownData() {
    if (!this.isPatient()) {
      this.http.get<any>(`${API_URL}/patients`, { headers: this.getHeaders() }).subscribe(data => {
        this.patients.set(Array.isArray(data) ? data : data.patients ?? []);
      });
    }

    this.http.get<any>(`${API_URL}/doctors`, { headers: this.getHeaders() }).subscribe(data => {
      this.doctors.set(Array.isArray(data) ? data : data.doctors ?? []);
    });
    this.http.get<any>(`${API_URL}/specialties`, { headers: this.getHeaders() }).subscribe(data => {
      this.specialties.set(Array.isArray(data) ? data : data.specialties ?? []);
    });
  }

  setSpecialtyFilter(id: string | number) {
    this.selectedSpecialty.set(id);
  }

  setDateFilter(filter: 'day' | 'week' | 'month') {
    this.dateFilter.set(filter);
  }

  onDateSelect(date: string) {
    this.selectedDate.set(date);
  }

  openNewAppointmentModal() {
    this.modalSpecialty.set('all');
    this.showModal.set(true);
  }

  closeModal() {
    this.modalSpecialty.set('all');
    this.showModal.set(false);
    this.appointmentForm.reset();
  }

  getGoogleCalendarLink(formData: any, patientName: string, doctorName: string) {
    const [datePart, timePart] = formData.date.split('T');
    const startTime = datePart.replace(/-/g, '') + 'T' + timePart.replace(/:/g, '') + '00Z';
    const dateObj = new Date(formData.date);
    const endDateObj = new Date(dateObj.getTime() + 30 * 60000);
    const endDateISO = endDateObj.toISOString().split('.')[0];
    const endTime = endDateISO.replace(/-/g, '').replace(/:/g, '') + 'Z';
    const details = `Cita con Dr. ${doctorName}\nPaciente: ${patientName}\nMotivo: ${formData.reason}`;
    const location = 'Clínica MedicalCare 888';
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent('Cita Médica: ' + formData.reason)}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(location)}&dates=${startTime}/${endTime}&add=edwarvilchez1977@gmail.com`;
  }

  getWhatsAppLink(formData: any, patientName: string, doctorName: string, phone: string) {
    const message = encodeURIComponent(
      `*Confirmación de Cita - MedicalCare 888*\n\n` +
      `Hola ${patientName}, tu cita ha sido agendada:\n\n` +
      `*Doctor:* ${doctorName}\n` +
      `*Fecha:* ${formData.date.replace('T', ' ')}\n` +
      `*Motivo:* ${formData.reason}\n\n` +
      `Te esperamos. Si necesitas cancelar o reagendar, contáctanos al 0424-1599101.`
    );
    const cleanPhone = phone.replace(/\D/g, '');
    return `https://wa.me/${cleanPhone}?text=${message}`;
  }

  submitAppointment() {
    if (this.appointmentForm.valid || (this.isPatient() && this.appointmentForm.get('doctorId')?.valid)) {
      this.whatsappSending.set(true);
      // We need to use getRawValue() because patientId might be disabled
      const formVal = this.appointmentForm.getRawValue();

      const combinedDateTime = `${formVal.appointmentDate}T${formVal.appointmentTime}:00`;
      const appointmentData = {
        patientId: formVal.patientId,
        doctorId: formVal.doctorId,
        date: combinedDateTime,
        reason: formVal.reason,
        type: formVal.type,
        notes: formVal.notes
      };

      // Lookup names for the links
      const patient = this.isPatient() ? this.currentPatient() : this.patients().find(p => p.id === formVal.patientId);
      const doctor = this.doctors().find(d => d.id === formVal.doctorId);
      
      const patientName = patient ? `${patient.User.firstName} ${patient.User.lastName}` : 'Paciente';
      const patientPhone = patient ? (patient.phone || patient.User?.phone) : '';
      const doctorName = doctor ? `${doctor.User.firstName} ${doctor.User.lastName}` : 'Doctor';

      const formDataForLinks = {
        ...appointmentData,
        date: combinedDateTime
      };

      const calendarLink = this.getGoogleCalendarLink(formDataForLinks, patientName, doctorName);
      const waLink = this.getWhatsAppLink(formDataForLinks, patientName, doctorName, patientPhone);

      this.appointmentService.createAppointment(appointmentData).subscribe({
        next: (res) => {
          this.loadAppointments();
          this.closeModal();
          this.whatsappSending.set(false);
          
          Swal.fire({
            title: this.langService.translate('appointments_list.success'),
            html: `
              <p>${this.langService.translate('appointments_list.success_msg')}</p>
              <p class="text-muted small">${this.langService.translate('appointments_list.success_info')}</p>
              <div style="display: flex; gap: 10px; justify-content: center; margin-top: 20px;">
                <a href="${waLink}" target="_blank" style="background-color: #25D366; color: white; padding: 10px 20px; border-radius: 5px; text-decoration: none; font-weight: bold; display: flex; align-items: center; gap: 5px;">
                  <i class="bi bi-whatsapp"></i> WhatsApp
                </a>
                <a href="${calendarLink}" target="_blank" style="background-color: #4285F4; color: white; padding: 10px 20px; border-radius: 5px; text-decoration: none; font-weight: bold; display: flex; align-items: center; gap: 5px;">
                  <i class="bi bi-calendar-event"></i> Google Calendar
                </a>
              </div>
            `,
            icon: 'success',
            showConfirmButton: false,
            showCloseButton: true
          });
        },
        error: (err) => {
          console.error('Error creating appointment:', err);
          this.whatsappSending.set(false);
          Swal.fire({
            title: this.langService.translate('common.error'),
            text: this.langService.translate('appointments_list.error_create'),
            icon: 'error',
            confirmButtonColor: '#ef4444'
          });
        }
      });
    }
  }

  getStatusClass(status: string) {
    switch (status) {
      case 'Confirmed': return 'bg-success';
      case 'Pending': return 'bg-warning';
      case 'Cancelled': return 'bg-danger';
      default: return 'bg-primary';
    }
  }

  async startVideoCall(appointment: any) {
    try {
      // Verificar que la cita esté confirmada
      if (appointment.status !== 'Confirmed') {
        await Swal.fire({
          icon: 'warning',
          title: 'Cita no confirmada',
          text: 'Solo puedes iniciar videollamadas con citas confirmadas',
          confirmButtonColor: '#4a90e2'
        });
        return;
      }

      // Mostrar loading
      Swal.fire({
        title: this.langService.translate('video_history.starting'),
        text: this.langService.translate('video_history.wait'),
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      // Crear o obtener videoconsulta
    this.videoConsultationService.createVideoConsultation(
      appointment.id
    ).subscribe({
      next: (response: any) => {
        Swal.close();
        
        if (response && response.videoConsultation && response.videoConsultation.id) {
          const consultationId = response.videoConsultation.id;
          console.log(`🚀 Navigating to /video-call/${consultationId}`);
          // Navegar al componente de videollamada
          this.router.navigate(['/video-call', consultationId]);
        } else {
          console.error('Respuesta de videoconsulta inválida:', response);
          Swal.fire({
            icon: 'error',
            title: 'Error de Datos',
            text: 'No se pudo obtener el ID de la videoconsulta correctamente.',
            confirmButtonColor: '#ef4444'
          });
        }
      },
      error: (err) => {
        console.error('Error creando videoconsulta:', err);
        Swal.fire({
          icon: 'error',
          title: this.langService.translate('common.error'),
          text: this.langService.translate('video_history.error_init'),
          confirmButtonColor: '#ef4444'
        });
      }
    });
    } catch (error) {
      console.error('Error:', error);
    }
  }

  canStartVideoCall(appointment: any): boolean {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isDoctor = user.role === 'DOCTOR' || user.roleId === 2;
    const isPatient = user.role === 'PATIENT' || user.roleId === 3; // Asumiendo rol 3 es paciente
    
    // La cita debe estar confirmada
    const isConfirmed = appointment.status === 'Confirmed';
    
    // La cita debe ser hoy o en el futuro cercano (dentro de 1 hora antes)
    const appointmentDate = new Date(appointment.date);
    const now = new Date();
    const oneHourBefore = new Date(appointmentDate.getTime() - 60 * 60 * 1000);
    // Permitir hasta 2 horas después de la hora programada
    const twoHoursAfter = new Date(appointmentDate.getTime() + 2 * 60 * 60 * 1000);
    
    return (isDoctor || isPatient) && isConfirmed;
  }

  exportReport() {
    if (this.filteredAppointments().length === 0) {
      Swal.fire('Atención', 'No hay datos para exportar', 'warning');
      return;
    }

    const headers = ['Fecha', 'Paciente', 'Doctor', 'Especialidad', 'Motivo', 'Tipo', 'Estado'];
    const rows = this.filteredAppointments().map(a => [
      new Date(a.date).toLocaleDateString(),
      `${a.Patient?.User?.firstName} ${a.Patient?.User?.lastName}`,
      `Dr. ${a.Doctor?.User?.firstName} ${a.Doctor?.User?.lastName}`,
      a.Doctor?.Specialty?.name || 'N/A',
      a.reason,
      a.type,
      a.status
    ]);

    Swal.fire({
      title: 'Exportar Listado de Citas',
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
      const filename = `Listado_Citas_ClinicaSaaS_${new Date().toISOString().split('T')[0]}`;
      const title = 'Listado de Citas Médicas - MedicalCare 888';
      const user = this.authService.currentUser();
      const branding = {
        name: user?.businessName || (user?.accountType === 'PROFESSIONAL' ? `${user.firstName} ${user.lastName}` : 'MedicalCare 888'),
        professional: user ? `${user.firstName} ${user.lastName}` : undefined,
        tagline: this.langService.translate('appointments_list.subtitle')
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
