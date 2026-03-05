import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Guard: firstLoginGuard
 *
 * Propósito: Bloquea la navegación a cualquier ruta protegida cuando el usuario
 * tiene la bandera `mustChangePassword === true`. En ese caso, redirige al
 * componente de cambio de contraseña obligatorio (`/change-password-first`).
 *
 * Uso: Se aplica como canActivate adicional a todas las rutas protegidas,
 * junto con authGuard, en app.routes.ts.
 */
export const firstLoginGuard = () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (authService.mustChangePasswordNow()) {
        router.navigate(['/change-password-first']);
        return false;
    }

    return true;
};
