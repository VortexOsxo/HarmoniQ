import { render } from '@testing-library/angular';
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { InfraListBody } from './infra-list-body';
import { InfrastruturesService } from '@app/services/infrastrutures-service';

const MOCK_INFRAS = [
  { id: 1, nom: 'Barrage A', isUserCreated: false },
  { id: 2, nom: 'Barrage B', isUserCreated: true },
];

const mockInfrastruturesService = {
  setInfrasForType: vi.fn(),
  isInfraSelected: vi.fn().mockReturnValue(false),
  toggleInfra: vi.fn(),
  deleteLocalInfra: vi.fn(),
  isDefaultInfraGroup: vi.fn().mockReturnValue(false),
  selectedInfraGroup: signal({
    id: 100,
    nom: 'Groupe',
    parc_eoliens: [],
    parc_solaires: [],
    central_hydroelectriques: ['1'],
    central_thermique: [],
    central_nucleaire: [],
  }),
};

describe('InfraListBody', () => {
  afterEach(() => vi.clearAllMocks());

  async function renderComponent() {
    return render(InfraListBody, {
      componentInputs: { infras: MOCK_INFRAS, type: 'hydro' },
      providers: [
        { provide: InfrastruturesService, useValue: mockInfrastruturesService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });
  }

  it('should create the infra list body component', async () => {
    const { fixture } = await renderComponent();
    expect(fixture.componentInstance).toBeTruthy();
  });

  describe('selectAll', () => {
    it('should call setInfrasForType with all infra ids as strings', async () => {
      const { fixture } = await renderComponent();

      fixture.componentInstance.selectAll();

      expect(mockInfrastruturesService.setInfrasForType).toHaveBeenCalledWith(
        'hydro',
        expect.arrayContaining(['1', '2']),
      );
    });
  });

  describe('selectNone', () => {
    it('should call setInfrasForType with an empty array', async () => {
      const { fixture } = await renderComponent();

      fixture.componentInstance.selectNone();

      expect(mockInfrastruturesService.setInfrasForType).toHaveBeenCalledWith('hydro', []);
    });
  });
});
