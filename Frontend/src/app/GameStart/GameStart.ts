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

  // Gamepad support
  private _gamepadLoopHandle: number | null = null;
  private _gamepadIndex = 0;
  private _prevButtons: boolean[] = [];

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

  ngOnDestroy(): void { this.sub?.unsubscribe(); this.detachGamepadControls(); }

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

  // --- GAMEPAD SUPPORT ---
  private attachGamepadControls() {
    if (typeof navigator === 'undefined' || !('getGamepads' in navigator)) return;
    if (this._gamepadLoopHandle) return;
    // Initialize previous buttons
    const pads = navigator.getGamepads ? navigator.getGamepads() : null;
    if (pads && pads.length > this._gamepadIndex && pads[this._gamepadIndex]) {
      const gp = pads[this._gamepadIndex];
      if (gp && gp.buttons) {
        this._prevButtons = gp.buttons.map(b => !!b.pressed);
      }
    }
    const loop = () => {
      this.gamepadPollLoop();
      this._gamepadLoopHandle = window.requestAnimationFrame(loop);
    };
    this._gamepadLoopHandle = window.requestAnimationFrame(loop);
  }

  private detachGamepadControls() {
    if (this._gamepadLoopHandle) {
      try { window.cancelAnimationFrame(this._gamepadLoopHandle); } catch(e) {}
      this._gamepadLoopHandle = null;
    }
    this._prevButtons = [];
  }

  private gamepadPollLoop() {
    try {
      const pads = navigator.getGamepads ? navigator.getGamepads() : null;
      if (!pads) return;
      const gp = pads[this._gamepadIndex];
      if (!gp) return;

      // Axes mapping (joystick)
      const deadzone = 0.3;
      const ax0 = (gp.axes && gp.axes.length > 0) ? gp.axes[0] : 0;
      const ax1 = (gp.axes && gp.axes.length > 1) ? gp.axes[1] : 0;
      const left = ax0 < -deadzone;
      const right = ax0 > deadzone;
      const up = ax1 < -deadzone;
      const down = ax1 > deadzone;

      // Buttons mapping
      const btns = gp.buttons.map(b => !!b.pressed);

      // START / SELECT handling (edge-triggered)
      const startOnce = !!(btns[9] && !this._prevButtons[9]);
      const selectOnce = !!(btns[8] && !this._prevButtons[8]);

      // Map joystick to keyboard-like actions
      if (this.showModeSelection) {
        if (left && !this._prevButtons['axis_left' as any]) { this.selectedMode = 'single'; }
        if (right && !this._prevButtons['axis_right' as any]) { this.selectedMode = 'multi'; }
      }

      // START pressed
      if (startOnce) {
        if (this.showAnleitung) {
          this.showAnleitung = false;
        } else if (this.showModeSelection) {
          this.startGame();
        } else {
          this.showModeSelection = true;
          this.selectedMode = 'single';
        }
      }

      // SELECT pressed
      if (selectOnce) {
        if (this.showAnleitung) {
          this.showAnleitung = false;
        } else if (this.showModeSelection) {
          this.showModeSelection = false;
        } else {
          this.showAnleitung = true;
        }
      }

      // Save previous buttons + simple axis markers to avoid repeat moves
      const augmentedPrev = btns.slice();
      augmentedPrev['axis_left' as any] = left;
      augmentedPrev['axis_right' as any] = right;
      augmentedPrev['axis_up' as any] = up;
      augmentedPrev['axis_down' as any] = down;
      this._prevButtons = augmentedPrev;
    } catch (e) {
      // ignore polling errors
    }
  }
}