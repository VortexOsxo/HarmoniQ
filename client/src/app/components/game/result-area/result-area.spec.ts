import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ResultArea } from './result-area';

describe('ResultArea', () => {
  let component: ResultArea;
  let fixture: ComponentFixture<ResultArea>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResultArea]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ResultArea);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
