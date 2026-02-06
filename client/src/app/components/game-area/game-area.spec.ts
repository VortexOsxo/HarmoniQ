import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GameArea } from './game-area';

describe('GameArea', () => {
  let component: GameArea;
  let fixture: ComponentFixture<GameArea>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GameArea]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GameArea);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
