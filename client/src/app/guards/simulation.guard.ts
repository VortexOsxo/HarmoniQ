import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SimulationService } from '@app/services/simulation-service';

export const simulationGuard: CanActivateFn = () => {
    const simulationService = inject(SimulationService);
    const router = inject(Router);

    return simulationService.launchRequested() || router.createUrlTree(['/map']);
};
