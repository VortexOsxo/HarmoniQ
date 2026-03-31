import { Scenario } from "../scenario";

export interface SimulationStep {
    getStepName(): string;
    generate(scenario: Scenario): Promise<void>;
}