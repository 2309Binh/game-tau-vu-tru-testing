import { Component, OnDestroy, OnInit, HostListener } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { HighscoreService, HighscoreDto } from '../core/services/highscore.service'; // Pfad prüfen!
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-game-start',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './GameStart.html', // Achte auf Groß/Kleinschreibung
  styleUrls: ['./GameStart.css']
})
export class GameStartComponent implements OnInit, OnDestroy {

  topAlltime: HighscoreDto[] = [];
  topToday: HighscoreDto[] = [];
  
  // ZUSTÄNDE DES MENÜS
  showModeSelection = false;
  showAnleitung = false;
  
  // AUSWAHL-CURSOR (Startet bei Singleplayer)
  selectedMode: 'single' | 'multi' = 'single';

  private sub?: Subscription;

  constructor(
    private router: Router, 
    private highscoreService: HighscoreService
  ) {}

  ngOnInit(): void {
    this.loadTopScores();
    
    // Wenn man vom Spiel zurückkommt, Menü resetten
    this.sub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        if (e.urlAfterRedirects === '/' || e.urlAfterRedirects.startsWith('/?')) {
          this.loadTopScores();
          this.showModeSelection = false;
          this.showAnleitung = false;
          this.selectedMode = 'single';
        }
      });
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  private loadTopScores(): void {
    this.highscoreService.getTopAlltime().subscribe(d => this.topAlltime = d);
    this.highscoreService.getTopToday().subscribe(d => this.topToday = d);
  }

  // --- STEUERUNG FÜR ARCADE (TASTE 9 & 8) ---
  @HostListener('window:keydown', ['$event'])
  handleInput(event: KeyboardEvent) {
    const code = event.code; 

    // === FALL 1: ANLEITUNG IST OFFEN ===
    if (this.showAnleitung) {
        // Schließen mit: SELECT (8) oder START (9) oder Button 1 (Strg)
        if (code === 'Digit8' || code === 'Digit9' || code === 'ControlLeft' || code === 'Escape') {
            this.showAnleitung = false;
        }
        return;
    }

    // === FALL 2: MODUS AUSWAHL IST OFFEN ===
    if (this.showModeSelection) {
        
        // JOYSTICK LINKS -> Singleplayer markieren
        if (code === 'ArrowLeft' || code === 'KeyA') {
            this.selectedMode = 'single';
        }
        
        // JOYSTICK RECHTS -> Multiplayer markieren
        if (code === 'ArrowRight' || code === 'KeyD') {
            this.selectedMode = 'multi';
        }

        // BESTÄTIGEN MIT: START (9) oder Button 1 (Strg)
        if (code === 'Digit9' || code === 'Enter' || code === 'Space' || code === 'ControlLeft') {
            this.startGame();
        }

        // ZURÜCK MIT: SELECT (8)
        if (code === 'Digit8' || code === 'Escape') {
            this.showModeSelection = false;
        }
        return;
    }

    // === FALL 3: STARTBILDSCHIRM (Blinkt PRESS START) ===
    if (!this.showModeSelection && !this.showAnleitung) {
        
        // START (9) DRÜCKEN -> Öffnet die Auswahl
        if (code === 'Digit9' || code === 'Enter' || code === 'Space' || code === 'ControlLeft') {
            this.showModeSelection = true;
            this.selectedMode = 'single'; // Cursor Reset
        }

        // SELECT (8) DRÜCKEN -> Öffnet Anleitung
        if (code === 'Digit8' || code === 'KeyH') {
            this.showAnleitung = true;
        }
    }
  }

  startGame() {
    if (this.selectedMode === 'single') {
        this.router.navigate(['/game']);
    } else {
        this.router.navigate(['/game-multi']);
    }
  }
}