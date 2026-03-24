vi.mock('plotly.js-dist-min', () => ({
    default: {
        newPlot: vi.fn(),
        purge: vi.fn(),
        downloadImage: vi.fn(),
    },
    newPlot: vi.fn(),
    purge: vi.fn(),
    downloadImage: vi.fn(),
}));

vi.mock('leaflet', () => ({
    default: {
        icon: vi.fn().mockReturnValue({}),
        map: vi.fn().mockReturnValue({}),
        marker: vi.fn().mockReturnValue({ addTo: vi.fn(), setIcon: vi.fn(), on: vi.fn() }),
        circleMarker: vi.fn().mockReturnValue({
            addTo: vi.fn(),
            setStyle: vi.fn(),
            bindPopup: vi.fn().mockReturnThis(),
        }),
        polyline: vi.fn().mockReturnValue({
            addTo: vi.fn(),
            setStyle: vi.fn(),
            bindPopup: vi.fn().mockReturnThis(),
        }),
    },
    icon: vi.fn().mockReturnValue({}),
    map: vi.fn().mockReturnValue({}),
    marker: vi.fn().mockReturnValue({ addTo: vi.fn(), setIcon: vi.fn(), on: vi.fn() }),
    circleMarker: vi.fn().mockReturnValue({
        addTo: vi.fn(),
        setStyle: vi.fn(),
        bindPopup: vi.fn().mockReturnThis(),
    }),
    polyline: vi.fn().mockReturnValue({
        addTo: vi.fn(),
        setStyle: vi.fn(),
        bindPopup: vi.fn().mockReturnThis(),
    }),
}));

import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { SimulationTemporalGraphService } from './simulation-temporal-graph-service';
import { ScenariosService } from '../scenarios-service';
import { InfrastruturesService } from '../infrastrutures-service';
import { GraphService } from '@app/services/graph-service';
import { Scenario } from '@app/models/scenario';
import { Weather } from '@app/models/weather';
import { Consumption } from '@app/models/consumption';
import { signal } from '@angular/core';

const MOCK_SCENARIO: Scenario = {
    id: 1,
    nom: 'Test 2035',
    description: '',
    date_de_debut: '2035-01-01T00:00:00',
    date_de_fin: '2035-12-31T00:00:00',
    pas_de_temps: 'PT1H',
    weather: Weather.Typical,
    consomation: Consumption.Normal,
};

const MOCK_SCENARIO_2: Scenario = { ...MOCK_SCENARIO, id: 2 };

const MOCK_SIMULATION_RESPONSE = {
    production: [
        {
            snapshot: '2035-01-01T00:00:00',
            totale: 5000,
            total_eolien: 1000,
            total_solaire: 500,
            total_hydro_fil: 2000,
            total_hydro_reservoir: 1000,
            total_nucleaire: 0,
            total_thermique: 0,
            total_import: 500,
        },
    ],
};

const MOCK_DEMANDE_RESPONSE = {
    total_electricity: { '2035-01-01T00:00:00': 4_800_000 },
};

const RESEAU_ENDPOINT = 'http://localhost:5000/api/reseau/production?is_journalier=false';
const DEMANDE_ENDPOINT = 'http://localhost:5000/api/demande/temporal';

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('SimulationTemporalGraphService', () => {
    let service: SimulationTemporalGraphService;
    let httpMock: HttpTestingController;
    let mockGraphService: Partial<GraphService>;
    let mockScenariosService: Partial<ScenariosService>;
    let mockInfrastruturesService: Partial<InfrastruturesService>;

    beforeEach(() => {
        const el = document.createElement('div');
        el.id = 'temporal-simulation-id';
        document.body.appendChild(el);

        mockGraphService = {
            aggregateData: vi.fn().mockReturnValue({ x: [], y: [] }),
            getStandardTrace: vi.fn().mockReturnValue({
                x: [],
                y: [],
                type: 'scatter',
                line: { shape: 'spline', color: '#000', width: 4 },
                fill: 'tozeroy',
                fillcolor: 'rgba(0,0,0,0.1)',
                hovertemplate: '',
            }),
            getStandardLayout: vi.fn().mockReturnValue({}),
        };

        mockScenariosService = {
            selectedScenario: vi.fn().mockReturnValue(MOCK_SCENARIO) as any,
        };

        mockInfrastruturesService = {
            buildSimulationPayload: vi
                .fn()
                .mockReturnValue({ nom: 'Test Group', parc_eoliens: [] }),
        };

        TestBed.configureTestingModule({
            providers: [
                SimulationTemporalGraphService,
                { provide: ScenariosService, useValue: mockScenariosService },
                { provide: InfrastruturesService, useValue: mockInfrastruturesService },
                { provide: GraphService, useValue: mockGraphService },
                provideHttpClient(),
                provideHttpClientTesting(),
            ],
        });

        service = TestBed.inject(SimulationTemporalGraphService);
        httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => {
        httpMock.verify();
        vi.clearAllMocks();
        document.getElementById('temporal-simulation-id')?.remove();
    });

    describe('getStepName', () => {
        it('should return a non-empty string', () => {
            expect(service.getStepName()).toBeTruthy();
        });
    });

    describe('generate', () => {
        it('should POST to both the réseau production and demande temporal endpoints', async () => {
            const generatePromise = service.generate(MOCK_SCENARIO);

            httpMock.expectOne(RESEAU_ENDPOINT).flush(MOCK_SIMULATION_RESPONSE);
            await tick();
            httpMock.expectOne(DEMANDE_ENDPOINT).flush(MOCK_DEMANDE_RESPONSE);

            await generatePromise;
        });

        it('should store the simulation result in cachedSimulationResult', async () => {
            const generatePromise = service.generate(MOCK_SCENARIO);
            httpMock.expectOne(RESEAU_ENDPOINT).flush(MOCK_SIMULATION_RESPONSE);
            await tick();
            httpMock.expectOne(DEMANDE_ENDPOINT).flush(MOCK_DEMANDE_RESPONSE);
            await generatePromise;

            expect(service.getCachedSimulationResult()).toEqual(MOCK_SIMULATION_RESPONSE);
        });

        it('should store the demande result in cachedDemandeResult', async () => {
            const generatePromise = service.generate(MOCK_SCENARIO);
            httpMock.expectOne(RESEAU_ENDPOINT).flush(MOCK_SIMULATION_RESPONSE);
            await tick();
            httpMock.expectOne(DEMANDE_ENDPOINT).flush(MOCK_DEMANDE_RESPONSE);
            await generatePromise;

            expect(service.getCachedDemandeResult()).toEqual(MOCK_DEMANDE_RESPONSE);
        });

        it('should use cached data for the same scenario on repeated calls', async () => {
            const first = service.generate(MOCK_SCENARIO);
            httpMock.expectOne(RESEAU_ENDPOINT).flush(MOCK_SIMULATION_RESPONSE);
            await tick();
            httpMock.expectOne(DEMANDE_ENDPOINT).flush(MOCK_DEMANDE_RESPONSE);
            await first;

            const second = service.generate(MOCK_SCENARIO);
            httpMock.expectNone(RESEAU_ENDPOINT);
            await second;
        });

        it('should make new HTTP requests when scenario id changes', async () => {
            const first = service.generate(MOCK_SCENARIO);
            httpMock.expectOne(RESEAU_ENDPOINT).flush(MOCK_SIMULATION_RESPONSE);
            await tick();
            httpMock.expectOne(DEMANDE_ENDPOINT).flush(MOCK_DEMANDE_RESPONSE);
            await first;

            const second = service.generate(MOCK_SCENARIO_2);
            httpMock.expectOne(RESEAU_ENDPOINT).flush(MOCK_SIMULATION_RESPONSE);
            await tick();
            httpMock.expectOne(DEMANDE_ENDPOINT).flush(MOCK_DEMANDE_RESPONSE);
            await second;
        });
    });

    describe('getProductionNodes', () => {
        it('should return an empty array when no cached data exists', () => {
            expect(service.getProductionNodes()).toEqual([]);
        });

        it('should return production nodes with averaged values from cached data', async () => {
            const generatePromise = service.generate(MOCK_SCENARIO);
            httpMock.expectOne(RESEAU_ENDPOINT).flush(MOCK_SIMULATION_RESPONSE);
            await tick();
            httpMock.expectOne(DEMANDE_ENDPOINT).flush(MOCK_DEMANDE_RESPONSE);
            await generatePromise;

            const nodes = service.getProductionNodes();
            expect(nodes.length).toBeGreaterThan(0);
            expect(nodes.find((n) => n.id === 'hydraulique')).toBeDefined();
        });
    });
});
