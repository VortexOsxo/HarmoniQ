import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { NO_ERRORS_SCHEMA, ChangeDetectorRef } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { FormBuilder } from '@angular/forms';
import { CreateInfraModal } from './create-infra-modal';
import { OpenApiService } from '@app/services/open-api-service';
import { ProtectedAreasService } from '@app/services/protected-areas-service';

vi.mock('leaflet', () => ({
  default: { icon: vi.fn().mockReturnValue({}), divIcon: vi.fn().mockReturnValue({}) },
  icon: vi.fn().mockReturnValue({}),
  divIcon: vi.fn().mockReturnValue({}),
}));

const MOCK_SCHEMA = {
  properties: {
    nom: { title: 'Nom', type: 'string', description: 'Nom du barrage' },
    latitude: { title: 'Latitude', type: 'number', description: 'Latitude' },
    longitude: { title: 'Longitude', type: 'number', description: 'Longitude' },
  },
  required: ['nom', 'latitude', 'longitude'],
};

const MOCK_API_SCHEMAS = {
  TypeBarrage: { enum: ['gravitaire', 'voûte', 'remblai'] },
};

const mockActiveModal = { close: vi.fn(), dismiss: vi.fn() };

const mockOpenApiService = {
  getOpenApiSchemas: vi.fn().mockReturnValue(MOCK_API_SCHEMAS),
};

const mockProtectedAreasService = {
  checkProtectedArea: vi.fn().mockResolvedValue(null),
};

const mockCdr = { detectChanges: vi.fn(), markForCheck: vi.fn() };

const defaultProviders = [
  { provide: NgbActiveModal, useValue: mockActiveModal },
  FormBuilder,
  { provide: OpenApiService, useValue: mockOpenApiService },
  { provide: ProtectedAreasService, useValue: mockProtectedAreasService },
  { provide: ChangeDetectorRef, useValue: mockCdr },
];

async function renderComponent(inputs: Record<string, unknown> = {}) {
  return render(CreateInfraModal, {
    componentInputs: {
      schema: MOCK_SCHEMA,
      lat: 45.5,
      lon: -73.5,
      type: 'hydro',
      ...inputs,
    },
    providers: defaultProviders,
    schemas: [NO_ERRORS_SCHEMA],
  });
}

describe('CreateInfraModal', () => {
  afterEach(() => vi.clearAllMocks());

  it('should render the create infra modal component', async () => {
    await renderComponent();
    expect(screen.getByRole('heading', { level: 5 })).toBeInTheDocument();
  });

  describe('ngOnInit', () => {
    it('should render a form with submit button', async () => {
      await renderComponent();
      expect(screen.getByRole('button', { name: /fermer/i })).toBeInTheDocument();
    });

    it('should pre-fill latitude input with the provided lat value', async () => {
      await renderComponent();
      const latInput = screen.getByDisplayValue('45.5');
      expect(latInput).toBeInTheDocument();
    });

    it('should pre-fill longitude input with the provided lon value', async () => {
      await renderComponent();
      const lonInput = screen.getByDisplayValue('-73.5');
      expect(lonInput).toBeInTheDocument();
    });

    it('should call protectedAreasService.checkProtectedArea with lat and lon', async () => {
      await renderComponent();
      expect(mockProtectedAreasService.checkProtectedArea).toHaveBeenCalledWith(45.5, -73.5);
    });

    it('should show protected area warning when checkProtectedArea resolves a name', async () => {
      mockProtectedAreasService.checkProtectedArea.mockResolvedValue('Parc National');
      await renderComponent();
      await screen.findByText('Aire protégée');
      expect(screen.getByText(/Parc National/)).toBeInTheDocument();
    });
  });

  describe('form fields', () => {
    it('should render an input for each required schema property', async () => {
      await renderComponent();
      expect(screen.getByLabelText(/nom/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/latitude/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/longitude/i)).toBeInTheDocument();
    });

    it('should render latitude and longitude inputs as readonly', async () => {
      await renderComponent();
      const latInput = screen.getByDisplayValue('45.5');
      const lonInput = screen.getByDisplayValue('-73.5');
      expect(latInput).toHaveAttribute('readonly');
      expect(lonInput).toHaveAttribute('readonly');
    });
  });

  describe('submit', () => {
    it('should call activeModal.close when the form is submitted', async () => {
      const user = userEvent.setup();
      await renderComponent();
      const nomInput = screen.getByLabelText(/nom/i);
      await user.type(nomInput, 'Barrage Test');
      const submitBtn = screen.getByRole('button', { name: /créer/i });
      await user.click(submitBtn);
      expect(mockActiveModal.close).toHaveBeenCalled();
    });

    it('should call activeModal.close when the close button is clicked', async () => {
      const user = userEvent.setup();
      await renderComponent();
      const closeBtn = screen.getByRole('button', { name: /fermer/i });
      await user.click(closeBtn);
      expect(mockActiveModal.close).toHaveBeenCalled();
    });
  });
});
