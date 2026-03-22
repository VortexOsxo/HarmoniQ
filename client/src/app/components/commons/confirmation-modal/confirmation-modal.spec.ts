import { TestBed, ComponentFixture } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ConfirmationModal } from './confirmation-modal';

const DEFAULT_TITLE = 'Confirmation';
const DEFAULT_MESSAGE = 'Êtes-vous sûr de vouloir continuer ?';
const DEFAULT_CONFIRM_TEXT = 'Confirmer';
const DEFAULT_CANCEL_TEXT = 'Annuler';
const DEFAULT_CONFIRM_CLASS = 'btn-danger';

const mockActiveModal = {
  close: vi.fn(),
  dismiss: vi.fn(),
};

describe('ConfirmationModal', () => {
  let component: ConfirmationModal;
  let fixture: ComponentFixture<ConfirmationModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConfirmationModal],
      providers: [
        { provide: NgbActiveModal, useValue: mockActiveModal },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ConfirmationModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => vi.clearAllMocks());

  it('should create the confirmation modal component', () => {
    expect(component).toBeTruthy();
  });

  describe('default input values', () => {
    it('should have the default title', () => {
      expect(component.title).toBe(DEFAULT_TITLE);
    });

    it('should have the default message', () => {
      expect(component.message).toBe(DEFAULT_MESSAGE);
    });

    it('should have the default confirmText', () => {
      expect(component.confirmText).toBe(DEFAULT_CONFIRM_TEXT);
    });

    it('should have the default cancelText', () => {
      expect(component.cancelText).toBe(DEFAULT_CANCEL_TEXT);
    });

    it('should have the default confirmBtnClass', () => {
      expect(component.confirmBtnClass).toBe(DEFAULT_CONFIRM_CLASS);
    });
  });

  describe('custom input values', () => {
    it('should accept a custom title', () => {
      component.title = 'Supprimer le scénario?';

      expect(component.title).toBe('Supprimer le scénario?');
    });

    it('should accept a custom message', () => {
      component.message = 'Cette action est irréversible.';

      expect(component.message).toBe('Cette action est irréversible.');
    });

    it('should accept a custom confirmBtnClass', () => {
      component.confirmBtnClass = 'btn-warning';

      expect(component.confirmBtnClass).toBe('btn-warning');
    });
  });

  describe('activeModal injection', () => {
    it('should have activeModal injected and accessible', () => {
      expect(component.activeModal).toBe(mockActiveModal);
    });
  });
});
