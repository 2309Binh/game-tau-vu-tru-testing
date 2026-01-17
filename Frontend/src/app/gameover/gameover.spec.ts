import { ComponentFixture, TestBed } from '@angular/core/testing';

// 1. Prüfe, ob der Pfad stimmt. Heißt die Datei 'gameover.ts' oder 'gameover.component.ts'?
// Wenn sie 'gameover.component.ts' heißt, musst du den Pfad anpassen:
import { GameOverComponent } from './gameover'; 

describe('GameOverComponent', () => { // Name des Tests angepasst
  // 2. Hier den richtigen Klassennamen nutzen
  let component: GameOverComponent;
  let fixture: ComponentFixture<GameOverComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      // 3. Auch hier die Klasse importieren, nicht 'Gameover'
      imports: [GameOverComponent]
    })
    .compileComponents();

    // 4. Und hier beim Erstellen
    fixture = TestBed.createComponent(GameOverComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});