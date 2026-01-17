import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, ViewChild, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { initGame } from './multi.logic';
import { GameConfig } from '../core/game-config';
import { HighscoreService } from '../core/services/highscore.service';

@Component({
  standalone: true,
  selector: 'app-game-multi',
  imports: [CommonModule],
  templateUrl: './multi.component.html',
  styleUrls: ['./multi.component.css']
})
export class GameMultiComponent implements AfterViewInit, OnDestroy {
  
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  // Settings
  readonly POINTS_PER_LEVEL = 2500; 

  // HUD Variablen
  scoreL = 0; levelL = 1; livesL = 100;
  scoreR = 0; levelR = 1; livesR = 100;
  machineHPL = 100; machineHPR = 100;

  private gameInstance: any = null;
  private bgm: HTMLAudioElement | null = null;
  private shotSfx: HTMLAudioElement | null = null;

  // Gamepad support (two players)
  private _gamepadLoopHandle: number | null = null;
  private _prevButtonsLeft: boolean[] = [];
  private _prevButtonsRight: boolean[] = [];
  private _gamepadIndexLeft = 0; // first gamepad
  private _gamepadIndexRight = 1; // second gamepad

  constructor(
    private router: Router, 
    private ngZone: NgZone,
    private highscoreService: HighscoreService
  ) {}

  ngAfterViewInit(): void {
    this.start(); // Sofortiger Start ohne Umschweife
  }

  @HostListener('window:resize')
  onResize() {
    const canvas = this.canvasRef?.nativeElement;
    if (canvas) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
  }

  start(){
    // Cleanup
    if(this.gameInstance && this.gameInstance.destroy) this.gameInstance.destroy();
    
    // Reset
    this.scoreL = 0; this.scoreR = 0;
    this.levelL = 1; this.levelR = 1;
    this.livesL = 100; this.livesR = 100;
    this.machineHPL = 100; this.machineHPR = 100;

    const canvas = this.canvasRef.nativeElement;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    this.playBGM();
    
    // Start Logic
    this.gameInstance = initGame(canvas, {
      pointsPerLevel: this.POINTS_PER_LEVEL,

      onMachineHPUpdate: (l: number, r: number) => this.ngZone.run(() => { this.machineHPL = l; this.machineHPR = r; }),

      // Player 1
      onScoreUpdateLeft: (n: number) => this.ngZone.run(() => { 
        this.scoreL = n; 
        const lvl = Math.floor(n/this.POINTS_PER_LEVEL)+1;
        if(lvl > this.levelL) this.levelL = lvl;
      }),
      onLivesUpdateLeft: (n: number) => this.ngZone.run(() => this.livesL = n),

      // Player 2
      onScoreUpdateRight: (n: number) => this.ngZone.run(() => { 
        this.scoreR = n;
        const lvl = Math.floor(n/this.POINTS_PER_LEVEL)+1;
        if(lvl > this.levelR) this.levelR = lvl;
      }),
      onLivesUpdateRight: (n: number) => this.ngZone.run(() => this.livesR = n),

      // Play shot SFX when the logic reports a fired shot
      onShot: (player: 'left'|'right') => this.ngZone.run(() => { this.playShotSound(); }),

      // GAME OVER -> Weiterleitung zur Komponente
      onGameOver: (finalScore: number) => {
        this.ngZone.run(() => {
          this.destroyGame();
          // Navigiere zur existierenden Game Over Route
          // Wir übergeben den Score via 'state', falls deine GameOverComponent das lesen kann.
          // Falls nicht, speichert der Service den Highscore ggf. anders, aber so ist es sauber.
          this.router.navigate(['/game-over'], { state: { score: finalScore } });
        });
      }
    });
    // Attach dual-gamepad polling
    this.attachGamepadControls();
  }

  destroyGame() {
    if (this.gameInstance && this.gameInstance.destroy) this.gameInstance.destroy();
    try { if (this.bgm) { this.bgm.pause(); this.bgm.currentTime = 0; } } catch {}
    this.detachGamepadControls();
  }

  ngOnDestroy(): void { this.destroyGame(); }

  // --- Gamepad: dual-player support ---
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

  private attachGamepadControls() {
    if (typeof navigator === 'undefined' || !('getGamepads' in navigator)) return;
    if (this._gamepadLoopHandle) return;

    // initialize previous arrays if pads present
    const pads = navigator.getGamepads ? navigator.getGamepads() : null;
    if (pads) {
      const gpL = pads[this._gamepadIndexLeft] as Gamepad | null;
      const gpR = pads[this._gamepadIndexRight] as Gamepad | null;
      if (gpL && gpL.buttons) this._prevButtonsLeft = gpL.buttons.map(b => !!b.pressed);
      if (gpR && gpR.buttons) this._prevButtonsRight = gpR.buttons.map(b => !!b.pressed);
    }

    const loop = () => { this.gamepadPollLoop(); this._gamepadLoopHandle = window.requestAnimationFrame(loop); };
    this._gamepadLoopHandle = window.requestAnimationFrame(loop);
  }

  private detachGamepadControls() {
    if (this._gamepadLoopHandle) {
      try { window.cancelAnimationFrame(this._gamepadLoopHandle); } catch (e) {}
      this._gamepadLoopHandle = null;
    }
    this._prevButtonsLeft = [];
    this._prevButtonsRight = [];
  }

  private gamepadPollLoop() {
    try {
      const pads = navigator.getGamepads ? navigator.getGamepads() : null;
      if (!pads) return;

      const pollFor = (gp: Gamepad | null, prev: boolean[], side: 'left' | 'right') => {
        if (!gp) return;
        const deadzone = 0.3;
        const ax0 = (gp.axes && gp.axes.length > 0) ? gp.axes[0] : 0;
        const ax1 = (gp.axes && gp.axes.length > 1) ? gp.axes[1] : 0;
        const left = ax0 < -deadzone;
        const right = ax0 > deadzone;
        const up = ax1 < -deadzone;
        const down = ax1 > deadzone;

        const btns = gp.buttons.map(b => !!b.pressed);
        const shootButtonIndices = [0,1,2,3,4,5];
        let shootOnce = false;
        for (const idx of shootButtonIndices) {
          if (btns[idx] && !(prev[idx])) { shootOnce = true; break; }
        }

        const inputMap: any = {};
        inputMap.left = left;
        inputMap.right = right;
        inputMap.up = up;
        inputMap.down = down;
        if (shootOnce) { inputMap.shootOnce = true; }

        // include player indicator so multi.logic routes properly
        inputMap.player = side === 'left' ? 'left' : 'right';

        if (this.gameInstance && this.gameInstance.setInput) this.gameInstance.setInput(inputMap);

        // copy into prev
        for (let i = 0; i < btns.length; i++) prev[i] = btns[i];
      };

      const gpL = pads[this._gamepadIndexLeft] as Gamepad | null;
      const gpR = pads[this._gamepadIndexRight] as Gamepad | null;
      pollFor(gpL, this._prevButtonsLeft, 'left');
      pollFor(gpR, this._prevButtonsRight, 'right');
    } catch (e) {
      // ignore
    }
  }

  private playBGM() {
    try {
        if (!this.bgm) {
          const bgmSrc = (GameConfig as any).bgm || '/assets/sound/background.mp3';
          this.bgm = new Audio(bgmSrc);
          this.bgm.loop = true;
          this.bgm.volume = 0.25;
        }
        this.bgm.play().catch(() => {});
    } catch (e) {}
  }
}