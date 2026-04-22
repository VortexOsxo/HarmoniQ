import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { NO_ERRORS_SCHEMA, ChangeDetectorRef, LOCALE_ID } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { FormBuilder } from '@angular/forms';
import { CreateInfraModal } from './create-infra-modal';
import { OpenApiService } from '@app/services/open-api-service';
import { ProtectedAreasService } from '@app/services/protected-areas-service';
import { InfrastruturesService } from '@app/services/infrastrutures-service';
import { signal } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeFrCA from '@angular/common/locales/fr-CA';
registerLocaleData(localeFrCA);

vi.mock('leaflet', () => ({
  default: { icon: vi.fn().mockReturnValue({}), divIcon: vi.fn().mockReturnValue({}) },
  icon: vi.fn().mockReturnValue({}),
  divIcon: vi.fn().mockReturnValue({}),
}));

const MOCK_SCHEMA = {
  properties: {
    nom: { title: 'Nom', type: 'string' },
    latitude: { title: 'Latitude', type: 'number' },
    longitude: { title: 'Longitude', type: 'number' },
  },
  required: ['nom', 'latitude', 'longitude'],
};

const WIND_SCHEMA = {
  properties: {
    nom: { title: 'Nom', type: 'string' },
    nombre_eoliennes: { title: "Nombre d'éoliennes", type: 'integer' },
    capacite_total: { title: 'Capacité totale', type: 'number' },
    puissance_nominal: { title: 'Puissance nominale', type: 'number' },
    latitude: { title: 'Latitude', type: 'number' },
    longitude: { title: 'Longitude', type: 'number' },
  },
  required: ['nom', 'nombre_eoliennes', 'capacite_total', 'puissance_nominal', 'latitude', 'longitude'],
};

const SOLAR_SCHEMA = {
  properties: {
    nom: { title: 'Nom', type: 'string' },
    nombre_panneau: { title: 'Nombre de panneaux', type: 'integer' },
    puissance_nominal: { title: 'Puissance nominale', type: 'number' },
    orientation_panneau: { title: 'Orientation', type: 'number' },
    angle_panneau: { title: 'Angle', type: 'number' },
    latitude: { title: 'Latitude', type: 'number' },
    longitude: { title: 'Longitude', type: 'number' },
  },
  required: ['nom', 'nombre_panneau', 'puissance_nominal', 'orientation_panneau', 'angle_panneau', 'latitude', 'longitude'],
};

const NUCLEAIRE_SCHEMA = {
  properties: {
    nom: { title: 'Nom', type: 'string' },
    puissance_nominal: { title: 'Puissance nominale', type: 'number' },
    semaine_maintenance: { title: 'Semaine de maintenance', type: 'integer' },
    latitude: { title: 'Latitude', type: 'number' },
    longitude: { title: 'Longitude', type: 'number' },
  },
  required: ['nom', 'puissance_nominal', 'semaine_maintenance', 'latitude', 'longitude'],
};

const mockActiveModal = { close: vi.fn(), dismiss: vi.fn() };
const mockOpenApiService = { getOpenApiSchemas: vi.fn().mockReturnValue({}) };
const mockProtectedAreasService = { checkProtectedArea: vi.fn().mockResolvedValue(null) };
const mockInfrastruturesService = {
  getInfrasSignalByType: vi.fn().mockReturnValue(signal([])),
  isNameTaken: vi.fn().mockReturnValue(false),
};

const defaultProviders = [
  { provide: NgbActiveModal, useValue: mockActiveModal },
  FormBuilder,
  { provide: OpenApiService, useValue: mockOpenApiService },
  { provide: ProtectedAreasService, useValue: mockProtectedAreasService },
  { provide: InfrastruturesService, useValue: mockInfrastruturesService },
  { provide: ChangeDetectorRef, useValue: { detectChanges: vi.fn() } },
  { provide: LOCALE_ID, useValue: 'fr-CA' },
];

async function renderComponent(inputs: Record<string, unknown> = {}) {
  return render(CreateInfraModal, {
    componentInputs: { schema: MOCK_SCHEMA, lat: 45.5, lon: -73.5, type: 'eolienneparc', ...inputs },
    providers: defaultProviders,
    schemas: [NO_ERRORS_SCHEMA],
  });
}

describe('CreateInfraModal', () => {
  beforeEach(() => vi.spyOn(window, 'alert').mockImplementation(() => {}));
  afterEach(() => vi.clearAllMocks());

  it('should render with a form', async () => {
    const { fixture } = await renderComponent();
    expect(screen.getByRole('heading', { level: 5 })).toBeInTheDocument();
    expect(fixture.componentInstance.form).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('should pre-fill lat/lon and call checkProtectedArea', async () => {
      await renderComponent({ schema: MOCK_SCHEMA, type: 'hydro' });
      expect(screen.getByDisplayValue('45.5')).toHaveAttribute('readonly');
      expect(screen.getByDisplayValue('-73.5')).toHaveAttribute('readonly');
      expect(mockProtectedAreasService.checkProtectedArea).toHaveBeenCalledWith(45.5, -73.5);
    });

    it('should show protected area warning when a name is returned', async () => {
      mockProtectedAreasService.checkProtectedArea.mockResolvedValue('Parc National');
      await renderComponent();
      await screen.findByText('Aire protégée');
      expect(screen.getByText(/Parc National/)).toBeInTheDocument();
    });
  });

  describe('isEditMode / title', () => {
    it('should be false without editData', async () => {
      const { fixture } = await renderComponent();
      expect(fixture.componentInstance.isEditMode).toBe(false);
      expect(fixture.componentInstance.improvedTitle.toLowerCase()).toContain('nouveau');
    });

    it('should be true with editData and show modifier title', async () => {
      const { fixture } = await renderComponent({ editData: { nom: 'X', latitude: 45.5, longitude: -73.5 } });
      expect(fixture.componentInstance.isEditMode).toBe(true);
      expect(fixture.componentInstance.improvedTitle.toLowerCase()).toContain('modifier');
    });

    it('should use Nouvelle for centrale types', async () => {
      const { fixture } = await renderComponent({ schema: NUCLEAIRE_SCHEMA, type: 'nucleaire' });
      expect(fixture.componentInstance.improvedTitle.toLowerCase()).toContain('nouvelle');
    });
  });

  describe('buildForm', () => {
    it('should set isSolar and add solar defaults for solaire type', async () => {
      const { fixture } = await renderComponent({ schema: SOLAR_SCHEMA, type: 'solaire' });
      expect(fixture.componentInstance.isSolar).toBe(true);
      expect(fixture.componentInstance.form.get('orientation_panneau')?.value).toBe(180);
      expect(fixture.componentInstance.form.get('angle_panneau')?.value).toBe(45);
    });

    it('should set isWind and add is_offshore control for eolienneparc', async () => {
      const { fixture } = await renderComponent({ schema: WIND_SCHEMA, type: 'eolienneparc' });
      expect(fixture.componentInstance.isWind).toBe(true);
      expect(fixture.componentInstance.form.contains('is_offshore')).toBe(true);
    });

    it('should pre-fill values from editData', async () => {
      const { fixture } = await renderComponent({ editData: { nom: 'MyPark', latitude: 45.5, longitude: -73.5 } });
      expect(fixture.componentInstance.form.get('nom')?.value).toBe('MyPark');
    });
  });

  describe('submit', () => {
    it('should call activeModal.close on submit', async () => {
      await renderComponent({ schema: MOCK_SCHEMA, type: 'hydro' });
      await userEvent.setup().type(screen.getByLabelText(/nom/i), 'Test');
      await userEvent.setup().click(screen.getByRole('button', { name: /créer/i }));
      expect(mockActiveModal.close).toHaveBeenCalled();
    });
  });

  describe('onKeydown / onBlur', () => {
    it('should prevent minus key for nonNegative fields only', async () => {
      const { fixture } = await renderComponent({ schema: WIND_SCHEMA, type: 'eolienneparc' });
      const comp = fixture.componentInstance;
      const nonNegField = comp.fields.find((f) => f.key === 'nombre_eoliennes')!;
      const latField = comp.fields.find((f) => f.key === 'latitude')!;
      const prevent = vi.fn();
      comp.onKeydown({ key: '-', preventDefault: prevent } as any, nonNegField);
      expect(prevent).toHaveBeenCalled();
      comp.onKeydown({ key: '-', preventDefault: prevent } as any, latField);
      expect(prevent).toHaveBeenCalledTimes(1);
    });

    it('should clamp negative values to 0 on blur', async () => {
      const { fixture } = await renderComponent({ schema: WIND_SCHEMA, type: 'eolienneparc' });
      const comp = fixture.componentInstance;
      const field = comp.fields.find((f) => f.key === 'nombre_eoliennes')!;
      comp.form.get('nombre_eoliennes')!.setValue(-5);
      comp.onBlur(field);
      expect(comp.form.get('nombre_eoliennes')!.value).toBe(0);
    });
  });

  describe('getFieldError / getFieldWarning', () => {
    it('should return required error when touched and empty', async () => {
      const { fixture } = await renderComponent({ schema: MOCK_SCHEMA, type: 'hydro' });
      const comp = fixture.componentInstance;
      const field = comp.fields.find((f) => f.key === 'nom')!;
      comp.form.get('nom')!.setValue('');
      comp.form.get('nom')!.markAsTouched();
      expect(comp.getFieldError(field)).toBe('Ce champ est obligatoire.');
    });

    it('should return duplicateName error when name is taken', async () => {
      mockInfrastruturesService.isNameTaken.mockReturnValue(true);
      const { fixture } = await renderComponent({ schema: MOCK_SCHEMA, type: 'hydro' });
      const comp = fixture.componentInstance;
      const field = comp.fields.find((f) => f.key === 'nom')!;
      comp.form.get('nom')!.setValue('Taken');
      comp.form.get('nom')!.markAsTouched();
      expect(comp.getFieldError(field)).toContain('existe déjà');
    });

    it('should return warning when warnIfZero field is 0', async () => {
      const { fixture } = await renderComponent({ schema: WIND_SCHEMA, type: 'eolienneparc' });
      const comp = fixture.componentInstance;
      const field = comp.fields.find((f) => f.key === 'nombre_eoliennes')!;
      comp.form.get('nombre_eoliennes')!.setValue(0);
      expect(comp.getFieldWarning(field)).toContain('énergie');
      comp.form.get('nombre_eoliennes')!.setValue(5);
      expect(comp.getFieldWarning(field)).toBeNull();
    });
  });

  describe('validators', () => {
    it('should reject nombre_eoliennes > 1000', async () => {
      const { fixture } = await renderComponent({ schema: WIND_SCHEMA, type: 'eolienneparc' });
      fixture.componentInstance.form.get('nombre_eoliennes')!.setValue(1001);
      expect(fixture.componentInstance.form.get('nombre_eoliennes')!.valid).toBe(false);
    });

    it('should reject puissance_nominal > 25 for solaire', async () => {
      const { fixture } = await renderComponent({ schema: SOLAR_SCHEMA, type: 'solaire' });
      fixture.componentInstance.form.get('puissance_nominal')!.setValue(30);
      expect(fixture.componentInstance.form.get('puissance_nominal')!.valid).toBe(false);
    });

    it('should reject non-multiple-of-300 for nucleaire and accept 900', async () => {
      const { fixture } = await renderComponent({ schema: NUCLEAIRE_SCHEMA, type: 'nucleaire' });
      const ctrl = fixture.componentInstance.form.get('puissance_nominal')!;
      ctrl.setValue(400);
      expect(ctrl.valid).toBe(false);
      ctrl.setValue(900);
      expect(ctrl.valid).toBe(true);
    });

    it('should reject semaine_maintenance > 52', async () => {
      const { fixture } = await renderComponent({ schema: NUCLEAIRE_SCHEMA, type: 'nucleaire' });
      fixture.componentInstance.form.get('semaine_maintenance')!.setValue(53);
      expect(fixture.componentInstance.form.get('semaine_maintenance')!.valid).toBe(false);
    });

    it('should reject angle_panneau > 90 and orientation_panneau > 360', async () => {
      const { fixture } = await renderComponent({ schema: SOLAR_SCHEMA, type: 'solaire' });
      fixture.componentInstance.form.get('angle_panneau')!.setValue(91);
      expect(fixture.componentInstance.form.get('angle_panneau')!.valid).toBe(false);
      fixture.componentInstance.form.get('orientation_panneau')!.setValue(361);
      expect(fixture.componentInstance.form.get('orientation_panneau')!.valid).toBe(false);
    });
  });
});
