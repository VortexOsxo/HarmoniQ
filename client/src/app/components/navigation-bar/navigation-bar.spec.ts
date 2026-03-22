import { TestBed, ComponentFixture } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { provideRouter } from '@angular/router';
import { NavigationBar } from './navigation-bar';
import { TutorialService } from '@app/services/tutorial-service';

const mockTutorialService = { startTutorial: vi.fn(), resetTutorial: vi.fn() };

describe('NavigationBar', () => {
  let component: NavigationBar;
  let fixture: ComponentFixture<NavigationBar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NavigationBar],
      providers: [
        provideRouter([]),
        { provide: TutorialService, useValue: mockTutorialService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(NavigationBar);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => vi.clearAllMocks());

  it('should create the navigation bar component', () => {
    expect(component).toBeTruthy();
  });

  describe('isCollapsed', () => {
    it('should be true by default (navbar collapsed)', () => {
      expect(component.isCollapsed).toBe(true);
    });
  });

  describe('toggleNavbar', () => {
    it('should toggle isCollapsed from true to false', () => {
      component.toggleNavbar();

      expect(component.isCollapsed).toBe(false);
    });

    it('should toggle isCollapsed back to true on a second call', () => {
      component.toggleNavbar();
      component.toggleNavbar();

      expect(component.isCollapsed).toBe(true);
    });
  });

  describe('collapseNavbar', () => {
    it('should set isCollapsed to true', () => {
      component.toggleNavbar();
      component.collapseNavbar();

      expect(component.isCollapsed).toBe(true);
    });

    it('should keep isCollapsed true when already collapsed', () => {
      component.collapseNavbar();

      expect(component.isCollapsed).toBe(true);
    });
  });

  describe('startHelp', () => {
    it('should call tutorialService.resetTutorial()', () => {
      component.startHelp();

      expect(mockTutorialService.resetTutorial).toHaveBeenCalled();
    });
  });
});
