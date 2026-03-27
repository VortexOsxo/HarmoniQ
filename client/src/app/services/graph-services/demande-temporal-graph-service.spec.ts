import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DemandeTemporalGraphService } from './demande-temporal-graph-service';
import { Scenario } from '@app/models/scenario';
import { Weather } from '@app/models/weather';
import { Consumption } from '@app/models/consumption';

vi.mock('plotly.js-dist-min', () => ({
  newPlot: vi.fn(),
  purge: vi.fn(),
  downloadImage: vi.fn(),
}));

const MOCK_SCENARIO: Scenario = {
  id: 1,
  nom: 'Test 2035',
  description: '',
  date_de_debut: '2035-01-01T00:00:00',
  date_de_fin: '2035-12-31T00:00:00',
  pas_de_temps: 'PT1H',
  weather: Weather.Typical,
  consomation: Consumption.Normal,
};

const MOCK_SCENARIO_2: Scenario = { ...MOCK_SCENARIO, id: 2, nom: 'Test 2050' };

const MOCK_TEMPORAL_RESPONSE = {
  total_electricity: {
    '2035-01-01T00:00:00': 8_000_000,
    '2035-01-01T01:00:00': 9_000_000,
  },
};

const TEMPORAL_ENDPOINT = 'http://localhost:5000/api/demande/temporal';

describe('DemandeTemporalGraphService', () => {
  let service: DemandeTemporalGraphService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        DemandeTemporalGraphService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(DemandeTemporalGraphService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    vi.clearAllMocks();
  });

  describe('getStepName', () => {
    it('should return a non-empty string', () => {
      expect(service.getStepName()).toBeTruthy();
    });
  });

  describe('generate', () => {
    it('should POST to the temporal demand endpoint', async () => {
      const generatePromise = service.generate(MOCK_SCENARIO);

      const req = httpMock.expectOne(TEMPORAL_ENDPOINT);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(MOCK_SCENARIO);
      req.flush(MOCK_TEMPORAL_RESPONSE);

      await generatePromise;
    });

    it('should cache data after the first call and not re-request for same scenario', async () => {
      const first = service.generate(MOCK_SCENARIO);
      httpMock.expectOne(TEMPORAL_ENDPOINT).flush(MOCK_TEMPORAL_RESPONSE);
      await first;

      const second = service.generate(MOCK_SCENARIO);
      httpMock.expectNone(TEMPORAL_ENDPOINT);
      await second;
    });

    it('should make a new HTTP request when scenario id changes', async () => {
      const first = service.generate(MOCK_SCENARIO);
      httpMock.expectOne(TEMPORAL_ENDPOINT).flush(MOCK_TEMPORAL_RESPONSE);
      await first;

      const second = service.generate(MOCK_SCENARIO_2);
      httpMock.expectOne(TEMPORAL_ENDPOINT).flush(MOCK_TEMPORAL_RESPONSE);
      await second;
    });

    it('should store fetched data in cachedData', async () => {
      const generatePromise = service.generate(MOCK_SCENARIO);
      httpMock.expectOne(TEMPORAL_ENDPOINT).flush(MOCK_TEMPORAL_RESPONSE);
      await generatePromise;

      expect(service.cachedData).toEqual(MOCK_TEMPORAL_RESPONSE);
    });
  });
});
