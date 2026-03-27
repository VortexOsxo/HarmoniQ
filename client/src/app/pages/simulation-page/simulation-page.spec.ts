import { render, screen } from '@testing-library/angular';
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { SimulationPage } from './simulation-page';
import { SimulationService } from '@app/services/simulation-service';
import { SimulationStepService } from '@app/services/simulation-step-service';

vi.mock('leaflet', () => ({
    default: { icon: vi.fn().mockReturnValue({}), divIcon: vi.fn().mockReturnValue({}) },
    icon: vi.fn().mockReturnValue({}),
    divIcon: vi.fn().mockReturnValue({}),
}));

vi.mock('plotly.js-dist-min', () => ({
    newPlot: vi.fn(),
    purge: vi.fn(),
    downloadImage: vi.fn(),
}));

const mockSimulationService = {
    launchSimulation: vi.fn(),
    canLaunch: signal(false),
    productionNodes: signal(null),
    openSourcesPanel$: new Subject<void>(),
    hasExportableData: signal(false),
    launchSimulationSingleInfra: vi.fn().mockReturnValue(null),
    getInfraCost: vi.fn().mockReturnValue(null),
    getInfraEmission: vi.fn().mockReturnValue(null),
    exportSimulationToCSV: vi.fn(),
};

const mockStepService = {
    steps: signal([] as any[]),
    currentStepIndex: signal(-1),
    currentStepName: signal('Initialisation'),
    runSteps: vi.fn(),
};

const STUB_TEMPLATE = `<div data-testid="simulation-page">Simulation Page</div>`;

async function renderComponent() {
    TestBed.overrideComponent(SimulationPage, {
        set: { template: STUB_TEMPLATE, imports: [CommonModule] },
    });

    return render(SimulationPage, {
        providers: [
            { provide: SimulationService, useValue: mockSimulationService },
            { provide: SimulationStepService, useValue: mockStepService },
        ],
        schemas: [NO_ERRORS_SCHEMA],
    });
}

describe('SimulationPage', () => {
    afterEach(() => vi.restoreAllMocks());

    it('should render the simulation page component', async () => {
        await renderComponent();
        expect(screen.getByTestId('simulation-page')).toBeInTheDocument();
    });

    it('should have simulationService and stepService injected', async () => {
        const { fixture } = await renderComponent();
        const component = fixture.componentInstance;
        expect(component.simulationService).toBeDefined();
        expect(component.stepService).toBeDefined();
    });

    describe('ngAfterViewInit', () => {
        it('should call simulationService.launchSimulation on init', async () => {
            await renderComponent();
            expect(mockSimulationService.launchSimulation).toHaveBeenCalled();
        });
    });

    describe('scrollToGraph', () => {
        it('should call scrollIntoView when element exists', async () => {
            const { fixture } = await renderComponent();
            const mockElement = { scrollIntoView: vi.fn() };
            vi.spyOn(document, 'getElementById').mockReturnValue(mockElement as any);

            fixture.componentInstance.scrollToGraph(0);

            expect(mockElement.scrollIntoView).toHaveBeenCalledWith({
                behavior: 'smooth',
                block: 'start',
            });
        });

        it('should not throw when element does not exist', async () => {
            const { fixture } = await renderComponent();
            vi.spyOn(document, 'getElementById').mockReturnValue(null);

            expect(() => fixture.componentInstance.scrollToGraph(99)).not.toThrow();
        });
    });
});
