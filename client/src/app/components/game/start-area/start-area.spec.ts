import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StartArea } from './start-area';

describe('StartArea', () => {
  let component: StartArea;
  let fixture: ComponentFixture<StartArea>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StartArea]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StartArea);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
