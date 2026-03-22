import { TestBed, ComponentFixture } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { Router } from '@angular/router';
import { HomePage } from './home-page';

const mockRouter = { navigate: vi.fn() };

describe('HomePage', () => {
  let component: HomePage;
  let fixture: ComponentFixture<HomePage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomePage],
      providers: [
        { provide: Router, useValue: mockRouter },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(HomePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => vi.clearAllMocks());

  it('should create the home page component', () => {
    expect(component).toBeTruthy();
  });

  describe('navigate', () => {
    it('should call router.navigate with the provided path', () => {
      component.navigate('/map');

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/map']);
    });

    it('should navigate to the simulation route', () => {
      component.navigate('/simulation');

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/simulation']);
    });

    it('should navigate to the about route', () => {
      component.navigate('/à-propos');

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/à-propos']);
    });
  });
});
