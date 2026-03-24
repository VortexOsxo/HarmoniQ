import { render, screen, waitFor } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BehaviorSubject } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { MapPage } from './map-page';
import { TutorialService, TutorialState } from '@app/services/tutorial-service';
import { InfraDetailService } from '@app/services/infra-detail-service';

vi.mock('leaflet.markercluster', () => ({}));

vi.mock('leaflet', () => ({
    default: { icon: vi.fn().mockReturnValue({}), divIcon: vi.fn().mockReturnValue({}) },
    icon: vi.fn().mockReturnValue({}),
    divIcon: vi.fn().mockReturnValue({}),
}));

const INACTIVE_STATE: TutorialState = { active: false, currentStep: 0, showWelcome: false };

const tutorialState$ = new BehaviorSubject<TutorialState>(INACTIVE_STATE);

const mockTutorialService = {
    tutorialState$,
    autoStart: vi.fn(),
};

const mockInfraDetailService = {
    closeDetail: vi.fn(),
};

const STUB_TEMPLATE = `
  <button class="sources-toggle-btn" (click)="toggleSourcesPanel()">Sources d'Énergie</button>
  <div *ngIf="showSourcesPanel" class="sources-panel open" data-testid="sources-panel">Panel ouvert</div>
`;

async function renderComponent() {
    TestBed.overrideComponent(MapPage, {
        set: { template: STUB_TEMPLATE, imports: [CommonModule] },
    });

    return render(MapPage, {
        providers: [
            { provide: TutorialService, useValue: mockTutorialService },
            { provide: InfraDetailService, useValue: mockInfraDetailService },
        ],
        schemas: [NO_ERRORS_SCHEMA],
    });
}

describe('MapPage', () => {
    beforeEach(() => {
        tutorialState$.next(INACTIVE_STATE);
    });

    afterEach(() => vi.clearAllMocks());

    it('should render the map page component', async () => {
        const { container } = await renderComponent();
        expect(container).toBeTruthy();
    });

    it('should not show the sources panel initially', async () => {
        await renderComponent();
        expect(screen.queryByTestId('sources-panel')).not.toBeInTheDocument();
    });

    describe('toggleSourcesPanel', () => {
        it('should show the sources panel when the toggle button is clicked', async () => {
            const user = userEvent.setup();
            await renderComponent();
            await user.click(screen.getByRole('button', { name: /sources d'énergie/i }));
            expect(screen.getByTestId('sources-panel')).toBeInTheDocument();
        });

        it('should hide the sources panel on second click of the toggle button', async () => {
            const user = userEvent.setup();
            await renderComponent();
            const btn = screen.getByRole('button', { name: /sources d'énergie/i });
            await user.click(btn);
            await user.click(btn);
            expect(screen.queryByTestId('sources-panel')).not.toBeInTheDocument();
        });
    });

    describe('ngOnDestroy', () => {
        it('should call infraDetailService.closeDetail on destroy', async () => {
            const { fixture } = await renderComponent();
            fixture.destroy();
            expect(mockInfraDetailService.closeDetail).toHaveBeenCalled();
        });
    });

    describe('tutorial subscription', () => {
        it('should close sources panel when tutorial becomes active with welcome screen', async () => {
            const user = userEvent.setup();
            const { fixture } = await renderComponent();

            await user.click(screen.getByRole('button', { name: /sources d'énergie/i }));
            expect(screen.getByTestId('sources-panel')).toBeInTheDocument();

            tutorialState$.next({ active: true, currentStep: 0, showWelcome: true });

            await waitFor(() =>
                expect(screen.queryByTestId('sources-panel')).not.toBeInTheDocument(),
            );
        });

        it('should not close sources panel when tutorial is not active', async () => {
            const user = userEvent.setup();
            const { fixture } = await renderComponent();

            await user.click(screen.getByRole('button', { name: /sources d'énergie/i }));
            expect(screen.getByTestId('sources-panel')).toBeInTheDocument();

            tutorialState$.next({ active: false, currentStep: 0, showWelcome: false });

            expect(screen.getByTestId('sources-panel')).toBeInTheDocument();
        });
    });
});
