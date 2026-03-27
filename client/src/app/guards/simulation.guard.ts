import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ScenariosService } from '@app/services/scenarios-service';
import { InfrastruturesService } from '@app/services/infrastrutures-service';

export const simulationGuard: CanActivateFn = () => {
    const scenariosService = inject(ScenariosService);
    const infrastructuresService = inject(InfrastruturesService);
    const router = inject(Router);

    const ready =
        scenariosService.selectedScenario() !== null &&
        infrastructuresService.selectedInfraGroup() !== null;

    return ready || router.createUrlTree(['/map']);
};
