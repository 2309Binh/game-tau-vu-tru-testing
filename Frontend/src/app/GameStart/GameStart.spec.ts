import { ComponentFixture, TestBed } from '@angular/core/testing';
// replace with the actual exported name from ./GameStart
import { GameStartComponent } from './GameStart';

describe('GameStartComponent', () => {
  let component: GameStartComponent;
  let fixture: ComponentFixture<GameStartComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [GameStartComponent]
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