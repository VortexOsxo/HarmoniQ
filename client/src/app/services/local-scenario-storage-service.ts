import { Injectable } from '@angular/core';
import { Scenario } from '@app/models/scenario';

const SCENARIOS_KEY = 'harmoniq_local_scenarios';

@Injectable({
    providedIn: 'root',
})
export class LocalScenarioStorageService {
    loadScenarios(): Scenario[] {
        const saved = localStorage.getItem(SCENARIOS_KEY);
        if (!saved) return [];
        try {
            return JSON.parse(saved);
        } catch {
            return [];
        }
    }

    createScenario(scenario: Scenario): Scenario {
        const scenarios = this.loadScenarios();
        scenario.id = Date.now();
        scenarios.push(scenario);
        this.saveScenarios(scenarios);
        return scenario;
    }

    deleteScenario(id: number): void {
        const scenarios = this.loadScenarios().filter(s => s.id !== id);
        this.saveScenarios(scenarios);
    }

    private saveScenarios(scenarios: Scenario[]): void {
        localStorage.setItem(SCENARIOS_KEY, JSON.stringify(scenarios));
    }
}
