import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DocsPage } from './docs-page';
import { provideRouter } from '@angular/router';

describe('DocsPage', () => {
  let component: DocsPage;
  let fixture: ComponentFixture<DocsPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DocsPage],
      providers: [
        provideRouter([])
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DocsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('devrait créer le composant', () => {
    expect(component).toBeTruthy();
  });

  it('devrait initialiser avec la production eolienne par défaut', () => {
    expect(component.selectedProduction()).toBe('eolienne');
  });

  it('devrait mettre à jour la sélection et vider les détails actifs sur onSelectionChange', () => {
    const mockEvent = { target: { value: 'hydro' } } as unknown as Event;

    component.activeDetails.set(new Set(['test_func']));

    component.onSelectionChange(mockEvent);

    expect(component.selectedProduction()).toBe('hydro');
    expect(component.activeDetails().size).toBe(0);
  });

  it('devrait retourner le style diviser par le type de production courant', () => {
    component.selectedProduction.set('eolienne');
    const style: any = component.getHeroStyle();

    expect(style['background-image']).toContain("https://images.pexels.com/photos/414837/pexels-photo-414837.jpeg");
    expect(style['background-image']).toContain("linear-gradient");
  });

  it('devrait retourner un objet vide si la sélection est introuvable', () => {
    component.selectedProduction.set('inexistant' as any);
    const style = component.getHeroStyle();
    expect(style).toEqual({});
  });

  it('devrait basculer l\'état et la visibilité des descriptions de fonctions (toggleDetail)', () => {
    const funcName = 'test_function';

    expect(component.isDetailActive(funcName)).toBe(false);

    component.toggleDetail(funcName);
    expect(component.isDetailActive(funcName)).toBe(true);

    component.toggleDetail(funcName);
    expect(component.isDetailActive(funcName)).toBe(false);
  });

  it('devrait formater correctement les noms affichés (ajout de () pour les fonctions)', () => {
    expect(component.getDisplayName('myFunction')).toBe('myFunction()');
    expect(component.getDisplayName('MyClass')).toBe('MyClass');
    expect(component.getDisplayName('')).toBe('');
  });
});
