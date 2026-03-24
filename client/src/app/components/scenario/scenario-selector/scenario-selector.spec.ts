import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ScenarioSelector } from './scenario-selector';
import { ScenariosService } from '@app/services/scenarios-service';
import { TutorialService } from '@app/services/tutorial-service';
import { Scenario } from '@app/models/scenario';
import { Weather } from '@app/models/weather';
import { Consumption } from '@app/models/consumption';

const DEFAULT_SCENARIO_2035: Scenario = {
    id: 1,
    nom: 'année 2035',
    description: "Scénario de base pour l'année 2035",
    date_de_debut: '2035-01-01T00:00:00',
    date_de_fin: '2035-12-31T00:00:00',
    pas_de_temps: 'PT1H',
    weather: Weather.Typical,
    consomation: Consumption.Normal,
};

const CUSTOM_SCENARIO: Scenario = {
    id: 999,
    nom: 'Mon Scénario',
    description: 'Custom',
    date_de_debut: '2030-01-01T00:00:00',
    date_de_fin: '2030-12-31T00:00:00',
    pas_de_temps: 'PT1H',
    weather: Weather.Hot,
    consomation: Consumption.Conservative,
};

const mockModalService = {
    open: vi.fn().mockReturnValue({ componentInstance: {}, result: Promise.resolve(null) }),
};

const mockTutorialService = { currentState: { currentStep: 0 } };

describe('ScenarioSelector', () => {
    let mockScenariosService: {
        scenarios: ReturnType<typeof signal<Scenario[]>>;
        selectedScenario: ReturnType<typeof signal<Scenario | null>>;
        deleteScenario: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
        mockScenariosService = {
            scenarios: signal([DEFAULT_SCENARIO_2035, CUSTOM_SCENARIO]),
            selectedScenario: signal<Scenario | null>(null),
            deleteScenario: vi.fn(),
        };
    });

    afterEach(() => vi.clearAllMocks());

    const renderComponent = () =>
        render(ScenarioSelector, {
            providers: [
                { provide: ScenariosService, useValue: mockScenariosService },
                { provide: NgbModal, useValue: mockModalService },
                { provide: TutorialService, useValue: mockTutorialService },
            ],
            schemas: [NO_ERRORS_SCHEMA],
        });

    it('should render the scenario selector with the active scenario label', async () => {
        await renderComponent();

        expect(screen.getByText(/SCÉNARIO ACTIF/i)).toBeInTheDocument();
    });

    describe('scenarios list', () => {
        it('should render all scenarios as select options', async () => {
            await renderComponent();

            expect(screen.getByRole('option', { name: 'année 2035' })).toBeInTheDocument();
            expect(screen.getByRole('option', { name: 'Mon Scénario' })).toBeInTheDocument();
        });

        it('should render exactly 2 options', async () => {
            await renderComponent();

            expect(screen.getAllByRole('option')).toHaveLength(2);
        });
    });

    describe('openModal', () => {
        it('should call modalService.open when the add button is clicked', async () => {
            const user = userEvent.setup();
            await renderComponent();

            await user.click(screen.getByTitle(/Créer un nouveau scénario/i));

            expect(mockModalService.open).toHaveBeenCalled();
        });
    });

    describe('deleteScenario', () => {
        it('should call scenariosService.deleteScenario with the selected scenario when delete button is clicked', async () => {
            const user = userEvent.setup();
            mockScenariosService.selectedScenario.set(CUSTOM_SCENARIO);

            await renderComponent();

            await user.click(screen.getByRole('button', { name: /Supprimer/i }));

            expect(mockScenariosService.deleteScenario).toHaveBeenCalledWith(CUSTOM_SCENARIO);
        });

        it('should not show the delete button when the selected scenario id is 1', async () => {
            mockScenariosService.selectedScenario.set(DEFAULT_SCENARIO_2035);

            await renderComponent();

            expect(screen.queryByRole('button', { name: /Supprimer/i })).not.toBeInTheDocument();
        });
    });

    describe('compareScenarios', () => {
        it('should return true when two scenarios have the same id', async () => {
            const { fixture } = await renderComponent();
            const component = fixture.componentInstance;

            expect(
                component.compareScenarios(DEFAULT_SCENARIO_2035, { ...DEFAULT_SCENARIO_2035 }),
            ).toBe(true);
        });

        it('should return false when two scenarios have different ids', async () => {
            const { fixture } = await renderComponent();
            const component = fixture.componentInstance;

            expect(component.compareScenarios(DEFAULT_SCENARIO_2035, CUSTOM_SCENARIO)).toBe(false);
        });
    });
});
