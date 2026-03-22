import { TestBed, ComponentFixture } from '@angular/core/testing';
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

describe('CreateInfraModal', () => {
  let component: CreateInfraModal;
  let fixture: ComponentFixture<CreateInfraModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreateInfraModal],
      providers: [
        { provide: NgbActiveModal, useValue: mockActiveModal },
        FormBuilder,
        { provide: OpenApiService, useValue: mockOpenApiService },
        { provide: ProtectedAreasService, useValue: mockProtectedAreasService },
        { provide: ChangeDetectorRef, useValue: mockCdr },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(CreateInfraModal);
    component = fixture.componentInstance;
    component.schema = MOCK_SCHEMA;
    component.lat = 45.5;
    component.lon = -73.5;
    component.type = 'hydro';
    fixture.detectChanges();
  });

  afterEach(() => vi.clearAllMocks());

  it('should create the create infra modal component', () => {
    expect(component).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('should call processPrettyName and set a pretty name', () => {
      expect(component.prettyName).toBeTruthy();
    });

    it('should call buildForm and create a form group', () => {
      expect(component.form).toBeDefined();
    });

    it('should pre-fill latitude and longitude in the form', () => {
      expect(component.form.get('latitude')?.value).toBe(45.5);
      expect(component.form.get('longitude')?.value).toBe(-73.5);
    });

    it('should call protectedAreasService.checkProtectedArea with lat and lon', () => {
      expect(mockProtectedAreasService.checkProtectedArea).toHaveBeenCalledWith(45.5, -73.5);
    });

    it('should set protectedAreaName after promise resolves', async () => {
      mockProtectedAreasService.checkProtectedArea.mockResolvedValue('Parc National');
      component.ngOnInit();
      await Promise.resolve();
      expect(component.protectedAreaName).toBe('Parc National');
    });
  });

  describe('buildForm', () => {
    it('should populate fields array from required schema properties', () => {
      expect(component.fields.length).toBeGreaterThan(0);
    });

    it('should mark latitude and longitude fields as readonly', () => {
      const latField = component.fields.find((f) => f.key === 'latitude');
      const lonField = component.fields.find((f) => f.key === 'longitude');
      expect(latField?.readonly).toBe(true);
      expect(lonField?.readonly).toBe(true);
    });
  });

  describe('submit', () => {
    it('should call activeModal.close with the form value', () => {
      component.submit();
      expect(mockActiveModal.close).toHaveBeenCalledWith(component.form.value);
    });
  });
});
