import { TestBed, ComponentFixture } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { provideRouter } from '@angular/router';
import { TopBarLogo } from './top-bar-logo';

describe('TopBarLogo', () => {
  let component: TopBarLogo;
  let fixture: ComponentFixture<TopBarLogo>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TopBarLogo],
      providers: [provideRouter([])],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(TopBarLogo);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the top bar logo component', () => {
    expect(component).toBeTruthy();
  });

  it('should render without errors', () => {
    expect(fixture.nativeElement).toBeTruthy();
  });
});
