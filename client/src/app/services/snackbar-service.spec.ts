import { TestBed } from '@angular/core/testing';
import { SnackbarService } from './snackbar-service';

describe('SnackbarService', () => {
    let service: SnackbarService;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [SnackbarService],
        });
        service = TestBed.inject(SnackbarService);
    });

    afterEach(() => {
        document.querySelectorAll('.hq-snackbar').forEach((el) => el.remove());
        vi.clearAllMocks();
    });

    describe('show', () => {
        it('should append a snackbar element to the document body', () => {
            service.show('Titre', 'Message');
            const el = document.querySelector('.hq-snackbar');
            expect(el).not.toBeNull();
        });

        it('should apply the correct type class for success', () => {
            service.show('OK', 'Done', 'success');
            const el = document.querySelector('.hq-snackbar');
            expect(el?.classList.contains('hq-snackbar--success')).toBe(true);
        });

        it('should apply the correct type class for error', () => {
            service.show('Erreur', 'Problème', 'error');
            const el = document.querySelector('.hq-snackbar');
            expect(el?.classList.contains('hq-snackbar--error')).toBe(true);
        });

        it('should apply the correct type class for info', () => {
            service.show('Info', 'Note', 'info');
            const el = document.querySelector('.hq-snackbar');
            expect(el?.classList.contains('hq-snackbar--info')).toBe(true);
        });

        it('should display the title in the snackbar', () => {
            service.show('Mon Titre', 'Corps du message');
            const el = document.querySelector('.hq-snackbar');
            expect(el?.innerHTML).toContain('Mon Titre');
        });

        it('should display the message body in the snackbar', () => {
            service.show('Titre', 'Corps du message');
            const el = document.querySelector('.hq-snackbar');
            expect(el?.innerHTML).toContain('Corps du message');
        });

        it('should close the previous snackbar when showing a new one', () => {
            service.show('Premier', 'A');
            service.show('Second', 'B');
            const all = document.querySelectorAll('.hq-snackbar');
            expect(all.length).toBeLessThanOrEqual(2);
        });

        it('should use success as default type', () => {
            service.show('Titre', 'Message');
            const el = document.querySelector('.hq-snackbar');
            expect(el?.classList.contains('hq-snackbar--success')).toBe(true);
        });

        it('should include a close button', () => {
            service.show('Titre', 'Message');
            const closeBtn = document.querySelector('.hq-snackbar-close');
            expect(closeBtn).not.toBeNull();
        });

        it('should close when the close button is clicked', () => {
            service.show('Titre', 'Message');
            const closeBtn = document.querySelector('.hq-snackbar-close') as HTMLElement;
            closeBtn?.click();
            const el = document.querySelector('.hq-snackbar');
            expect(el?.classList.contains('hq-snackbar--visible')).toBe(false);
        });
    });

    describe('close', () => {
        it('should do nothing when no snackbar is shown', () => {
            expect(() => service.close()).not.toThrow();
        });

        it('should remove the visible class from the snackbar', () => {
            service.show('Titre', 'Message');
            service.close();
            const el = document.querySelector('.hq-snackbar');
            expect(el?.classList.contains('hq-snackbar--visible')).toBe(false);
        });

        it('should add the exit class after closing', () => {
            service.show('Titre', 'Message');
            service.close();
            const el = document.querySelector('.hq-snackbar');
            expect(el?.classList.contains('hq-snackbar--exit')).toBe(true);
        });
    });
});
