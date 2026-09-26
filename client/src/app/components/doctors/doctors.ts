import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { LanguageService } from '../../services/language.service';
import { AuthService } from '../../services/auth.service';
import { API_URL } from '../../api-config';
import { TranslatePipe } from '../../services/translate.pipe';

interface DoctorItem {
  id: string;
  userId: string;
  phone?: string;
  address?: string;
  licenseNumber: string;
  specialtyId?: number;
  additionalSpecialties?: string[];
  university?: string;
  degreeTitle?: string;
  mppsNumber?: string;
  collegeNumber?: string;
  credentialsIssueDate?: string;
  credentialsExpiryDate?: string;
  chargesProfessionalFees?: boolean;
  User: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    isActive: boolean;
    subscriptionBypass?: boolean;
  };
  Specialty?: {
    id: number;
    name: string;
    nameEn?: string;
  };
  credentialStatus?: {
    status: string;
    daysRemaining: number | null;
    alertLevel: string;
    labelEs: string;
    labelEn: string;
    isExpired: boolean;
    isExpiringSoon: boolean;
  };
}

@Component({
  selector: 'app-doctors',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, TranslatePipe],
  template: `
    <div class="h-100 animate-fade-in p-3 p-md-4">
      <!-- Header -->
      <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
        <div>
          <div class="d-flex align-items-center gap-2 mb-1">
            <div class="badge bg-primary bg-opacity-10 text-primary p-2 rounded-3">
              <i class="bi bi-person-badge fs-5"></i>
            </div>
            <h3 class="fw-bold mb-0 text-dark">{{ 'doctors.title' | translate }}</h3>
          </div>
          <p class="text-muted small mb-0">{{ 'doctors.subtitle' | translate }}</p>
        </div>
        <div class="d-flex gap-2">
          <button class="btn btn-outline-primary btn-sm rounded-pill px-3 shadow-sm fw-semibold" (click)="loadDoctors()">
            <i class="bi bi-arrow-clockwise me-1"></i> {{ langService.lang() === 'es' ? 'Actualizar' : 'Refresh' }}
          </button>
          <button class="btn btn-primary-premium btn-sm rounded-pill px-3 shadow-sm fw-semibold" (click)="openCreateModal()">
            <i class="bi bi-person-plus-fill me-1"></i> {{ 'doctors.new' | translate }}
          </button>
        </div>
      </div>

      <!-- KPI Summary Cards -->
      <div class="row g-3 mb-4">
        <div class="col-sm-6 col-xl-3">
          <div class="card border-0 shadow-sm rounded-4 p-3 bg-white h-100 border-start border-4 border-primary">
            <div class="d-flex align-items-center justify-content-between">
              <div>
                <span class="text-muted x-small text-uppercase fw-bold">{{ langService.lang() === 'es' ? 'Total Médicos' : 'Total Doctors' }}</span>
                <h4 class="fw-bold text-dark mb-0 mt-1">{{ doctors().length }}</h4>
              </div>
              <div class="badge bg-primary bg-opacity-10 text-primary p-3 rounded-circle">
                <i class="bi bi-people-fill fs-5"></i>
              </div>
            </div>
          </div>
        </div>

        <div class="col-sm-6 col-xl-3">
          <div class="card border-0 shadow-sm rounded-4 p-3 bg-white h-100 border-start border-4 border-success">
            <div class="d-flex align-items-center justify-content-between">
              <div>
                <span class="text-muted x-small text-uppercase fw-bold">{{ langService.lang() === 'es' ? 'Credenciales Vigentes' : 'Valid Credentials' }}</span>
                <h4 class="fw-bold text-success mb-0 mt-1">{{ validCount() }}</h4>
              </div>
              <div class="badge bg-success bg-opacity-10 text-success p-3 rounded-circle">
                <i class="bi bi-patch-check-fill fs-5"></i>
              </div>
            </div>
          </div>
        </div>

        <div class="col-sm-6 col-xl-3">
          <div class="card border-0 shadow-sm rounded-4 p-3 bg-white h-100 border-start border-4 border-warning cursor-pointer" (click)="statusFilter.set('expiring')">
            <div class="d-flex align-items-center justify-content-between">
              <div>
                <span class="text-muted x-small text-uppercase fw-bold">{{ langService.lang() === 'es' ? 'Por Vencer (30d / Semanal)' : 'Expiring Soon (30d / Wk)' }}</span>
                <h4 class="fw-bold text-warning mb-0 mt-1">{{ expiringCount() }}</h4>
              </div>
              <div class="badge bg-warning bg-opacity-10 text-warning p-3 rounded-circle">
                <i class="bi bi-exclamation-triangle-fill fs-5"></i>
              </div>
            </div>
          </div>
        </div>

        <div class="col-sm-6 col-xl-3">
          <div class="card border-0 shadow-sm rounded-4 p-3 bg-white h-100 border-start border-4 border-danger cursor-pointer" (click)="statusFilter.set('expired')">
            <div class="d-flex align-items-center justify-content-between">
              <div>
                <span class="text-muted x-small text-uppercase fw-bold">{{ langService.lang() === 'es' ? 'Credenciales Vencidas' : 'Expired Credentials' }}</span>
                <h4 class="fw-bold text-danger mb-0 mt-1">{{ expiredCount() }}</h4>
              </div>
              <div class="badge bg-danger bg-opacity-10 text-danger p-3 rounded-circle">
                <i class="bi bi-shield-x fs-5"></i>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Preventive Alert Banner (If Any Warnings/Expired) -->
      <div *ngIf="expiringCount() > 0 || expiredCount() > 0" class="alert alert-warning border-0 shadow-sm rounded-4 p-3 mb-4 d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div class="d-flex align-items-center gap-3">
          <div class="badge bg-warning text-dark p-2 rounded-circle">
            <i class="bi bi-bell-fill fs-6"></i>
          </div>
          <div>
            <h6 class="fw-bold mb-0 text-dark">{{ 'doctors.alertBannerTitle' | translate }}</h6>
            <span class="small text-muted">
              {{ expiringCount() + expiredCount() }} {{ 'doctors.alertBannerMsg' | translate }}
            </span>
          </div>
        </div>
        <div class="d-flex gap-2">
          <button class="btn btn-sm btn-outline-dark rounded-pill px-3" (click)="statusFilter.set('alerts')">
            <i class="bi bi-filter me-1"></i> {{ langService.lang() === 'es' ? 'Filtrar Alertas' : 'Filter Alerts' }}
          </button>
        </div>
      </div>

      <!-- Search & Filters Card -->
      <div class="card border-0 shadow-sm rounded-4 p-3 mb-4 bg-white">
        <div class="row g-2 align-items-center">
          <div class="col-md-5">
            <div class="input-group search-bar rounded-pill overflow-hidden bg-light border">
              <span class="input-group-text bg-transparent border-0 ps-3 text-muted">
                <i class="bi bi-search"></i>
              </span>
              <input 
                type="text" 
                class="form-control bg-transparent border-0 py-2 shadow-none" 
                [placeholder]="'doctors.searchPlaceholder' | translate" 
                [ngModel]="searchTerm()"
                (ngModelChange)="searchTerm.set($event)">
            </div>
          </div>

          <div class="col-sm-6 col-md-3">
            <select 
              class="form-select rounded-pill border py-2"
              [ngModel]="specialtyFilter()"
              (ngModelChange)="specialtyFilter.set($event)">
              <option value="all">{{ 'doctors.allSpecialties' | translate }}</option>
              <option *ngFor="let specialty of specialties()" [value]="specialty.id">
                {{ langService.lang() === 'es' ? specialty.name : (specialty.nameEn || specialty.name) }}
              </option>
            </select>
          </div>

          <div class="col-sm-6 col-md-4">
            <div class="d-flex gap-1 align-items-center justify-content-between overflow-auto py-1">
              <div class="d-flex gap-1">
                <button 
                  class="btn btn-sm rounded-pill px-3 text-nowrap"
                  [ngClass]="statusFilter() === 'all' ? 'btn-primary' : 'btn-light text-muted'"
                  (click)="statusFilter.set('all')">
                  {{ langService.lang() === 'es' ? 'Todos' : 'All' }}
                </button>
                <button 
                  class="btn btn-sm rounded-pill px-3 text-nowrap"
                  [ngClass]="statusFilter() === 'valid' ? 'btn-success text-white' : 'btn-light text-muted'"
                  (click)="statusFilter.set('valid')">
                  {{ langService.lang() === 'es' ? 'Vigentes' : 'Valid' }}
                </button>
                <button 
                  class="btn btn-sm rounded-pill px-3 text-nowrap"
                  [ngClass]="statusFilter() === 'expiring' || statusFilter() === 'alerts' ? 'btn-warning text-dark' : 'btn-light text-muted'"
                  (click)="statusFilter.set('expiring')">
                  {{ langService.lang() === 'es' ? 'Por Vencer' : 'Expiring' }}
                </button>
              </div>

              <!-- View Switcher (Odoo style) -->
              <div class="btn-group bg-light p-1 rounded-pill border shadow-sm ms-2" role="group">
                <button type="button" class="btn btn-sm rounded-pill px-2 fw-bold d-flex align-items-center gap-1"
                  [ngClass]="viewMode() === 'kanban' ? 'btn-primary shadow-sm text-white' : 'btn-light text-muted border-0'"
                  (click)="viewMode.set('kanban')">
                  <i class="bi bi-kanban-fill"></i>
                </button>
                <button type="button" class="btn btn-sm rounded-pill px-2 fw-bold d-flex align-items-center gap-1"
                  [ngClass]="viewMode() === 'list' ? 'btn-primary shadow-sm text-white' : 'btn-light text-muted border-0'"
                  (click)="viewMode.set('list')">
                  <i class="bi bi-list-ul"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Doctors Grid (Kanban Mode) -->
      <div class="row g-3" *ngIf="viewMode() === 'kanban'">
        <div class="col-md-6 col-xl-4" *ngFor="let doctor of filteredDoctors()">
          <div class="card border-0 shadow-sm rounded-4 h-100 bg-white p-3 hover-card transition position-relative">
            <!-- Top Action Buttons -->
            <div class="position-absolute top-0 end-0 p-3 d-flex gap-1">
              <button 
                class="btn btn-light btn-sm rounded-circle p-1 shadow-none" 
                [title]="'doctors.edit' | translate"
                (click)="openEditModal(doctor)">
                <i class="bi bi-pencil text-primary"></i>
              </button>
              <button 
                *ngIf="isAdmin()"
                class="btn btn-light btn-sm rounded-circle p-1 shadow-none text-danger" 
                (click)="deleteDoctor(doctor.id)">
                <i class="bi bi-trash"></i>
              </button>
            </div>

            <!-- Doctor Header Info -->
            <div class="d-flex align-items-center gap-3 mb-3">
              <img 
                [src]="'https://ui-avatars.com/api/?name=' + doctor.User.firstName + '+' + doctor.User.lastName + '&background=0ea5e9&color=fff&bold=true'" 
                class="rounded-circle shadow-sm border" 
                width="64"
                height="64">
              <div>
                <h6 class="fw-bold text-dark mb-0">Dr. {{ doctor.User.firstName }} {{ doctor.User.lastName }}</h6>
                <span class="badge bg-primary bg-opacity-10 text-primary rounded-pill px-2 py-1 x-small fw-semibold mt-1">
                  {{ doctor.Specialty?.name || ('doctors.specialist' | translate) }}
                </span>
                <span *ngIf="doctor.degreeTitle" class="d-block text-muted x-small mt-1">
                  <i class="bi bi-mortarboard me-1"></i>{{ doctor.degreeTitle }}
                </span>
              </div>
            </div>

            <!-- Academic & Legal Badges -->
            <div class="bg-light bg-opacity-50 p-2 rounded-3 mb-3 x-small">
              <div class="d-flex justify-content-between mb-1" *ngIf="doctor.university">
                <span class="text-muted"><i class="bi bi-bank me-1"></i>{{ langService.lang() === 'es' ? 'Universidad' : 'University' }}:</span>
                <span class="fw-semibold text-dark text-truncate ms-2" style="max-width: 170px;">{{ doctor.university }}</span>
              </div>
              <div class="d-flex justify-content-between mb-1">
                <span class="text-muted"><i class="bi bi-card-text me-1"></i>MPPS / Cédula:</span>
                <span class="fw-bold text-dark">{{ doctor.mppsNumber || doctor.licenseNumber }}</span>
              </div>
              <div class="d-flex justify-content-between mb-1" *ngIf="doctor.collegeNumber">
                <span class="text-muted"><i class="bi bi-award me-1"></i>{{ langService.lang() === 'es' ? 'Colegio Médico' : 'Medical College' }}:</span>
                <span class="fw-semibold text-dark">N° {{ doctor.collegeNumber }}</span>
              </div>
              <div class="d-flex justify-content-between">
                <span class="text-muted"><i class="bi bi-cash-stack me-1"></i>{{ langService.lang() === 'es' ? 'Honorarios' : 'Prof. Fees' }}:</span>
                <span class="badge rounded-pill" [ngClass]="doctor.chargesProfessionalFees !== false ? 'bg-success bg-opacity-10 text-success' : 'bg-secondary bg-opacity-10 text-secondary'">
                  {{ doctor.chargesProfessionalFees !== false ? (langService.lang() === 'es' ? 'Cobra Honorarios' : 'Charges Fees') : (langService.lang() === 'es' ? 'Sueldo Fijo' : 'Fixed Salary') }}
                </span>
              </div>
            </div>

            <!-- Additional Specialties (if any) -->
            <div class="mb-3" *ngIf="doctor.additionalSpecialties && doctor.additionalSpecialties.length > 0">
              <span class="text-muted x-small d-block mb-1 fw-bold">{{ langService.lang() === 'es' ? 'Otras Especialidades:' : 'Additional Specialties:' }}</span>
              <div class="d-flex flex-wrap gap-1">
                <span *ngFor="let spec of doctor.additionalSpecialties" class="badge bg-secondary bg-opacity-10 text-secondary border rounded-pill x-small">
                  {{ spec }}
                </span>
              </div>
            </div>

            <!-- Credential Validity Status Badge -->
            <div class="mb-3">
              <div class="d-flex align-items-center justify-content-between p-2 rounded-3 border" [ngClass]="getAlertClass(doctor.credentialStatus)">
                <div class="d-flex align-items-center gap-2">
                  <i class="bi" [ngClass]="getAlertIcon(doctor.credentialStatus)"></i>
                  <div>
                    <span class="d-block fw-bold x-small">
                      {{ langService.lang() === 'es' ? doctor.credentialStatus?.labelEs : doctor.credentialStatus?.labelEn }}
                    </span>
                    <span *ngIf="doctor.credentialsExpiryDate" class="text-muted x-small">
                      {{ langService.lang() === 'es' ? 'Vence:' : 'Expires:' }} {{ doctor.credentialsExpiryDate }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Active / Bypass Badges & Footer Actions -->
            <div class="border-top pt-2 mt-auto">
              <div class="d-flex justify-content-between align-items-center mb-2">
                <span 
                  class="badge rounded-pill px-2 py-1 cursor-pointer" 
                  [ngClass]="doctor.User.isActive ? 'bg-success bg-opacity-10 text-success' : 'bg-danger bg-opacity-10 text-danger'"
                  style="font-size: 0.75rem;"
                  (click)="toggleStatus(doctor)">
                  <i class="bi bi-circle-fill me-1" style="font-size: 0.5rem;"></i>
                  {{ doctor.User.isActive ? ('common.active' | translate) : ('common.inactive' | translate) }}
                </span>

                <span 
                  *ngIf="isAdmin()"
                  class="badge rounded-pill px-2 py-1 cursor-pointer" 
                  [ngClass]="doctor.User.subscriptionBypass ? 'bg-warning bg-opacity-20 text-warning' : 'bg-light text-muted'"
                  style="font-size: 0.75rem;"
                  (click)="toggleBypass(doctor)"
                  [title]="'doctors.messages.toggleBypassTooltip' | translate">
                  <i class="bi" [ngClass]="doctor.User.subscriptionBypass ? 'bi-star-fill' : 'bi-star'"></i> VIP
                </span>
              </div>

              <div class="row g-1">
                <div class="col-6">
                  <button class="btn btn-light btn-sm rounded-pill w-100 fw-semibold text-dark" (click)="viewProfile(doctor)">
                    <i class="bi bi-eye me-1"></i> {{ 'doctors.viewProfile' | translate }}
                  </button>
                </div>
                <div class="col-6">
                  <button 
                    class="btn btn-primary-premium btn-sm rounded-pill w-100 fw-semibold" 
                    [disabled]="!doctor.User.isActive"
                    (click)="scheduleAppointment(doctor)">
                    <i class="bi bi-calendar2-check me-1"></i> {{ 'doctors.schedule' | translate }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="col-12 text-center py-5" *ngIf="filteredDoctors().length === 0">
          <div class="card border-0 shadow-sm rounded-4 p-5 bg-white text-center">
            <i class="bi bi-person-x display-4 text-muted opacity-50 mb-3"></i>
            <h5 class="fw-bold text-dark">{{ 'doctors.noResults' | translate }}</h5>
            <p class="text-muted small mb-0">{{ langService.lang() === 'es' ? 'Prueba con otro término de búsqueda o registra un nuevo médico.' : 'Try another search term or register a new doctor.' }}</p>
          </div>
        </div>
      </div>

      <!-- Doctors Table List View -->
      <div *ngIf="viewMode() === 'list'" class="card border-0 shadow-sm rounded-4 bg-white overflow-hidden mb-4">
        <div class="table-responsive">
          <table class="table table-hover align-middle mb-0">
            <thead class="bg-light">
              <tr>
                <th class="ps-4 py-3 x-small fw-bold text-muted">{{ langService.lang() === 'es' ? 'MÉDICO' : 'DOCTOR' }}</th>
                <th class="py-3 x-small fw-bold text-muted">{{ langService.lang() === 'es' ? 'ESPECIALIDAD' : 'SPECIALTY' }}</th>
                <th class="py-3 x-small fw-bold text-muted">{{ langService.lang() === 'es' ? 'MPPS / CÉDULA' : 'MPPS / ID' }}</th>
                <th class="py-3 x-small fw-bold text-muted">{{ langService.lang() === 'es' ? 'COLEGIO' : 'COLLEGE' }}</th>
                <th class="py-3 x-small fw-bold text-muted">{{ langService.lang() === 'es' ? 'HONORARIOS' : 'FEES' }}</th>
                <th class="py-3 x-small fw-bold text-muted">{{ langService.lang() === 'es' ? 'CREDENCIALES' : 'CREDENTIALS' }}</th>
                <th class="py-3 x-small fw-bold text-muted">{{ langService.lang() === 'es' ? 'ESTADO' : 'STATUS' }}</th>
                <th class="pe-4 py-3 x-small fw-bold text-muted text-end">{{ langService.lang() === 'es' ? 'ACCIONES' : 'ACTIONS' }}</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let doctor of filteredDoctors()">
                <td class="ps-4">
                  <div class="d-flex align-items-center gap-2">
                    <img 
                      [src]="'https://ui-avatars.com/api/?name=' + doctor.User.firstName + '+' + doctor.User.lastName + '&background=0ea5e9&color=fff&bold=true'" 
                      class="rounded-circle shadow-sm border" 
                      width="36"
                      height="36">
                    <div>
                      <strong class="text-dark d-block">Dr. {{ doctor.User.firstName }} {{ doctor.User.lastName }}</strong>
                      <small class="text-muted x-small">{{ doctor.User.email }}</small>
                    </div>
                  </div>
                </td>
                <td>
                  <span class="badge bg-primary bg-opacity-10 text-primary rounded-pill px-2 py-1">
                    {{ doctor.Specialty?.name || ('doctors.specialist' | translate) }}
                  </span>
                </td>
                <td>
                  <div class="font-monospace fw-semibold text-dark">{{ doctor.mppsNumber || doctor.licenseNumber }}</div>
                </td>
                <td>
                  <span class="font-monospace text-muted small">{{ doctor.collegeNumber ? 'N° ' + doctor.collegeNumber : 'N/A' }}</span>
                </td>
                <td>
                  <span class="badge rounded-pill" [ngClass]="doctor.chargesProfessionalFees !== false ? 'bg-success bg-opacity-10 text-success' : 'bg-secondary bg-opacity-10 text-secondary'">
                    {{ doctor.chargesProfessionalFees !== false ? 'Honorarios' : 'Fijo' }}
                  </span>
                </td>
                <td>
                  <span class="badge rounded-pill" [ngClass]="{
                    'bg-success bg-opacity-10 text-success': doctor.credentialStatus?.alertLevel === 'success',
                    'bg-warning bg-opacity-10 text-dark': doctor.credentialStatus?.alertLevel === 'warning',
                    'bg-danger bg-opacity-10 text-danger': doctor.credentialStatus?.alertLevel === 'danger'
                  }">
                    {{ langService.lang() === 'es' ? doctor.credentialStatus?.labelEs : doctor.credentialStatus?.labelEn }}
                  </span>
                </td>
                <td>
                  <span class="badge rounded-pill" [ngClass]="doctor.User.isActive ? 'bg-success' : 'bg-danger'">
                    {{ doctor.User.isActive ? 'Activo' : 'Inactivo' }}
                  </span>
                </td>
                <td class="pe-4 text-end">
                  <div class="d-flex justify-content-end gap-1">
                    <button class="btn btn-sm btn-light rounded-circle p-1 text-primary" (click)="openEditModal(doctor)" [title]="'doctors.edit' | translate">
                      <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm btn-light rounded-circle p-1 text-info" (click)="viewProfile(doctor)" title="Ver Perfil">
                      <i class="bi bi-eye"></i>
                    </button>
                    <button *ngIf="isAdmin()" class="btn btn-sm btn-light rounded-circle p-1 text-danger" (click)="deleteDoctor(doctor.id)">
                      <i class="bi bi-trash"></i>
                    </button>
                  </div>
                </td>
              </tr>
              <tr *ngIf="filteredDoctors().length === 0">
                <td colspan="8" class="text-center py-5 text-muted">
                  No se encontraron médicos registrados.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- MODAL CREAR / EDITAR DOCTOR -->
    <div *ngIf="showModal" class="modal fade show d-block" tabindex="-1" style="background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(4px);">
      <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content border-0 shadow-lg rounded-4">
          <div class="modal-header border-bottom px-4 py-3 bg-light">
            <div class="d-flex align-items-center gap-2">
              <div class="badge bg-primary bg-opacity-10 text-primary p-2 rounded-3">
                <i class="bi bi-person-badge fs-5"></i>
              </div>
              <div>
                <h5 class="modal-title fw-bold text-dark mb-0">
                  {{ isEditing ? ('doctors.edit' | translate) : ('doctors.new' | translate) }}
                </h5>
                <span class="text-muted x-small">{{ langService.lang() === 'es' ? 'Ficha médica, académica, legal MPPS y vigencia de credenciales' : 'Medical, academic, legal MPPS profile and credentials validity' }}</span>
              </div>
            </div>
            <button type="button" class="btn-close shadow-none" (click)="closeModal()"></button>
          </div>

          <div class="modal-body p-4" style="max-height: 75vh; overflow-y: auto;">
            <form (ngSubmit)="saveDoctor()">
              <!-- Secc 1: Identificación y Contacto -->
              <h6 class="fw-bold text-primary mb-3 d-flex align-items-center gap-2">
                <i class="bi bi-person-lines-fill"></i>
                <span>{{ langService.lang() === 'es' ? '1. Datos de Identificación y Contacto' : '1. Identification & Contact Info' }}</span>
              </h6>
              
              <div class="row g-3 mb-4">
                <div class="col-md-6">
                  <label class="form-label x-small fw-bold text-muted">{{ 'doctors.fields.firstName' | translate }} *</label>
                  <input type="text" class="form-control form-control-sm rounded-3" [(ngModel)]="currentDoctor.firstName" name="firstName" required placeholder="Ej. Carlos">
                </div>
                <div class="col-md-6">
                  <label class="form-label x-small fw-bold text-muted">{{ 'doctors.fields.lastName' | translate }} *</label>
                  <input type="text" class="form-control form-control-sm rounded-3" [(ngModel)]="currentDoctor.lastName" name="lastName" required placeholder="Ej. Mendoza">
                </div>
                <div class="col-md-6">
                  <label class="form-label x-small fw-bold text-muted">{{ 'doctors.fields.email' | translate }} *</label>
                  <input type="email" class="form-control form-control-sm rounded-3" [(ngModel)]="currentDoctor.email" name="email" required [disabled]="isEditing" placeholder="doctor@clinicasaas.com">
                </div>
                <div class="col-md-6">
                  <label class="form-label x-small fw-bold text-muted">{{ 'doctors.fields.phone' | translate }} *</label>
                  <input type="text" class="form-control form-control-sm rounded-3" [(ngModel)]="currentDoctor.phone" name="phone" required placeholder="+58 412-1234567">
                </div>
                <div class="col-12" *ngIf="!isEditing">
                  <label class="form-label x-small fw-bold text-muted">{{ 'doctors.fields.password' | translate }} *</label>
                  <input type="password" class="form-control form-control-sm rounded-3" [(ngModel)]="currentDoctor.password" name="password" required placeholder="{{ 'doctors.fields.passwordPlaceholder' | translate }}">
                </div>
              </div>

              <!-- Secc 2: Formación Universitaria y Registro Legal (Venezuela) -->
              <h6 class="fw-bold text-primary mb-3 d-flex align-items-center gap-2">
                <i class="bi bi-mortarboard-fill"></i>
                <span>{{ langService.lang() === 'es' ? '2. Formación Académica y Registros Legales (Venezuela)' : '2. Academic Degree & Venezuelan Legal Registration' }}</span>
              </h6>

              <div class="row g-3 mb-4">
                <div class="col-md-6">
                  <label class="form-label x-small fw-bold text-muted">{{ 'doctors.fields.university' | translate }}</label>
                  <input type="text" class="form-control form-control-sm rounded-3" [(ngModel)]="currentDoctor.university" name="university" placeholder="Ej. UCV, LUZ, UC, ULA, UCLA, UNERG">
                </div>
                <div class="col-md-6">
                  <label class="form-label x-small fw-bold text-muted">{{ 'doctors.fields.degreeTitle' | translate }}</label>
                  <input type="text" class="form-control form-control-sm rounded-3" [(ngModel)]="currentDoctor.degreeTitle" name="degreeTitle" placeholder="Ej. Médico Cirujano, Médico Especialista">
                </div>
                <div class="col-md-4">
                  <label class="form-label x-small fw-bold text-muted">{{ 'doctors.fields.license' | translate }} *</label>
                  <input type="text" class="form-control form-control-sm rounded-3" [(ngModel)]="currentDoctor.licenseNumber" name="licenseNumber" required placeholder="Ej. V-14234567">
                </div>
                <div class="col-md-4">
                  <label class="form-label x-small fw-bold text-muted">{{ 'doctors.fields.mppsNumber' | translate }}</label>
                  <input type="text" class="form-control form-control-sm rounded-3" [(ngModel)]="currentDoctor.mppsNumber" name="mppsNumber" placeholder="Ej. MPPS-87452">
                </div>
                <div class="col-md-4">
                  <label class="form-label x-small fw-bold text-muted">{{ 'doctors.fields.collegeNumber' | translate }}</label>
                  <input type="text" class="form-control form-control-sm rounded-3" [(ngModel)]="currentDoctor.collegeNumber" name="collegeNumber" placeholder="Ej. CME-4512">
                </div>
              </div>

              <!-- Secc 3: Especialidades Médicas (Una o Varias) -->
              <h6 class="fw-bold text-primary mb-3 d-flex align-items-center gap-2">
                <i class="bi bi-heart-pulse-fill"></i>
                <span>{{ langService.lang() === 'es' ? '3. Especialidades Médicas (Una o Varias)' : '3. Medical Specialties (One or Multiple)' }}</span>
              </h6>

              <div class="row g-3 mb-4">
                <div class="col-md-6">
                  <label class="form-label x-small fw-bold text-muted">{{ 'doctors.fields.specialty' | translate }} *</label>
                  <select class="form-select form-select-sm rounded-3" [(ngModel)]="currentDoctor.specialtyId" name="specialtyId" required>
                    <option value="">{{ langService.lang() === 'es' ? 'Seleccionar Especialidad Principal...' : 'Select Primary Specialty...' }}</option>
                    <option *ngFor="let s of specialties()" [value]="s.id">
                      {{ langService.lang() === 'es' ? s.name : (s.nameEn || s.name) }}
                    </option>
                  </select>
                </div>

                <div class="col-md-6">
                  <label class="form-label x-small fw-bold text-muted">{{ 'doctors.fields.additionalSpecialties' | translate }}</label>
                  <input 
                    type="text" 
                    class="form-control form-control-sm rounded-3" 
                    [(ngModel)]="additionalSpecialtiesText" 
                    name="additionalSpecialtiesText" 
                    placeholder="{{ langService.lang() === 'es' ? 'Ej. Cardiología Intervencionista, Ecocardiografía (separadas por comas)' : 'E.g. Interventional Cardiology, Echocardiography (comma-separated)' }}">
                  <small class="text-muted x-small">{{ langService.lang() === 'es' ? 'Ingresa especialidades secundarias o subespecialidades separadas por comas.' : 'Enter subspecialties or secondary specialties separated by commas.' }}</small>
                </div>
              </div>

              <!-- Secc 4: Período de Validez y Alertas de Vencimiento -->
              <h6 class="fw-bold text-primary mb-3 d-flex align-items-center gap-2">
                <i class="bi bi-calendar-check-fill"></i>
                <span>{{ langService.lang() === 'es' ? '4. Período de Validez y Alertas de Credenciales' : '4. Validity Period & Credential Alert Engine' }}</span>
              </h6>

              <div class="row g-3 mb-4">
                <div class="col-md-6">
                  <label class="form-label x-small fw-bold text-muted">{{ 'doctors.fields.credentialsIssueDate' | translate }}</label>
                  <input type="date" class="form-control form-control-sm rounded-3" [(ngModel)]="currentDoctor.credentialsIssueDate" name="credentialsIssueDate">
                </div>
                <div class="col-md-6">
                  <label class="form-label x-small fw-bold text-muted">{{ 'doctors.fields.credentialsExpiryDate' | translate }}</label>
                  <input type="date" class="form-control form-control-sm rounded-3" [(ngModel)]="currentDoctor.credentialsExpiryDate" name="credentialsExpiryDate">
                </div>

                <div class="col-12">
                  <div class="alert alert-info border-0 rounded-3 p-2 mb-0 d-flex align-items-center gap-2">
                    <i class="bi bi-info-circle-fill text-info fs-5"></i>
                    <span class="x-small">
                      <strong>{{ langService.lang() === 'es' ? 'Sistema de Aviso Preventivo Automático:' : 'Automatic Early Warning System:' }}</strong>
                      {{ langService.lang() === 'es' ? 'La plataforma alertará automáticamente 1 mes antes (30 días) y luego cada semana (21, 14 y 7 días) hasta el vencimiento exacto de las credenciales.' : 'The system automatically triggers alerts 1 month in advance (30 days) and weekly thereafter (21, 14, and 7 days) until expiration.' }}
                    </span>
                  </div>
                </div>
              </div>

              <!-- Secc 5: Honorarios Profesionales -->
              <h6 class="fw-bold text-primary mb-3 d-flex align-items-center gap-2">
                <i class="bi bi-cash-coin"></i>
                <span>{{ langService.lang() === 'es' ? '5. Régimen de Honorarios Profesionales' : '5. Professional Fees Scheme' }}</span>
              </h6>

              <div class="card border rounded-3 p-3 bg-light bg-opacity-50 mb-4">
                <div class="form-check form-switch mb-1">
                  <input 
                    class="form-check-input" 
                    type="checkbox" 
                    role="switch" 
                    id="chargesProfessionalFeesCheck" 
                    [(ngModel)]="currentDoctor.chargesProfessionalFees" 
                    name="chargesProfessionalFees">
                  <label class="form-check-label fw-bold text-dark x-small" for="chargesProfessionalFeesCheck">
                    {{ 'doctors.fields.chargesProfessionalFees' | translate }}
                  </label>
                </div>
                <span class="text-muted x-small ms-4 d-block">
                  {{ langService.lang() === 'es' ? 'Habilita la liquidación y cálculo de porcentajes clínicos, baremos de aseguradoras y retenciones de ISLR (3% SENIAT) en el módulo de Honorarios Profesionales.' : 'Enables revenue split calculation, insurer baremos and ISLR withholding (3% SENIAT) in the Professional Fees module.' }}
                </span>
              </div>

              <!-- Footer Modal Buttons -->
              <div class="d-flex justify-content-end gap-2 pt-3 border-top">
                <button type="button" class="btn btn-light btn-sm rounded-pill px-3" (click)="closeModal()">
                  {{ 'common.cancel' | translate }}
                </button>
                <button type="submit" class="btn btn-primary-premium btn-sm rounded-pill px-4 fw-bold shadow-sm">
                  <i class="bi bi-check-circle me-1"></i> {{ 'common.save' | translate }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrl: './doctors.css',
})
export class Doctors implements OnInit {
  doctors = signal<DoctorItem[]>([]);
  specialties = signal<any[]>([]);
  searchTerm = signal('');
  specialtyFilter = signal('all');
  statusFilter = signal<'all' | 'valid' | 'expiring' | 'expired' | 'alerts'>('all');
  viewMode = signal<'kanban' | 'list'>('kanban');

  // Modal State
  showModal = false;
  isEditing = false;
  currentDoctor: any = {};
  additionalSpecialtiesText = '';

  // KPI Computeds
  validCount = computed(() => {
    return this.doctors().filter(d => d.credentialStatus?.status === 'VALID').length;
  });

  expiringCount = computed(() => {
    return this.doctors().filter(d => d.credentialStatus?.isExpiringSoon).length;
  });

  expiredCount = computed(() => {
    return this.doctors().filter(d => d.credentialStatus?.isExpired).length;
  });

  filteredDoctors = computed(() => {
    const term = this.searchTerm().toLowerCase();
    const specialty = this.specialtyFilter();
    const status = this.statusFilter();
    
    return this.doctors().filter(d => {
      const fullName = `${d.User?.firstName || ''} ${d.User?.lastName || ''}`.toLowerCase();
      const specName = (d.Specialty?.name || '').toLowerCase();
      const mpps = (d.mppsNumber || '').toLowerCase();
      const college = (d.collegeNumber || '').toLowerCase();
      const university = (d.university || '').toLowerCase();
      const license = (d.licenseNumber || '').toLowerCase();

      const matchesSearch = 
        fullName.includes(term) || 
        specName.includes(term) ||
        mpps.includes(term) ||
        college.includes(term) ||
        university.includes(term) ||
        license.includes(term);
      
      const matchesSpecialty = specialty === 'all' || d.specialtyId === parseInt(specialty);

      let matchesStatus = true;
      if (status === 'valid') {
        matchesStatus = d.credentialStatus?.status === 'VALID';
      } else if (status === 'expiring') {
        matchesStatus = !!d.credentialStatus?.isExpiringSoon;
      } else if (status === 'expired') {
        matchesStatus = !!d.credentialStatus?.isExpired;
      } else if (status === 'alerts') {
        matchesStatus = !!d.credentialStatus?.isExpiringSoon || !!d.credentialStatus?.isExpired;
      }
      
      return matchesSearch && matchesSpecialty && matchesStatus;
    });
  });

  constructor(
    private http: HttpClient,
    public langService: LanguageService,
    private router: Router,
    private authService: AuthService
  ) {}

  isAdmin() {
    const user = this.authService.currentUser();
    const authorizedEmails = ['edwarvilchez1977@gmail.com', 'admin@clinicasaas.com'];
    return this.authService.hasRole(['SUPERADMIN']) || authorizedEmails.includes(user?.email);
  }

  ngOnInit() {
    this.loadDoctors();
    this.loadSpecialties();
  }

  getHeaders() {
    return new HttpHeaders({ 'Authorization': `Bearer ${localStorage.getItem('token')}` });
  }

  loadDoctors() {
    this.http.get<any>(`${API_URL}/doctors`, { headers: this.getHeaders() })
      .subscribe({
        next: (data) => {
          const list = Array.isArray(data) ? data : (data.doctors || []);
          this.doctors.set(list);
        },
        error: (err) => console.error('Error loading doctors:', err)
      });
  }

  loadSpecialties() {
    this.http.get<any[]>(`${API_URL}/specialties`, { headers: this.getHeaders() })
      .subscribe(data => this.specialties.set(data || []));
  }

  getAlertClass(statusObj: any): string {
    if (!statusObj) return 'bg-light text-muted';
    if (statusObj.status === 'EXPIRED') return 'bg-danger bg-opacity-10 text-danger border-danger';
    if (statusObj.status === 'CRITICAL_7_DAYS') return 'bg-danger bg-opacity-10 text-danger border-danger';
    if (statusObj.status === 'WARNING_14_DAYS' || statusObj.status === 'WARNING_21_DAYS') return 'bg-warning bg-opacity-10 text-warning-emphasis border-warning';
    if (statusObj.status === 'NOTICE_30_DAYS') return 'bg-info bg-opacity-10 text-info border-info';
    if (statusObj.status === 'VALID') return 'bg-success bg-opacity-10 text-success border-success';
    return 'bg-light text-muted border-light';
  }

  getAlertIcon(statusObj: any): string {
    if (!statusObj) return 'bi-shield-check text-muted';
    if (statusObj.isExpired) return 'bi-shield-slash-fill text-danger';
    if (statusObj.status === 'CRITICAL_7_DAYS') return 'bi-exclamation-octagon-fill text-danger';
    if (statusObj.isExpiringSoon) return 'bi-exclamation-triangle-fill text-warning';
    if (statusObj.status === 'VALID') return 'bi-patch-check-fill text-success';
    return 'bi-shield-check text-muted';
  }

  openCreateModal() {
    this.isEditing = false;
    this.currentDoctor = {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      password: '',
      licenseNumber: '',
      specialtyId: '',
      additionalSpecialties: [],
      university: '',
      degreeTitle: 'Médico Cirujano',
      mppsNumber: '',
      collegeNumber: '',
      credentialsIssueDate: '',
      credentialsExpiryDate: '',
      chargesProfessionalFees: true
    };
    this.additionalSpecialtiesText = '';
    this.showModal = true;
  }

  openEditModal(doctor: DoctorItem) {
    this.isEditing = true;
    this.currentDoctor = {
      id: doctor.id,
      firstName: doctor.User?.firstName,
      lastName: doctor.User?.lastName,
      email: doctor.User?.email,
      phone: doctor.phone,
      licenseNumber: doctor.licenseNumber,
      specialtyId: doctor.specialtyId,
      university: doctor.university,
      degreeTitle: doctor.degreeTitle || 'Médico Cirujano',
      mppsNumber: doctor.mppsNumber,
      collegeNumber: doctor.collegeNumber,
      credentialsIssueDate: doctor.credentialsIssueDate,
      credentialsExpiryDate: doctor.credentialsExpiryDate,
      chargesProfessionalFees: doctor.chargesProfessionalFees !== false
    };
    this.additionalSpecialtiesText = Array.isArray(doctor.additionalSpecialties) 
      ? doctor.additionalSpecialties.join(', ') 
      : '';
    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
  }

  saveDoctor() {
    const t = (k: string) => this.langService.translate(k);

    if (!this.currentDoctor.firstName || !this.currentDoctor.lastName || !this.currentDoctor.email || !this.currentDoctor.licenseNumber) {
      Swal.fire({
        title: t('common.error'),
        text: t('doctors.messages.completeRequired'),
        icon: 'warning',
        confirmButtonColor: '#0ea5e9'
      });
      return;
    }

    // Process additional specialties string to array
    const additionalSpecs = this.additionalSpecialtiesText
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const payload = {
      ...this.currentDoctor,
      additionalSpecialties: additionalSpecs,
      specialtyId: this.currentDoctor.specialtyId ? parseInt(this.currentDoctor.specialtyId) : null,
      chargesProfessionalFees: Boolean(this.currentDoctor.chargesProfessionalFees)
    };

    if (this.isEditing) {
      this.http.put(`${API_URL}/doctors/${this.currentDoctor.id}`, payload, { headers: this.getHeaders() })
        .subscribe({
          next: () => {
            this.closeModal();
            this.loadDoctors();
            Swal.fire({
              title: t('doctors.messages.updated'),
              text: t('doctors.messages.updatedMsg'),
              icon: 'success',
              confirmButtonColor: '#10b981'
            });
          },
          error: (err) => {
            Swal.fire({
              title: t('common.error'),
              text: err.error?.message || (this.langService.lang() === 'es' ? 'Error al actualizar el médico.' : 'Error updating doctor.'),
              icon: 'error',
              confirmButtonColor: '#ef4444'
            });
          }
        });
    } else {
      this.http.post(`${API_URL}/doctors`, payload, { headers: this.getHeaders() })
        .subscribe({
          next: () => {
            this.closeModal();
            this.loadDoctors();
            Swal.fire({
              title: t('doctors.messages.created'),
              text: t('doctors.messages.createdMsg'),
              icon: 'success',
              confirmButtonColor: '#10b981'
            });
          },
          error: (err) => {
            Swal.fire({
              title: t('common.error'),
              text: err.error?.message || (this.langService.lang() === 'es' ? 'Error al registrar el médico.' : 'Error creating doctor.'),
              icon: 'error',
              confirmButtonColor: '#ef4444'
            });
          }
        });
    }
  }

  viewProfile(doctor: DoctorItem) {
    const t = (k: string) => this.langService.translate(k);
    const specialtyName = doctor.Specialty?.name || t('doctors.specialist');
    const universityText = doctor.university || (this.langService.lang() === 'es' ? 'No registrada' : 'Not recorded');
    const degreeText = doctor.degreeTitle || 'Médico Cirujano';
    const mppsText = doctor.mppsNumber || (this.langService.lang() === 'es' ? 'No registrado' : 'Not recorded');
    const collegeText = doctor.collegeNumber ? `N° ${doctor.collegeNumber}` : (this.langService.lang() === 'es' ? 'No registrado' : 'Not recorded');
    const validUntilText = doctor.credentialsExpiryDate || (this.langService.lang() === 'es' ? 'Sin fecha' : 'No date');
    const alertLabel = this.langService.lang() === 'es' ? doctor.credentialStatus?.labelEs : doctor.credentialStatus?.labelEn;
    const alertClass = this.getAlertClass(doctor.credentialStatus);
    const feesText = doctor.chargesProfessionalFees !== false 
      ? (this.langService.lang() === 'es' ? 'Sí (Cobra Honorarios Profesionales)' : 'Yes (Charges Professional Fees)') 
      : (this.langService.lang() === 'es' ? 'No (Sueldo Fijo / Planta)' : 'No (Fixed Salary)');

    let additionalSpecsHtml = '';
    if (doctor.additionalSpecialties && doctor.additionalSpecialties.length > 0) {
      additionalSpecsHtml = `
        <div class="mb-2">
          <span class="text-muted d-block x-small mb-1">${this.langService.lang() === 'es' ? 'Otras Especialidades:' : 'Other Specialties:'}</span>
          <div>
            ${doctor.additionalSpecialties.map(s => `<span class="badge bg-light text-dark border me-1 mb-1">${s}</span>`).join('')}
          </div>
        </div>
      `;
    }

    Swal.fire({
      title: `<span class="fs-4 fw-bold">Dr. ${doctor.User.firstName} ${doctor.User.lastName}</span>`,
      html: `
        <div class="text-center mb-3">
          <img src="https://ui-avatars.com/api/?name=${doctor.User.firstName}+${doctor.User.lastName}&background=0ea5e9&color=fff&bold=true" 
               class="rounded-circle shadow-sm mb-2" width="90">
          <p class="text-primary fw-bold mb-0">${specialtyName}</p>
          <span class="text-muted small">${degreeText}</span>
          
          <div class="mt-2 mb-3 p-2 rounded-3 border ${alertClass}">
            <strong class="x-small d-block">${alertLabel}</strong>
            <span class="x-small text-muted">${this.langService.lang() === 'es' ? 'Vigencia hasta:' : 'Valid until:'} ${validUntilText}</span>
          </div>
          
          <div class="text-start bg-light p-3 rounded-3 small">
            <div class="d-flex justify-content-between mb-2 border-bottom pb-1">
              <span class="text-muted"><i class="bi bi-bank me-2"></i>${this.langService.lang() === 'es' ? 'Universidad:' : 'University:'}</span>
              <span class="fw-bold text-dark">${universityText}</span>
            </div>
            <div class="d-flex justify-content-between mb-2 border-bottom pb-1">
              <span class="text-muted"><i class="bi bi-card-checklist me-2"></i>Matrícula MPPS:</span>
              <span class="fw-bold text-dark">${mppsText}</span>
            </div>
            <div class="d-flex justify-content-between mb-2 border-bottom pb-1">
              <span class="text-muted"><i class="bi bi-award me-2"></i>Colegio de Médicos:</span>
              <span class="fw-bold text-dark">${collegeText}</span>
            </div>
            <div class="d-flex justify-content-between mb-2 border-bottom pb-1">
              <span class="text-muted"><i class="bi bi-envelope me-2"></i>${t('doctors.fields.email')}:</span>
              <span class="fw-bold text-dark">${doctor.User.email}</span>
            </div>
            <div class="d-flex justify-content-between mb-2 border-bottom pb-1">
              <span class="text-muted"><i class="bi bi-telephone me-2"></i>${t('doctors.fields.phone')}:</span>
              <span class="fw-bold text-dark">${doctor.phone || 'N/A'}</span>
            </div>
            <div class="d-flex justify-content-between mb-2 border-bottom pb-1">
              <span class="text-muted"><i class="bi bi-cash-stack me-2"></i>Honorarios:</span>
              <span class="fw-bold text-dark">${feesText}</span>
            </div>
            ${additionalSpecsHtml}
          </div>
        </div>
      `,
      showCloseButton: true,
      showConfirmButton: true,
      confirmButtonText: t('doctors.schedule'),
      confirmButtonColor: '#0ea5e9',
      customClass: {
        popup: 'rounded-4 border-0 shadow-lg'
      }
    }).then((result) => {
      if (result.isConfirmed) {
        this.scheduleAppointment(doctor);
      }
    });
  }

  scheduleAppointment(doctor: any) {
    this.router.navigate(['/appointments'], { queryParams: { doctorId: doctor.id } });
  }

  deleteDoctor(id: string) {
    const t = (k: string) => this.langService.translate(k);
    Swal.fire({
      title: t('doctors.messages.confirmDelete'),
      text: t('doctors.messages.confirmDeleteMsg'),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: t('doctors.messages.deleteConfirmBtn'),
      cancelButtonText: t('common.cancel')
    }).then((result) => {
      if (result.isConfirmed) {
        this.http.delete(`${API_URL}/doctors/${id}`, { headers: this.getHeaders() })
          .subscribe({
            next: () => {
              this.loadDoctors();
              Swal.fire(t('doctors.messages.deleted'), t('doctors.messages.deletedMsg'), 'success');
            },
            error: () => Swal.fire(t('common.error'), t('common.error'), 'error')
          });
      }
    });
  }
  
  toggleStatus(doctor: any) {
    const t = (k: string) => this.langService.translate(k);
    const actionKey = doctor.User.isActive ? 'common.deactivate' : 'common.activate';
    const action = t(actionKey);
    const status = doctor.User.isActive ? t('doctors.inactive') : t('doctors.active');
    
    Swal.fire({
      title: t('doctors.messages.toggleStatus').replace('{action}', action),
      text: t('doctors.messages.toggleStatusMsg').replace('{name}', `${doctor.User.firstName} ${doctor.User.lastName}`).replace('{status}', status.toLowerCase()),
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: doctor.User.isActive ? '#ef4444' : '#28a745',
      cancelButtonColor: '#64748b',
      confirmButtonText: `Sí, ${action}`,
      cancelButtonText: t('common.cancel')
    }).then((result) => {
      if (result.isConfirmed) {
        this.http.patch(`${API_URL}/doctors/${doctor.id}/toggle-status`, {}, { headers: this.getHeaders() })
          .subscribe({
            next: (response: any) => {
              this.loadDoctors();
              Swal.fire({
                title: t('common.success'),
                text: response.message,
                icon: 'success',
                timer: 2000,
                showConfirmButton: false
              });
            },
            error: (err) => {
              Swal.fire(t('common.error'), err.error?.message || t('common.error'), 'error');
            }
          });
      }
    });
  }
  
  toggleBypass(doctor: any) {
    const t = (k: string) => this.langService.translate(k);
    const actionKey = doctor.User.subscriptionBypass ? 'common.deactivate' : 'common.activate';
    const action = t(actionKey);
    const action2 = doctor.User.subscriptionBypass 
      ? (this.langService.lang() === 'es' ? 'dejará de saltar' : 'will no longer bypass')
      : (this.langService.lang() === 'es' ? 'saltará' : 'will bypass');

    Swal.fire({
      title: t('doctors.messages.toggleBypass').replace('{action}', action),
      text: t('doctors.messages.toggleBypassMsg').replace('{name}', `${doctor.User.firstName} ${doctor.User.lastName}`).replace('{action2}', action2),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#f59e0b',
      cancelButtonColor: '#64748b',
      confirmButtonText: `Sí, ${action}`,
      cancelButtonText: t('common.cancel')
    }).then((result) => {
      if (result.isConfirmed) {
        this.http.patch(`${API_URL}/doctors/${doctor.id}/toggle-bypass`, {}, { headers: this.getHeaders() })
          .subscribe({
            next: (response: any) => {
              this.loadDoctors();
              Swal.fire({
                title: 'VIP',
                text: response.message,
                icon: 'success',
                timer: 2000,
                showConfirmButton: false
              });
            },
            error: (err) => {
              Swal.fire(t('common.error'), err.error?.message || t('common.error'), 'error');
            }
          });
      }
    });
  }
}
