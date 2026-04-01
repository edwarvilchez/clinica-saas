import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VideoConsultationService } from '../../services/video-consultation.service';
import { LanguageService } from '../../services/language.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-video-history',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslatePipe],
  template: `
    <div class="container-fluid py-4">
      <div class="row mb-4 align-items-center">
        <div class="col">
          <h3 class="fw-bold mb-1">{{ 'video_history.title' | translate }}</h3>
          <p class="text-muted">{{ 'video_history.subtitle' | translate }}</p>
        </div>
        <div class="col-auto">
          <button class="btn btn-outline-primary" (click)="loadHistory()">
            <i class="bi bi-arrow-clockwise"></i> {{ 'video_history.refresh' | translate }}
          </button>
        </div>
      </div>

      <div class="row g-3">
        <!-- Loading -->
        <div class="col-12" *ngIf="loading()">
          <div class="text-center py-5">
            <div class="spinner-border text-primary" role="status">
              <span class="visually-hidden">{{ 'common.loading' | translate }}</span>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div class="col-12" *ngIf="!loading() && consultations().length === 0">
          <div class="card p-5 text-center border-0 shadow-sm rounded-4">
            <div class="mb-3">
              <div class="icon-circle bg-light text-muted mx-auto">
                <i class="bi bi-camera-video fs-1"></i>
              </div>
            </div>
            <h5 class="text-muted mb-2">{{ 'video_history.noResults' | translate }}</h5>
            <p class="text-muted small mb-4">
              {{ 'video_history.noResultsDesc' | translate }}
            </p>
            <button class="btn btn-primary px-4 rounded-pill" routerLink="/appointments">
              {{ 'video_history.goToAppointments' | translate }}
            </button>
          </div>
        </div>

        <!-- Consultation Cards -->
        <div class="col-md-6 col-lg-4" *ngFor="let vc of consultations()">
          <div class="card h-100 border-0 shadow-sm rounded-4 overflow-hidden hover-card">
            <div class="card-header bg-white border-0 pt-4 px-4 pb-0">
              <div class="d-flex justify-content-between align-items-start mb-2">
                <span class="badge rounded-pill"
                  [ngClass]="{
                    'bg-success': vc.status === 'completed',
                    'bg-primary': vc.status === 'scheduled' || vc.status === 'active',
                    'bg-danger':  vc.status === 'cancelled'
                  }">
                  {{ getStatusLabel(vc.status) }}
                </span>
                <small class="text-muted">
                  <i class="bi bi-calendar3 me-1"></i>{{ vc.Appointment?.date | date:'dd MMM yyyy' }}
                </small>
              </div>
            </div>

            <div class="card-body px-4">
              <div class="d-flex align-items-center gap-3 mb-4">
                <div class="avatar-circle bg-primary bg-opacity-10 text-primary fw-bold fs-5">
                  {{ isDoctor ? vc.patient?.firstName?.charAt(0) : vc.doctor?.firstName?.charAt(0) }}
                </div>
                <div>
                  <div class="small text-muted text-uppercase fw-bold" style="font-size:0.7rem;">
                    {{ isDoctor ? ('video_history.patient' | translate) : ('video_history.doctor' | translate) }}
                  </div>
                  <h6 class="mb-0 fw-bold text-dark">
                    {{ isDoctor
                      ? (vc.patient?.firstName + ' ' + vc.patient?.lastName)
                      : ('Dr. ' + vc.doctor?.firstName + ' ' + vc.doctor?.lastName) }}
                  </h6>
                  <small class="text-muted" *ngIf="!isDoctor && vc.doctor?.Doctor?.specialty">
                    {{ vc.doctor.Doctor.specialty }}
                  </small>
                </div>
              </div>

              <div class="info-grid mb-3">
                <div class="d-flex align-items-center gap-2 text-muted small">
                  <i class="bi bi-clock"></i>
                  <span>{{ 'video_history.duration' | translate }}: {{ vc.duration ? vc.duration + ' min' : '--' }}</span>
                </div>
                <div class="d-flex align-items-center gap-2 text-muted small">
                  <i class="bi bi-camera-video"></i>
                  <span>ID: {{ vc.id }}</span>
                </div>
              </div>

              <div *ngIf="vc.notes" class="notes-preview p-3 bg-light rounded-3 mb-3">
                <div class="d-flex align-items-center gap-2 mb-2 text-primary small fw-bold">
                  <i class="bi bi-journal-text"></i> {{ 'video_history.consultNotes' | translate }}:
                </div>
                <p class="mb-0 text-muted small text-truncate-3">{{ vc.notes }}</p>
              </div>
            </div>

            <div class="card-footer bg-white border-0 px-4 pb-4 pt-0">
              <div class="d-grid gap-2">
                <button *ngIf="vc.status === 'completed'"
                        class="btn btn-outline-primary btn-sm rounded-pill"
                        (click)="generateReport(vc)">
                  <i class="bi bi-file-earmark-pdf me-1"></i> {{ 'video_history.downloadReport' | translate }}
                </button>
                <button *ngIf="vc.status === 'scheduled' || vc.status === 'active'"
                        class="btn btn-primary btn-sm rounded-pill"
                        [routerLink]="['/video-call', vc.id]">
                  <i class="bi bi-camera-video-fill me-1"></i> {{ 'video_history.joinCall' | translate }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .hover-card { transition: transform 0.2s ease, box-shadow 0.2s ease; }
    .hover-card:hover { transform: translateY(-5px); box-shadow: 0 10px 20px rgba(0,0,0,0.1) !important; }
    .avatar-circle { width:48px; height:48px; border-radius:50%; display:flex; align-items:center; justify-content:center; }
    .icon-circle   { width:80px; height:80px; border-radius:50%; display:flex; align-items:center; justify-content:center; }
    .text-truncate-3 { display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; }
    .info-grid { display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; }
  `]
})
export class VideoHistory implements OnInit {
  consultations = signal<any[]>([]);
  loading = signal(true);
  isDoctor = false;

  constructor(
    private videoService: VideoConsultationService,
    private authService: AuthService,
    public langService: LanguageService
  ) {}

  ngOnInit() {
    this.checkRole();
    this.loadHistory();
  }

  checkRole() {
    this.isDoctor = this.authService.hasRole(['DOCTOR']);
  }

  loadHistory() {
    this.loading.set(true);
    const request$ = this.isDoctor
      ? this.videoService.getMyConsultations()
      : this.videoService.getMyPatientConsultations();

    request$.subscribe({
      next: (data) => { this.consultations.set(data); this.loading.set(false); },
      error: (err) => {
        console.error('Error loading history:', err);
        this.loading.set(false);
        Swal.fire(
          this.langService.translate('common.error'),
          this.langService.translate('video_history.loadError'),
          'error'
        );
      }
    });
  }

  getStatusLabel(status: string): string {
    const keyMap: Record<string, string> = {
      scheduled: 'video_history.status.scheduled',
      active:    'video_history.status.active',
      completed: 'video_history.status.completed',
      cancelled: 'video_history.status.cancelled'
    };
    const key = keyMap[status];
    return key ? this.langService.translate(key) : status;
  }

  generateReport(vc: any) {
    const t = (k: string) => this.langService.translate(k);
    const doc = new jsPDF();

    // Header
    doc.setFillColor('#4a90e2');
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text(t('video_history.reportTitle'), 20, 25);
    doc.setFontSize(10);
    doc.text('MedicalCare 888 — ' + t('video_history.telemedPlatform'), 115, 25);

    doc.setTextColor(60, 60, 60);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    let y = 60;

    const field = (label: string, value: string) => {
      doc.setFont('helvetica', 'bold');
      doc.text(label + ':', 20, y);
      doc.setFont('helvetica', 'normal');
      doc.text(value, 70, y);
      y += 10;
    };

    doc.setFont('helvetica', 'bold');
    doc.text(t('video_history.sessionDetails'), 20, y);
    doc.line(20, y + 2, 190, y + 2);
    y += 15;

    field(t('video_history.treatingDoctor'), `Dr/a. ${vc.doctor?.firstName} ${vc.doctor?.lastName}`);
    field(t('video_history.patient'),        `${vc.patient?.firstName} ${vc.patient?.lastName}`);
    field(t('video_history.date'),           new Date(vc.Appointment?.date).toLocaleDateString());
    field(t('video_history.duration'),       `${vc.duration || 0} ${t('video_history.minutes')}`);

    if (vc.notes) {
      y += 10;
      doc.setFont('helvetica', 'bold');
      doc.text(t('video_history.clinicalNotes') + ':', 20, y);
      doc.line(20, y + 2, 190, y + 2);
      y += 15;
      doc.setFont('helvetica', 'normal');
      doc.text(doc.splitTextToSize(vc.notes, 170), 20, y);
    }

    const pageH = doc.internal.pageSize.height;
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`${t('video_history.generatedOn')} ${new Date().toLocaleString()}`, 20, pageH - 10);
    doc.text('MedicalCare888.app', 170, pageH - 10);

    doc.save(`MedicalCare888_Report_${vc.id}.pdf`);
  }
}
