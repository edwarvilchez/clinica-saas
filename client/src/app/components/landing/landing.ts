import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './landing.html',
  styleUrl: './landing.css'
})
export class LandingComponent {
  features = [
    {
      icon: 'bi-calendar-check',
      title: 'Gestión de Citas',
      description: 'Calendario inteligente para organizar consultas de forma eficiente y evitar sobreposiciones.'
    },
    {
      icon: 'bi-camera-video',
      title: 'Videoconsultas HD',
      description: 'Tecnología WebRTC integrada para consultas médicas a distancia con alta calidad y seguridad.'
    },
    {
      icon: 'bi-file-earmark-medical',
      title: 'Historias Médicas',
      description: 'Expedientes digitales completos con antecedentes, diagnósticos y tratamientos.'
    },
    {
      icon: 'bi-person-badge',
      title: 'Control de Médicos',
      description: 'Gestión de roles y permisos para todo el personal clínico de manera centralizada.'
    },
    {
      icon: 'bi-credit-card',
      title: 'Pagos y Facturación',
      description: 'Módulo integrado para el control de cobros, planes de suscripción y reportes financieros.'
    },
    {
      icon: 'bi-palette',
      title: 'Imagen Corporativa',
      description: 'Personaliza la plataforma con el logo y colores de tu clínica para una marca sólida.'
    }
  ];

  testimonials = [
    {
      name: 'Dr. Alejandro Ruiz',
      role: 'Director Médico',
      comment: 'Clínica SaaS transformó la operativa de nuestra clínica. La videoconsulta es fluida y fácil de usar.'
    },
    {
      name: 'Lic. María Elena',
      role: 'Administradora',
      comment: 'El control de suscripciones y pagos nos ahorró horas de trabajo manual cada mes.'
    }
  ];
}
