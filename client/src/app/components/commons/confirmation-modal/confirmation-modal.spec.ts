import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ConfirmationModal } from './confirmation-modal';

const mockActiveModal = {
    close: vi.fn(),
    dismiss: vi.fn(),
};

describe('ConfirmationModal', () => {
    afterEach(() => vi.clearAllMocks());

    async function renderComponent(inputs: Partial<ConfirmationModal> = {}) {
        return render(ConfirmationModal, {
            componentInputs: inputs,
            providers: [{ provide: NgbActiveModal, useValue: mockActiveModal }],
        });
    }

    it('should render the default title', async () => {
        await renderComponent();
        expect(screen.getByText('Confirmation')).toBeInTheDocument();
    });

    it('should render the default message', async () => {
        await renderComponent();
        expect(screen.getByText('Êtes-vous sûr de vouloir continuer ?')).toBeInTheDocument();
    });

    it('should render the default confirm button label', async () => {
        await renderComponent();
        expect(screen.getByRole('button', { name: 'Confirmer' })).toBeInTheDocument();
    });


    it('should render a custom title', async () => {
        await renderComponent({ title: 'Supprimer le scénario?' });
        expect(screen.getByText('Supprimer le scénario?')).toBeInTheDocument();
    });

    it('should render a custom message', async () => {
        await renderComponent({ message: 'Cette action est irréversible.' });
        expect(screen.getByText('Cette action est irréversible.')).toBeInTheDocument();
    });

    it('should render custom button labels', async () => {
        await renderComponent({ confirmText: 'Oui, supprimer' });
        expect(screen.getByRole('button', { name: 'Oui, supprimer' })).toBeInTheDocument();
    });

    it('should apply the default btn-danger class to the confirm button', async () => {
        await renderComponent();
        expect(screen.getByRole('button', { name: 'Confirmer' })).toHaveClass('btn-danger');
    });

    it('should apply a custom confirmBtnClass to the confirm button', async () => {
        await renderComponent({ confirmBtnClass: 'btn-warning' });
        expect(screen.getByRole('button', { name: 'Confirmer' })).toHaveClass('btn-warning');
    });

    it('should call activeModal.close(true) when confirm is clicked', async () => {
        const user = userEvent.setup();
        await renderComponent();

        await user.click(screen.getByRole('button', { name: 'Confirmer' }));

        expect(mockActiveModal.close).toHaveBeenCalledWith(true);
    });


    it('should call activeModal.dismiss() when the X button is clicked', async () => {
        const user = userEvent.setup();
        await renderComponent();

        await user.click(screen.getByRole('button', { name: /close/i }));

        expect(mockActiveModal.dismiss).toHaveBeenCalled();
    });
});
