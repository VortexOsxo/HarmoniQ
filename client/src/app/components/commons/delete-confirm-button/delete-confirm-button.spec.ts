import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { DeleteConfirmButtonComponent } from './delete-confirm-button';
import { ConfirmationModal } from '../confirmation-modal/confirmation-modal';

const mockModalService = {
  open: vi.fn(),
};

describe('DeleteConfirmButtonComponent', () => {
  afterEach(() => vi.clearAllMocks());

  async function renderComponent(inputs: Partial<DeleteConfirmButtonComponent> = {}) {
    return render(DeleteConfirmButtonComponent, {
      componentInputs: inputs,
      providers: [{ provide: NgbModal, useValue: mockModalService }],
    });
  }

  it('should render the button with the provided title', async () => {
    await renderComponent({ buttonTitle: 'Supprimer cet élément' });
    expect(screen.getByTitle('Supprimer cet élément')).toBeInTheDocument();
  });

  it('should render the trash icon', async () => {
    const { container } = await renderComponent();
    expect(container.querySelector('.fa-trash')).toBeInTheDocument();
  });

  it('should open ConfirmationModal with correct inputs when clicked', async () => {
    const user = userEvent.setup();
    const mockComponentInstance = {};
    mockModalService.open.mockReturnValue({ componentInstance: mockComponentInstance, result: Promise.resolve(false) });

    await renderComponent({ 
      confirmTitle: 'Titre de confirmation', 
      confirmMessage: 'Message de confirmation',
      confirmText: 'Action confirmer'
    });

    await user.click(screen.getByRole('button', { name: /Supprimer/i }));

    expect(mockModalService.open).toHaveBeenCalledWith(ConfirmationModal, { centered: true });
    expect(mockComponentInstance).toEqual({
      title: 'Titre de confirmation',
      message: 'Message de confirmation',
      confirmText: 'Action confirmer'
    });
  });

  it('should emit delete event when modal is confirmed', async () => {
    const user = userEvent.setup();
    const deleteSpy = vi.fn();
    mockModalService.open.mockReturnValue({ 
      componentInstance: {}, 
      result: Promise.resolve(true) 
    });

    const { fixture } = await renderComponent();
    fixture.componentInstance.delete.subscribe(deleteSpy);

    await user.click(screen.getByRole('button', { name: /Supprimer/i }));
    
    // Wait for promise resolution
    await Promise.resolve();

    expect(deleteSpy).toHaveBeenCalled();
  });

  it('should not emit delete event when modal is dismissed', async () => {
    const user = userEvent.setup();
    const deleteSpy = vi.fn();
    mockModalService.open.mockReturnValue({ 
      componentInstance: {}, 
      result: Promise.resolve(false) 
    });

    const { fixture } = await renderComponent();
    fixture.componentInstance.delete.subscribe(deleteSpy);

    await user.click(screen.getByRole('button', { name: /Supprimer/i }));
    
    // Wait for promise resolution
    await Promise.resolve();

    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it('should be disabled when disabled input is true', async () => {
    await renderComponent({ disabled: true });
    const button = screen.getByRole('button', { name: /Supprimer/i });
    expect(button).toHaveClass('disabled');
  });
});
