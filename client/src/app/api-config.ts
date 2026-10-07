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
  
  // 2. Entorno de Producción VPS (Rutas relativas bajo Nginx / Reverse Proxy)
  return '';
};

const getSocketUrl = (): string => {
  if (typeof window === 'undefined') return 'http://localhost:5000';
  
  const baseUrl = getBaseUrl();
  // Si BASE_URL es vacío (relativo), usamos el origen de la ventana actual
  if (!baseUrl) {
    return window.location.origin;
  }
  
  return baseUrl;
};

export const BASE_URL = getBaseUrl();
export const API_URL = `${BASE_URL}/api`;
export const SOCKET_URL = getSocketUrl();

// Exponer para debug en consola
if (typeof window !== 'undefined') {
  (window as any).ClinicaSaaS_API_URL = API_URL;
  (window as any).ClinicaSaaS_BASE_URL = BASE_URL;
}
