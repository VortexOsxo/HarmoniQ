vi.mock('plotly.js-dist-min', () => ({
    newPlot: vi.fn(),
    purge: vi.fn(),
    register: vi.fn(),
    setPlotConfig: vi.fn(),
    downloadImage: vi.fn(),
    default: {
        newPlot: vi.fn(),
        purge: vi.fn(),
        register: vi.fn(),
        setPlotConfig: vi.fn(),
        downloadImage: vi.fn(),
    },
}));

vi.mock('leaflet', () => ({
    default: {
        icon: vi.fn().mockReturnValue({}),
        map: vi.fn().mockReturnValue({}),
        circleMarker: vi.fn().mockReturnValue({ bindPopup: vi.fn().mockReturnThis(), addTo: vi.fn().mockReturnThis(), setStyle: vi.fn().mockReturnThis() }),
        polyline: vi.fn().mockReturnValue({ bindPopup: vi.fn().mockReturnThis(), addTo: vi.fn().mockReturnThis(), setStyle: vi.fn().mockReturnThis() }),
        divIcon: vi.fn().mockReturnValue({ options: {} }),
        point: vi.fn((x: number, y: number) => ({ x, y })),
    },
    icon: vi.fn().mockReturnValue({}),
    map: vi.fn().mockReturnValue({}),
    circleMarker: vi.fn().mockReturnValue({ bindPopup: vi.fn().mockReturnThis(), addTo: vi.fn().mockReturnThis(), setStyle: vi.fn().mockReturnThis() }),
    polyline: vi.fn().mockReturnValue({ bindPopup: vi.fn().mockReturnThis(), addTo: vi.fn().mockReturnThis(), setStyle: vi.fn().mockReturnThis() }),
    divIcon: vi.fn().mockReturnValue({ options: {} }),
    point: vi.fn((x: number, y: number) => ({ x, y })),
}));

import { TestBed } from '@angular/core/testing';
import { SimulationAnalysisGraphService } from './simulation-analysis-graph-service';
import { InfrastruturesService } from '../infrastrutures-service';
import { DemandeSankeyGraphService } from './demande-sankey-graph-service';
import { signal } from '@angular/core';


const MOCK_PRODUCTION = [
    {
        snapshot: '2035-01-01T00:00:00',
        total_eolien: 1000,
        total_solaire: 500,
        total_hydro_fil: 2000,
        total_hydro_reservoir: 1000,
        total_nucleaire: 0,
        total_thermique: 0,
        total_import: 500,
    },
    {
        snapshot: '2035-01-01T01:00:00',
        total_eolien: 1100,
        total_solaire: 600,
        total_hydro_fil: 1900,
        total_hydro_reservoir: 1100,
        total_nucleaire: 0,
        total_thermique: 0,
        total_import: 300,
    },
];

const MOCK_SIM_RESULT = { production: MOCK_PRODUCTION };

describe('SimulationAnalysisGraphService', () => {
    let service: SimulationAnalysisGraphService;
    let mockInfrastruturesService: Partial<InfrastruturesService>;
    let mockDemandeSankeyService: Partial<DemandeSankeyGraphService>;

    const setupDom = () => {
        ['prod-donut-id', 'demand-donut-id', 'prod-top10-id', 'seasonal-id'].forEach((id) => {
            const el = document.createElement('div');
            el.id = id;
            document.body.appendChild(el);
        });
    };

    const removeDom = () => {
        ['prod-donut-id', 'demand-donut-id', 'prod-top10-id', 'seasonal-id'].forEach((id) => {
            document.getElementById(id)?.remove();
        });
    };

    beforeEach(() => {
        mockInfrastruturesService = {
            selectedInfraGroup: signal(null) as any,
            getInfrasSignalByType: vi.fn().mockReturnValue(signal([])),
        };

        mockDemandeSankeyService = {
            demandNodes: signal([]) as any,
        };

        TestBed.configureTestingModule({
            providers: [
                SimulationAnalysisGraphService,
                { provide: InfrastruturesService, useValue: mockInfrastruturesService },
                { provide: DemandeSankeyGraphService, useValue: mockDemandeSankeyService },
            ],
        });

        service = TestBed.inject(SimulationAnalysisGraphService);
    });

    afterEach(() => {
        vi.clearAllMocks();
        removeDom();
    });

    describe('initial state', () => {
        it('should start with isLoading true', () => {
            expect(service.isLoading()).toBe(true);
        });
    });

    describe('reset', () => {
        it('should set isLoading back to true', () => {
            service.isLoading.set(false);
            service.reset();
            expect(service.isLoading()).toBe(true);
        });

        it('should not throw when graph elements do not exist in DOM', () => {
            expect(() => service.reset()).not.toThrow();
        });

        it('should not throw when graph elements exist in DOM', () => {
            setupDom();
            expect(() => service.reset()).not.toThrow();
        });
    });

    describe('update', () => {
        it('should not throw and set isLoading false when DOM elements exist', () => {
            setupDom();
            expect(() => service.update(MOCK_SIM_RESULT)).not.toThrow();
            expect(service.isLoading()).toBe(false);
        });

        it('should return early when production is empty', () => {
            service.update({ production: [] });
            expect(service.isLoading()).toBe(true);
        });

        it('should return early when production is missing', () => {
            service.update({});
            expect(service.isLoading()).toBe(true);
        });

        it('should set isLoading to false even when no DOM elements exist', () => {
            service.update(MOCK_SIM_RESULT);
            expect(service.isLoading()).toBe(false);
        });
    });
});
