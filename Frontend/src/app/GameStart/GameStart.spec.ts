import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GameStartComponent } from './GameStart';

describe('GameStartComponent', () => {
  let component: GameStartComponent;
  let fixture: ComponentFixture<GameStartComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GameStartComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GameStartComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
