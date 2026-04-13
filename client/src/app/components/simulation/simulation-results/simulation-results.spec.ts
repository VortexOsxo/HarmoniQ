import { render } from '@testing-library/angular';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { SimulationResults } from './simulation-results';
import { ProtectedAreasService } from '@app/services/protected-areas-service';
import { ReseauService } from '@app/services/reseau-service';
import { TutorialService, TutorialState } from '@app/services/tutorial-service';
import { InfraDetailService } from '@app/services/infra-detail-service';
import { MapService } from '@app/services/map-service';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { WindMapService } from '@app/services/wind-map-service';

vi.mock('leaflet.markercluster', () => ({}));
vi.mock('leaflet', () => ({
    default: {
        icon: vi.fn().mockReturnValue({}),
        divIcon: vi.fn().mockReturnValue({}),
        map: vi
            .fn()
            .mockReturnValue({
                setView: vi.fn(),
                remove: vi.fn(),
                addLayer: vi.fn(),
                on: vi.fn(),
                invalidateSize: vi.fn(),
            }),
        tileLayer: vi.fn().mockReturnValue({ addTo: vi.fn() }),
        layerGroup: vi.fn().mockReturnValue({ addTo: vi.fn(), clearLayers: vi.fn() }),
        geoJSON: vi.fn().mockReturnValue({ addTo: vi.fn() }),
        marker: vi.fn().mockReturnValue({ addTo: vi.fn(), remove: vi.fn() }),
    },
    icon: vi.fn().mockReturnValue({}),
    divIcon: vi.fn().mockReturnValue({}),
    map: vi
        .fn()
        .mockReturnValue({
            setView: vi.fn(),
            remove: vi.fn(),
            addLayer: vi.fn(),
            on: vi.fn(),
            invalidateSize: vi.fn(),
        }),
    tileLayer: vi.fn().mockReturnValue({ addTo: vi.fn() }),
    layerGroup: vi.fn().mockReturnValue({ addTo: vi.fn(), clearLayers: vi.fn() }),
    geoJSON: vi.fn().mockReturnValue({ addTo: vi.fn() }),
    marker: vi.fn().mockReturnValue({ addTo: vi.fn(), remove: vi.fn() }),
}));

const isDetailOpen = signal(false);

const mockProtectedAreasService = {
    isVisible: signal(false),
    hide: vi.fn(),
    destroy: vi.fn(),
    initLayer: vi.fn(),
};

const mockReseauService = {
    isVisible: signal(false),
    destroy: vi.fn(),
    initLayer: vi.fn(),
};

const tutorialState$ = new BehaviorSubject<TutorialState>({
    active: false,
    currentStep: 0,
    showWelcome: false,
});

const mockTutorialService = {
    tutorialState$,
    autoStart: vi.fn(),
};

const mockInfraDetailService = {
    isOpen: isDetailOpen,
    selectedInfra: signal(null),
    closeDetail: vi.fn(),
};

const mockWindMapService = {
    isWindMode: signal(false),
    isLoading: signal(false),
    errorMessage: signal<string | null>(null),
    availableYears: signal<number[]>([2024]),
    selectedYear: signal<number | null>(2024),
    toggleWindMode: vi.fn(),
    setYear: vi.fn(),
    disableWindMode: vi.fn(),
};

const mockMapService = {
    mapFilterName: signal(''),
    mapFilterTypes: signal(new Set()),
    mapFilterMinPower: signal(null),
    mapFilterMaxPower: signal(null),
    showRealInfra: signal(true),
    showUserInfra: signal(true),
    hasSelection: signal(true),
    reloadMarkers: vi.fn(),
    createMap: vi.fn(),
    destroyMap: vi.fn(),
    initMarkers: vi.fn(),
    destroyMarkers: vi.fn(),
    onMapLoaded: vi.fn(),
    toggleVisibility: vi.fn(),
    selectAll: vi.fn(),
    deselectAll: vi.fn(),
};

const mockNgbModal = {
    open: vi.fn(),
};

const providers = [
    { provide: ProtectedAreasService, useValue: mockProtectedAreasService },
    { provide: ReseauService, useValue: mockReseauService },
    { provide: TutorialService, useValue: mockTutorialService },
    { provide: InfraDetailService, useValue: mockInfraDetailService },
    { provide: WindMapService, useValue: mockWindMapService },
    { provide: MapService, useValue: mockMapService },
    { provide: NgbModal, useValue: mockNgbModal },
];

async function renderComponent() {
    TestBed.overrideComponent(SimulationResults, {
        set: { template: '<div class="simulation-results"></div>', imports: [] },
    });
    return render(SimulationResults, { providers });
}

describe('SimulationResults', () => {
    beforeEach(() => {
        isDetailOpen.set(false);
        tutorialState$.next({ active: false, currentStep: 0, showWelcome: false });
        mockWindMapService.isWindMode.set(false);
    });

    afterEach(() => vi.clearAllMocks());

    it('should render the simulation results component', async () => {
        const { container } = await renderComponent();
        expect(container).toBeTruthy();
    });

    describe('isDetailOpen', () => {
        it('should return false when no infra detail is open', async () => {
            isDetailOpen.set(false);
            const { fixture } = await renderComponent();
            expect(fixture.componentInstance.isDetailOpen).toBe(false);
        });

        it('should return true when an infra detail is open', async () => {
            isDetailOpen.set(true);
            const { fixture } = await renderComponent();
            expect(fixture.componentInstance.isDetailOpen).toBe(true);
        });
    });

    describe('ngOnInit', () => {
        it('should subscribe to tutorialService state on init', async () => {
            const { fixture } = await renderComponent();
            expect(fixture.componentInstance).toBeTruthy();
        });

        it('should call protectedAreasService.hide() when tutorial is active with welcome', async () => {
            await renderComponent();
            tutorialState$.next({ active: true, currentStep: 0, showWelcome: true });
            expect(mockProtectedAreasService.hide).toHaveBeenCalled();
        });
    });

    describe('ngOnDestroy', () => {
        it('should unsubscribe without throwing', async () => {
            const { fixture } = await renderComponent();
            expect(() => fixture.componentInstance.ngOnDestroy()).not.toThrow();
        });
    });
});
