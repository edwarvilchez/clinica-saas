import { isDevMode } from '@angular/core';
import packageInfo from '../../package.json';

export const APP_VERSION = packageInfo.version;

// En producción, si el API está en el mismo dominio o gestionado por el mismo host
// podemos usar una URL relativa o la URL específica de EasyPanel.
// Por defecto, asumimos que en producción el API estará en el subdominio 'api'
// o simplemente cambiamos localhost por el host actual.

const getBaseUrl = (): string => {
  if (typeof window === 'undefined') return 'http://localhost:5000';
  
  const host = window.location.hostname;
  
  // 1. Entorno de Desarrollo Local
  if (host === 'localhost' || host === '127.0.0.1') {
    return 'http://localhost:5000';
  }
  
  // 2. Entorno Vercel / Monorepo (Rutas relativas dentro del mismo dominio)
  // Detecta subdominios de despliegue de Vercel o el nombre base del proyecto
  if (host.includes('vercel.app') || host.includes('clinica-888')) {
    return ''; // Uso de rutas relativas (/api/...)
  }

  // 3. Dominio Oficial MedicalCare 888
  if (host.includes('medicalcare-888.com')) {
    return 'https://api.medicalcare-888.com';
  }

  // Por defecto para cualquier otro entorno de producción, usamos rutas relativas
  return '';
};

export const BASE_URL = getBaseUrl();
export const API_URL = `${BASE_URL}/api`;
export const SOCKET_URL = BASE_URL || 'http://localhost:5000';

// Exponer para debug en consola
if (typeof window !== 'undefined') {
  (window as any).ClinicaSaaS_API_URL = API_URL;
  (window as any).ClinicaSaaS_BASE_URL = BASE_URL;
}
