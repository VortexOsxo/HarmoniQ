import { signal, Injectable, computed } from '@angular/core';
import { SimulationStep } from '@app/models/interfaces/simulation-step';
import { Scenario } from '@app/models/scenario';

export type StepStatusValue = 'pending' | 'loading' | 'completed';

export interface StepStatus {
    name: string;
    status: StepStatusValue;
}

@Injectable({
    providedIn: 'root',
})
export class SimulationStepService {
    steps = signal<StepStatus[]>([]);
    currentStepIndex = signal<number>(-1);

    currentStepName = computed(() => {
        const index = this.currentStepIndex();
        const allSteps = this.steps();

        if (index === -1) return 'Initialisation';
        if (index >= 0 && index < allSteps.length) {
            return allSteps[index].name;
        }
        return 'Simulation terminée';
    });

    async runSteps(simulationSteps: SimulationStep[], scenario: Scenario) {
        this.steps.set(simulationSteps.map(s => ({
            name: s.getStepName(),
            status: 'pending'
        })));
        this.currentStepIndex.set(-1);

        for (let i = 0; i < simulationSteps.length; i++) {
            this.currentStepIndex.set(i);
            this.updateStepStatus(i, 'loading');

            await simulationSteps[i].generate(scenario);
            this.updateStepStatus(i, 'completed');
        }

        this.currentStepIndex.set(simulationSteps.length);
    }

    private updateStepStatus(index: number, status: StepStatusValue) {
        this.steps.update(steps => {
            const newSteps = [...steps];
            if (newSteps[index]) {
                newSteps[index] = { ...newSteps[index], status };
            }
            return newSteps;
        });
    }
}
