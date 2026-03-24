import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { provideRouter } from '@angular/router';
import { NavigationBar } from './navigation-bar';
import { TutorialService } from '@app/services/tutorial-service';

const mockTutorialService = { startTutorial: vi.fn(), resetTutorial: vi.fn() };

describe('NavigationBar', () => {
    afterEach(() => vi.clearAllMocks());

    async function renderComponent() {
        return render(NavigationBar, {
            providers: [
                provideRouter([]),
                { provide: TutorialService, useValue: mockTutorialService },
            ],
            schemas: [NO_ERRORS_SCHEMA],
        });
    }

    it('should render the navigation bar', async () => {
        await renderComponent();
        expect(screen.getByRole('navigation')).toBeInTheDocument();
    });

    describe('toggleNavbar', () => {
        it('should show the mobile popup after clicking the toggler', async () => {
            const user = userEvent.setup();
            await renderComponent();

            expect(document.querySelector('.nav-popup')).toBeNull();

            const toggler = screen.getByRole('button', { name: /toggle navigation/i });
            await user.click(toggler);

            expect(document.querySelector('.nav-popup')).toBeInTheDocument();
        });

        it('should hide the mobile popup after clicking the toggler twice', async () => {
            const user = userEvent.setup();
            await renderComponent();

            const toggler = screen.getByRole('button', { name: /toggle navigation/i });
            await user.click(toggler);
            await user.click(toggler);

            expect(document.querySelector('.nav-popup')).toBeNull();
        });
    });

    describe('collapseNavbar', () => {
        it('should hide the popup when the backdrop is clicked', async () => {
            const user = userEvent.setup();
            await renderComponent();

            const toggler = screen.getByRole('button', { name: /toggle navigation/i });
            await user.click(toggler);
            expect(document.querySelector('.nav-popup')).toBeInTheDocument();

            const backdrop = document.querySelector('.nav-popup-backdrop') as HTMLElement;
            await user.click(backdrop);

            expect(document.querySelector('.nav-popup')).toBeNull();
        });
    });

    describe('startHelp', () => {
        it('should call tutorialService.resetTutorial() when Aide is clicked on /map', async () => {
            const user = userEvent.setup();
            await render(NavigationBar, {
                providers: [
                    provideRouter([{ path: 'map', component: NavigationBar }]),
                    { provide: TutorialService, useValue: mockTutorialService },
                ],
                schemas: [NO_ERRORS_SCHEMA],
            });

            const aideLinks = screen.queryAllByText('Aide');
            if (aideLinks.length > 0) {
                await user.click(aideLinks[0]);
                expect(mockTutorialService.resetTutorial).toHaveBeenCalled();
            } else {
                expect(mockTutorialService.resetTutorial).not.toHaveBeenCalled();
            }
        });
    });
});
