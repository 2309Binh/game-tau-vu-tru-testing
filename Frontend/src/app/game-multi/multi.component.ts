import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, ViewChild, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { initGame } from './multi.logic';
import { HighscoreService } from '../core/services/highscore.service';
import { GameConfigService, GameConfigType } from '../core/services/game-config.service';

@Component({
  standalone: true,
  selector: 'app-game-multi',
  imports: [CommonModule],
  templateUrl: './multi.component.html',
  styleUrls: ['./multi.component.css']
})
export class GameMultiComponent implements AfterViewInit, OnDestroy {
  
  private configService = inject(GameConfigService);
  // Lokale Kopie der Config für's Spiel
  private gameConfig!: GameConfigType;

  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  POINTS_PER_LEVEL = 2000; //standardmäßig 2000

  scoreL = 0; levelL = 1; livesL = 100;
  scoreR = 0; levelR = 1; livesR = 100;
  machineHPL = 100; machineHPR = 100;

  // NEU: Variable für das Overlay 
  winnerName: string | null = null;

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

  async ngAfterViewInit(): Promise<void> {
    await this.waitForConfig();
    
    // Config einmalig kopieren
    this.gameConfig = this.configService.config()!;
    this.initializeFromConfig();

    // run start outside Angular for smoother RAF loops and input polling
    this.ngZone.runOutsideAngular(() => {
      setTimeout(() => this.start(), 50);
    });
  }

  private async waitForConfig() {
    while (!this.configService.config()) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  private initializeFromConfig() {
    const cfg = this.gameConfig;
    
    // Werte aus Config setzen
    this.POINTS_PER_LEVEL = cfg.pointsPerLevel;
    this.livesL = cfg.totalLives;
    this.livesR = cfg.totalLives;
    this.machineHPL = cfg.totalLives;
    this.machineHPR = cfg.totalLives;
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
    if(this.gameInstance && this.gameInstance.destroy) this.gameInstance.destroy();
    
    this.scoreL = 0; this.scoreR = 0;
    this.levelL = 1; this.levelR = 1;
    this.livesL = 100; this.livesR = 100;
    this.machineHPL = 100; this.machineHPR = 100;
    this.winnerName = null;

    const canvas = this.canvasRef.nativeElement;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    this.playBGM();
    
    this.gameInstance = initGame(canvas, {
      pointsPerLevel: this.POINTS_PER_LEVEL,
      GameConfig: this.gameConfig, // Add the missing GameConfig property

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
          this.router.navigate(['/']);
        });
      },

      // NEU: Winner Logik statt direktem Game Over Redirect
      onWinner: (winner: string) => {
        this.ngZone.run(() => {
          this.destroyGame();
          this.winnerName = winner;
          
          // Nach 4 Sekunden zurück zum Start (oder Game Over Screen)
          setTimeout(() => {
            const score = this.winnerName === 'PLAYER 1' ? this.scoreL : this.scoreR; //checkt wer gewonnen hat und gibt den score an game over weiter
            
            this.router.navigate(['/game-over'], { 
              state: { score }
            });
          }, 4000);
          
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
        const shotSrc = this.gameConfig.shotSound || '/assets/sound/shot.mp3';
        this.shotSfx = new Audio(shotSrc);
      }
      const s = this.shotSfx.cloneNode() as HTMLAudioElement;
      s.volume = this.gameConfig.shotSoundVolume || 0.9;
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

    // ensure mapping: pad 0 -> left, pad 1 -> right
    this._gamepadIndexLeft = 0;
    this._gamepadIndexRight = 1;

    // listen for gamepad connection changes to re-init prev arrays
    window.addEventListener('gamepadconnected', this._onGamepadConnected as EventListener);
    window.addEventListener('gamepaddisconnected', this._onGamepadDisconnected as EventListener);

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
    try {
      window.removeEventListener('gamepadconnected', this._onGamepadConnected as EventListener);
      window.removeEventListener('gamepaddisconnected', this._onGamepadDisconnected as EventListener);
    } catch (e) {}
  }

  // Ensure previous-button arrays are initialized when gamepads connect/disconnect
  private _onGamepadConnected = (ev: Event) => {
    try {
      const pads = navigator.getGamepads ? navigator.getGamepads() : null;
      if (!pads) return;
      const gpL = pads[this._gamepadIndexLeft] as Gamepad | null;
      const gpR = pads[this._gamepadIndexRight] as Gamepad | null;
      if (gpL && gpL.buttons) this._prevButtonsLeft = gpL.buttons.map(b => !!b.pressed);
      if (gpR && gpR.buttons) this._prevButtonsRight = gpR.buttons.map(b => !!b.pressed);
    } catch (e) {}
  }

  private _onGamepadDisconnected = (ev: Event) => {
    try {
      // keep mapping to pad 0 and 1; reinit arrays
      this._prevButtonsLeft = [];
      this._prevButtonsRight = [];
    } catch (e) {}
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
        // axis based movement
        let left = ax0 < -deadzone;
        let right = ax0 > deadzone;
        let up = ax1 < -deadzone;
        let down = ax1 > deadzone;

        const btns = gp.buttons.map(b => !!b.pressed);
        const shootButtonIndices = [0,1,2,3,4,5];
        let shootOnce = false;
        for (const idx of shootButtonIndices) {
          const prevVal = prev[idx] ?? false;
          if (btns[idx] && !prevVal) { shootOnce = true; break; }
        }

        // fallback: some arcade sticks expose D-Pad as buttons 12..15
        // (12=up, 13=down, 14=left, 15=right)
        if (!left && !right && !up && !down) {
          if (btns.length > 15) {
            up = up || !!btns[12];
            down = down || !!btns[13];
            left = left || !!btns[14];
            right = right || !!btns[15];
          }
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

        // copy into prev (ensure prev array is same length)
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
          const bgmSrc = this.gameConfig.bgm || '/assets/sound/background.mp3';
          this.bgm = new Audio(bgmSrc);
          this.bgm.loop = true;
          this.bgm.volume = this.gameConfig.bgmVolume || 0.25;
        }
        this.bgm.play().catch(() => {});
    } catch (e) {}
  }
}