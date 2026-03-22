import { TestBed, ComponentFixture } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { provideRouter } from '@angular/router';
import { DocsPage } from './docs-page';

describe('DocsPage', () => {
  let component: DocsPage;
  let fixture: ComponentFixture<DocsPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DocsPage],
      providers: [provideRouter([])],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(DocsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the docs page component', () => {
    expect(component).toBeTruthy();
  });

  describe('toggleDetail', () => {
    it('should add an id to activeDetails when not present', () => {
      component.toggleDetail('section-1');

      expect(component.isDetailActive('section-1')).toBe(true);
    });

    it('should remove an id from activeDetails when already present', () => {
      component.toggleDetail('section-1');
      component.toggleDetail('section-1');

      expect(component.isDetailActive('section-1')).toBe(false);
    });

    it('should handle multiple independent detail ids', () => {
      component.toggleDetail('section-1');
      component.toggleDetail('section-2');

      expect(component.isDetailActive('section-1')).toBe(true);
      expect(component.isDetailActive('section-2')).toBe(true);
    });
  });

  describe('isDetailActive', () => {
    it('should return false for an id that has never been toggled', () => {
      expect(component.isDetailActive('unknown-id')).toBe(false);
    });

    it('should return true after the id is toggled on', () => {
      component.toggleDetail('my-id');

      expect(component.isDetailActive('my-id')).toBe(true);
    });
  });

  describe('onSelectionChange', () => {
    it('should update selectedProduction with the event target value', () => {
      const mockEvent = { target: { value: 'hydroelectric' } } as unknown as Event;

      component.onSelectionChange(mockEvent);

      expect(component.selectedProduction()).toBe('hydroelectric');
    });

    it('should update selectedProduction to empty string when no value', () => {
      const mockEvent = { target: { value: '' } } as unknown as Event;

      component.onSelectionChange(mockEvent);

      expect(component.selectedProduction()).toBe('');
    });
  });

  describe('getHeroStyle', () => {
    it('should return an object', () => {
      expect(typeof component.getHeroStyle()).toBe('object');
    });

    it('should return an object with background-image property when a valid production type is selected', () => {
      component.selectedProduction.set('hydro');

      const style = component.getHeroStyle();

      expect(style).toHaveProperty('background-image');
    });
  });
});
