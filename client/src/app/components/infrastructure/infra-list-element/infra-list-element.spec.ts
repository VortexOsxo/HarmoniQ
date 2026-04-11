import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { InfraListElement } from './infra-list-element';
import { InfrastruturesService } from '@app/services/infrastrutures-service';
import { ScenariosService } from '@app/services/scenarios-service';
import { InfraDetailService } from '@app/services/infra-detail-service';
import { MapService } from '@app/services/map-service';
import { Scenario } from '@app/models/scenario';
import { Weather } from '@app/models/weather';
import { Consumption } from '@app/models/consumption';
import { DEFAULT_INFRA_GROUP_ID } from '@app/models/infrastructure-group';

vi.mock('leaflet.markercluster', () => ({}));
vi.mock('leaflet', () => ({
  default: { icon: vi.fn().mockReturnValue({}), divIcon: vi.fn().mockReturnValue({}) },
  icon: vi.fn().mockReturnValue({}),
  divIcon: vi.fn().mockReturnValue({}),
}));

const MOCK_SCENARIO: Scenario = {
  id: 999,
  nom: 'Scénario Test',
  description: 'Test',
  date_de_debut: '2035-01-01T00:00:00',
  date_de_fin: '2035-12-31T00:00:00',
  pas_de_temps: 'PT1H',
  weather: Weather.Typical,
  consomation: Consumption.Normal,
};

const selectedInfraGroup = signal<any>(null);

const mockInfrasService = {
  isInfraSelected: vi.fn().mockReturnValue(false),
  toggleInfra: vi.fn(),
  deleteLocalInfra: vi.fn(),
  selectedInfraGroup,
  isDefaultInfraGroup: vi.fn().mockReturnValue(false),
};

const selectedScenario = signal<Scenario | null>(null);
const mockScenariosService = { selectedScenario };

const mockModalRef = {
  componentInstance: {} as any,
  result: Promise.resolve(true),
};
const mockModalService = {
  open: vi.fn().mockReturnValue(mockModalRef),
};

const mockInfraDetailService = {
  openDetail: vi.fn(),
};

const mockMapService = {
  flyToInfra: vi.fn(),
};

const defaultInputs = {
  nom: 'Barrage Test',
  id: '42',
  type: 'hydro',
};

const defaultProviders = [
  { provide: InfrastruturesService, useValue: mockInfrasService },
  { provide: ScenariosService, useValue: mockScenariosService },
  { provide: NgbModal, useValue: mockModalService },
  { provide: InfraDetailService, useValue: mockInfraDetailService },
  { provide: MapService, useValue: mockMapService },
];

describe('InfraListElement', () => {
  beforeEach(() => {
    selectedScenario.set(null);
    selectedInfraGroup.set(null);
    mockInfrasService.isInfraSelected.mockReturnValue(false);
    mockInfrasService.isDefaultInfraGroup.mockReturnValue(false);
  });

  afterEach(() => vi.clearAllMocks());

  it('should render the infrastructure name', async () => {
    await render(InfraListElement, {
      componentInputs: defaultInputs,
      providers: defaultProviders,
      schemas: [NO_ERRORS_SCHEMA],
    });

    expect(screen.getByText('Barrage Test')).toBeInTheDocument();
  });

  describe('isInfraSelected', () => {
    it('should call isInfraSelected with the correct type and id when rendering', async () => {
      await render(InfraListElement, {
        componentInputs: defaultInputs,
        providers: defaultProviders,
        schemas: [NO_ERRORS_SCHEMA],
      });

      expect(mockInfrasService.isInfraSelected).toHaveBeenCalledWith('hydro', '42');
    });
  });

  describe('onRowClick', () => {
    it('should call infrastructuresService.toggleInfra with type and id when the item is clicked', async () => {
      const user = userEvent.setup();
      await render(InfraListElement, {
        componentInputs: defaultInputs,
        providers: defaultProviders,
        schemas: [NO_ERRORS_SCHEMA],
      });

      await user.click(screen.getByText('Barrage Test'));

      expect(mockInfrasService.toggleInfra).toHaveBeenCalledWith('hydro', '42');
    });

    it('should not toggle when the default infrastructure group is selected', async () => {
      const user = userEvent.setup();
      selectedInfraGroup.set({
        id: DEFAULT_INFRA_GROUP_ID,
        nom: 'Infrastructures québécoises',
        parc_eoliens: [],
        parc_solaires: [],
        central_hydroelectriques: [],
        central_thermique: [],
        central_nucleaire: [],
      });
      mockInfrasService.isDefaultInfraGroup.mockImplementation(
        (g: any) => g?.id === DEFAULT_INFRA_GROUP_ID,
      );

      await render(InfraListElement, {
        componentInputs: defaultInputs,
        providers: defaultProviders,
        schemas: [NO_ERRORS_SCHEMA],
      });

      await user.click(screen.getByText('Barrage Test'));

      expect(mockInfrasService.toggleInfra).toHaveBeenCalledWith('hydro', '42');
    });

  });

  describe('handleInfoClick', () => {
    it('should call infraDetailService.openDetail with type and id when info icon is clicked', async () => {
      const user = userEvent.setup();
      await render(InfraListElement, {
        componentInputs: defaultInputs,
        providers: defaultProviders,
        schemas: [NO_ERRORS_SCHEMA],
      });

      await user.click(screen.getByTitle(/Afficher les informations/i));

      expect(mockInfraDetailService.openDetail).toHaveBeenCalledWith('hydro', '42');
      expect(mockMapService.flyToInfra).toHaveBeenCalledWith('hydro', '42');
    });
  });

  describe('simulate_single', () => {
    it('should not open modal when no scenario is selected', async () => {
      const user = userEvent.setup();
      selectedScenario.set(null);

      await render(InfraListElement, {
        componentInputs: defaultInputs,
        providers: defaultProviders,
        schemas: [NO_ERRORS_SCHEMA],
      });

      await user.click(screen.getByTitle(/Simuler cette infrastructure/i));

      expect(mockModalService.open).not.toHaveBeenCalled();
    });

    it('should open modal when a scenario is selected', async () => {
      const user = userEvent.setup();
      selectedScenario.set(MOCK_SCENARIO);

      await render(InfraListElement, {
        componentInputs: defaultInputs,
        providers: defaultProviders,
        schemas: [NO_ERRORS_SCHEMA],
      });

      await user.click(screen.getByTitle(/Simuler cette infrastructure/i));

      expect(mockModalService.open).toHaveBeenCalled();
    });

    it('should set modal instance properties when opening', async () => {
      const user = userEvent.setup();
      selectedScenario.set(MOCK_SCENARIO);

      await render(InfraListElement, {
        componentInputs: defaultInputs,
        providers: defaultProviders,
        schemas: [NO_ERRORS_SCHEMA],
      });

      await user.click(screen.getByTitle(/Simuler cette infrastructure/i));

      expect(mockModalRef.componentInstance.id).toBe('42');
      expect(mockModalRef.componentInstance.name).toBe('Barrage Test');
      expect(mockModalRef.componentInstance.type).toBe('hydro');
    });
  });

  describe('deleteInfra', () => {
    it('should open a confirmation modal when delete icon is clicked', async () => {
      const user = userEvent.setup();
      await render(InfraListElement, {
        componentInputs: { ...defaultInputs, isUserCreated: true },
        providers: defaultProviders,
        schemas: [NO_ERRORS_SCHEMA],
      });

      await user.click(screen.getByTitle(/Supprimer cette infrastructure/i));

      expect(mockModalService.open).toHaveBeenCalled();
    });

    it('should call deleteLocalInfra when confirmation is accepted', async () => {
      const user = userEvent.setup();
      await render(InfraListElement, {
        componentInputs: { ...defaultInputs, isUserCreated: true },
        providers: defaultProviders,
        schemas: [NO_ERRORS_SCHEMA],
      });

      await user.click(screen.getByTitle(/Supprimer cette infrastructure/i));
      await mockModalRef.result;

      expect(mockInfrasService.deleteLocalInfra).toHaveBeenCalledWith('hydro', 42);
    });

    it('should not render the delete icon when isUserCreated is false', async () => {
      await render(InfraListElement, {
        componentInputs: { ...defaultInputs, isUserCreated: false },
        providers: defaultProviders,
        schemas: [NO_ERRORS_SCHEMA],
      });

      expect(screen.queryByTitle(/Supprimer cette infrastructure/i)).not.toBeInTheDocument();
    });
  });
});
