import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, ViewChild, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router'; // WICHTIG für die Weiterleitung
import { initGame } from './game.logic';
import { HudComponent } from '../hud/hud';
import { GameConfig } from '../core/game-config';

@Component({
  standalone: true,
  selector: 'app-game',
  imports: [CommonModule, HudComponent], 
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.css']
})
export class GameComponent implements AfterViewInit, OnDestroy {
  
  @ViewChild('canvas', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild(HudComponent) hudComponent!: HudComponent; 
  
  // --- EINSTELLUNGEN ---
  readonly POINTS_PER_LEVEL = 2500; 
  score = 0; 
  lives = 100; 
  level = 1;
  nextLevelThreshold = this.POINTS_PER_LEVEL;

  private gameInstance: any = null;
  
  // Handler Referenzen für Cleanup
  private _keyDownHandler: ((e: KeyboardEvent)=>void) | null = null;
  private _keyUpHandler: ((e: KeyboardEvent)=>void) | null = null;
  // Gamepad
  private _gamepadLoopHandle: number | null = null;
  private _prevButtons: boolean[] = [];
  private _gamepadIndex = 0; // use first connected gamepad by default
  
  // Audio
  private bgm: HTMLAudioElement | null = null;
  private shotSfx: HTMLAudioElement | null = null;

  constructor(
    private router: Router, 
    private ngZone: NgZone
  ) {}

  ngAfterViewInit(): void {
    // Kurzer Timeout, damit der View sicher bereit ist
    setTimeout(() => { this.start(); }, 50);
  }

  @HostListener('window:resize')
  onResize() {
    if (this.canvasRef?.nativeElement) {
      const canvas = this.canvasRef.nativeElement;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      GameConfig.canvasWidth = window.innerWidth;
      GameConfig.canvasHeight = window.innerHeight;
    }
  }

  start() {
    console.log('[GameComponent] start() called');
    
    // Reset Stats
    this.score = 0; 
    this.lives = 100; 
    this.level = 1;

    // Alte Instanz aufräumen
    if (this.gameInstance) {
      this.gameInstance.destroy();
      this.gameInstance = null;
    }
    this.detachKeyboardControls();

    // Außerhalb der Angular Zone starten für Performance
    this.ngZone.runOutsideAngular(() => {
      setTimeout(() => {
        if (!this.canvasRef) return;
        
        const canvas = this.canvasRef.nativeElement;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        
        GameConfig.canvasWidth = window.innerWidth;
        GameConfig.canvasHeight = window.innerHeight;

        this.startBgm(); 

        // Spiel initialisieren
        this.gameInstance = initGame(canvas, {
          pointsPerLevel: this.POINTS_PER_LEVEL,
          onScoreUpdate: (s) => this.ngZone.run(() => this.updateScore(s)),
          onLivesUpdate: (l) => this.ngZone.run(() => this.updateLives(l)),
          onLevelUpdate: (l) => this.ngZone.run(() => this.level = l),
          onGameOver: (s) => this.ngZone.run(() => this.onGameOverClean(s))
        });

        this.attachKeyboardControls();
        this.attachGamepadControls();
      }, 50);
    });
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
      // Primary shoot buttons - common arcade layouts: 0..3 are face buttons
      const shootButtonIndices = [0,1,2,3,4,5];
      let shootOnce = false;
      for (const idx of shootButtonIndices) {
        if (btns[idx] && !this._prevButtons[idx]) {
          shootOnce = true;
          break;
        }
      }

      // Start / Select mapping: try common indices 8/9
      const startPressed = !!(btns[9] || btns[8]);

      // Build partial input map (same shape as keyboard handler)
      const inputMap: any = {};
      inputMap.left = left;
      inputMap.right = right;
      inputMap.up = up;
      inputMap.down = down;
      if (shootOnce) {
        inputMap.shootOnce = true;
        this.playShotSound();
      }
      if (startPressed) inputMap.start = true;

      if (this.gameInstance) this.gameInstance.setInput(inputMap);

      // Save previous
      this._prevButtons = btns;
    } catch (e) {
      // ignore polling errors
    }
  }

  // --- HELPER METHODEN ---

  updateScore(newScore: number) {
     this.score = newScore;
     // Level Berechnung
     const currentLevel = Math.floor(this.score / this.POINTS_PER_LEVEL) + 1;
     if (currentLevel > this.level) {
        this.level = currentLevel;
        this.nextLevelThreshold = this.level * this.POINTS_PER_LEVEL;
     }
  }

  updateLives(newLives: number) {
    // Treffer-Indikator im HUD auslösen
    if (newLives < this.lives && this.hudComponent) {
      this.hudComponent.hitIndicator = true;
      setTimeout(() => { 
        if(this.hudComponent) this.hudComponent.hitIndicator = false; 
      }, 300);
    }
    this.lives = newLives;
  }

  startBgm() {
     try {
      if (!this.bgm) {
        const bgmSrc = (GameConfig as any).bgm || '/assets/sound/background.mp3';
        this.bgm = new Audio(bgmSrc);
        this.bgm.loop = true;
        this.bgm.volume = 0.25;
        this.bgm.preload = 'auto';
      }

      const tryPlay = () => {
        if (!this.bgm) return Promise.reject();
        return this.bgm.play();
      };

      tryPlay().catch(() => {
        // Autoplay blocked — start on first user gesture
        const onUserGesture = () => {
          try {
            if (this.bgm) this.bgm.play().catch(() => {});
          } catch (err) {}
          window.removeEventListener('pointerdown', onUserGesture);
          window.removeEventListener('keydown', onUserGesture);
        };
        window.addEventListener('pointerdown', onUserGesture, { once: true } as any);
        window.addEventListener('keydown', onUserGesture, { once: true } as any);
      });
    } catch (e) { console.warn(e); }
  }

  private playShotSound() {
    try {
      if (!this.shotSfx) {
        const shotSrc = (GameConfig as any).shotSound || '/assets/sound/shot.mp3';
        this.shotSfx = new Audio(shotSrc);
      }
      const s = this.shotSfx.cloneNode() as HTMLAudioElement;
      s.volume = 0.5;
      s.play().catch(() => {});
    } catch (err) {}
  }

  // --- CONTROLS ---

  private attachKeyboardControls(){
    if(typeof window === 'undefined') return;
    if(this._keyDownHandler) return;

    this._keyDownHandler = (e: KeyboardEvent) => {
      if(!this.gameInstance) return;
      const code = e.code;
      const map: any = {};
      
      if(code === 'ArrowLeft' || code === 'KeyA') { map.left = true; e.preventDefault(); }
      if(code === 'ArrowRight' || code === 'KeyD') { map.right = true; e.preventDefault(); }
      if(code === 'ArrowUp' || code === 'KeyW') { map.up = true; e.preventDefault(); }
      if(code === 'ArrowDown' || code === 'KeyS') { map.down = true; e.preventDefault(); }
      
      if(code === 'Space' || code === 'Spacebar') { 
        map.shootOnce = true; 
        e.preventDefault(); 
        this.playShotSound(); 
      }
      
      this.gameInstance.setInput(map);
    };

    this._keyUpHandler = (e: KeyboardEvent) => {
      if(!this.gameInstance) return;
      const code = e.code;
      const map: any = {};
      
      if(code === 'ArrowLeft' || code === 'KeyA') { map.left = false; e.preventDefault(); }
      if(code === 'ArrowRight' || code === 'KeyD') { map.right = false; e.preventDefault(); }
      if(code === 'ArrowUp' || code === 'KeyW') { map.up = false; e.preventDefault(); }
      if(code === 'ArrowDown' || code === 'KeyS') { map.down = false; e.preventDefault(); }
      
      this.gameInstance.setInput(map);
    };

    window.addEventListener('keydown', this._keyDownHandler);
    window.addEventListener('keyup', this._keyUpHandler);
  }

  private detachKeyboardControls(){
    if(typeof window === 'undefined') return;
    if(this._keyDownHandler) window.removeEventListener('keydown', this._keyDownHandler);
    if(this._keyUpHandler) window.removeEventListener('keyup', this._keyUpHandler);
    this._keyDownHandler = null;
    this._keyUpHandler = null;
  }

  // --- GAME OVER & CLEANUP ---

  onGameOverClean(finalScore: number) {
    console.log("GAME OVER - Redirecting to /game-over with score:", finalScore);
    
    // 1. Alles aufräumen
    if (this.gameInstance) {
      this.gameInstance.destroy();
      this.gameInstance = null;
    }
    this.detachKeyboardControls();
    this.detachGamepadControls();

    // 2. Musik stoppen
    if (this.bgm) {
      this.bgm.pause();
      this.bgm.currentTime = 0;
    }

    // 3. WEITERLEITUNG ZUR NEUEN SEITE
    this.router.navigate(['/game-over'], { state: { score: finalScore } });
  }

  ngOnDestroy(): void {
    if (this.gameInstance) this.gameInstance.destroy();
    this.detachKeyboardControls();
    this.detachGamepadControls();
    if (this.bgm) this.bgm.pause();
  }
}