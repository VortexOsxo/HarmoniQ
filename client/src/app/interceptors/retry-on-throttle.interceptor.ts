import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { tap } from 'rxjs/operators';
import { SnackbarService } from '@app/services/snackbar-service';

export const throttleInterceptor: HttpInterceptorFn = (req, next) => {
    const snackbar = inject(SnackbarService);

    return next(req).pipe(
        tap({
            error: (error) => {
                if (error.status === 429) {
                    snackbar.show(
                        'Trop de requêtes',
                        'Le serveur est occupé. Veuillez patienter quelques instants avant de réessayer.',
                        'info',
                    );
                }
            },
        }),
    );
};
