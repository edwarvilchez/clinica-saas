import { Pipe, PipeTransform } from '@angular/core';
import { LanguageService } from './language.service';

/**
 * Pipe de traducción reactivo con soporte para parámetros dinámicos.
 * Uso: {{ 'key' | translate }} o {{ 'key' | translate:{ var: value } }}
 */
@Pipe({
  name: 'translate',
  standalone: true,
  pure: false // Necesario para reaccionar al cambio de señal del LanguageService
})
export class TranslatePipe implements PipeTransform {
  constructor(private langService: LanguageService) {}

  transform(path: string, params?: Record<string, any>): string {
    let translation = this.langService.translate(path);

    if (params && translation !== path) {
      Object.keys(params).forEach(key => {
        const value = params[key];
        // Reemplaza {{key}} por el valor proporcionado
        translation = translation.replace(`{{${key}}}`, value?.toString() || '');
      });
    }

    return translation;
  }
}
