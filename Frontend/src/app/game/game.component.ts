import {
  AfterViewInit,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  ViewChild,
  HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { initGame } from './game.logic';
import { HudComponent } from '../hud/hud';
import { GameConfig } from '../core/game-config';
import { HighscoreService, HighscoreDto } from '../core/services/highscore.service';

@Component({
  standalone: true,
  selector: 'app-game',
  imports: [CommonModule, HudComponent],
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.css']
})
export class GameComponent implements AfterViewInit, OnDestroy {

  @ViewChild('canvas', { static: true })
  canvasRef!: ElementRef<HTMLCanvasElement>;

  @ViewChild(HudComponent)
  hudComponent!: HudComponent;

  readonly POINTS_PER_LEVEL = 2500;

  score = 0;
  lives = 100;
  level = 1;
  highscore = 0;
  nextLevelThreshold = this.POINTS_PER_LEVEL;

  topAlltime: HighscoreDto[] = [];
  topToday: HighscoreDto[] = [];

  private gameInstance: any = null;

  // ---------- KEYBOARD ----------
  private _keyDownHandler: ((e: KeyboardEvent) => void) | null = null;
  private _keyUpHandler: ((e: KeyboardEvent) => void) | null = null;

  // ---------- ARCADE / GAMEPAD ----------
  private _gamepadRAF: number | null = null;

  private readonly ARCADE = {
    DEADZONE: 0.3,
    SHOOT: 3,
    START: 9
  };

  // ---------- AUDIO ----------
  private bgm: HTMLAudioElement | null = null;
  private shotSfx: HTMLAudioElement | null = null;
  private _bgmResumeHandler: EventListener | null = null;

  constructor(
    private router: Router,
    private ngZone: NgZone,
    private highscoreService: HighscoreService
  ) {}

  // ============================================================
  // LIFECYCLE
  // ============================================================

  ngAfterViewInit(): void {
    const canvas = this.canvasRef.nativeElement;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    GameConfig.canvasWidth = canvas.width;
    GameConfig.canvasHeight = canvas.height;

    document.getElementById('game-screen')?.classList.remove('hidden');
    document.getElementById('gameover-screen')?.classList.add('hidden');

    this.start();
  }

  @HostListener('window:resize')
  onResize() {
    const canvas = this.canvasRef.nativeElement;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    GameConfig.canvasWidth = canvas.width;
    GameConfig.canvasHeight = canvas.height;
  }

  // ============================================================
  // GAME START
  // ============================================================

  start() {
    if (this.gameInstance?.destroy) {
      this.gameInstance.destroy();
    }

    this.score = 0;
    this.lives = 100;
    this.level = 1;
    this.nextLevelThreshold = this.POINTS_PER_LEVEL;

    const canvas = this.canvasRef.nativeElement;

    this.startBgm();

    this.gameInstance = initGame(canvas, {
      pointsPerLevel: this.POINTS_PER_LEVEL,

      onScoreUpdate: (score: number) => {
        this.ngZone.run(() => {
          this.score = score;
          this.level = Math.floor(score / this.POINTS_PER_LEVEL) + 1;
          this.nextLevelThreshold = this.level * this.POINTS_PER_LEVEL;
        });
      },

      onLivesUpdate: (lives: number) => {
        this.ngZone.run(() => {
          if (lives < this.lives) {
            this.hudComponent.hitIndicator = true;
            setTimeout(() => (this.hudComponent.hitIndicator = false), 300);
          }
          this.lives = lives;
        });
      },

      onLevelUpdate: (lvl: number) => {
        this.ngZone.run(() => {
          this.level = lvl;
          this.nextLevelThreshold = lvl * this.POINTS_PER_LEVEL;
        });
      },

      onGameOver: (score: number) => {
        this.ngZone.run(() => this.onGameOverClean(score));
      }
    });

    this.attachKeyboardControls();
    this.startArcadeInput();
  }

  // ============================================================
  // KEYBOARD INPUT
  // ============================================================

  private attachKeyboardControls() {
    if (this._keyDownHandler) return;

    this._keyDownHandler = (e: KeyboardEvent) => {
      if (!this.gameInstance) return;
      const map: any = {};

      if (e.code === 'ArrowLeft' || e.code === 'KeyA') map.left = true;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') map.right = true;
      if (e.code === 'ArrowUp' || e.code === 'KeyW') map.up = true;
      if (e.code === 'ArrowDown' || e.code === 'KeyS') map.down = true;

      if (e.code === 'Space') {
        map.shootOnce = true;
        this.playShotSound();
      }

      this.gameInstance.setInput(map);
      e.preventDefault();
    };

    this._keyUpHandler = (e: KeyboardEvent) => {
      if (!this.gameInstance) return;
      const map: any = {};

      if (e.code === 'ArrowLeft' || e.code === 'KeyA') map.left = false;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') map.right = false;
      if (e.code === 'ArrowUp' || e.code === 'KeyW') map.up = false;
      if (e.code === 'ArrowDown' || e.code === 'KeyS') map.down = false;

      this.gameInstance.setInput(map);
      e.preventDefault();
    };

    window.addEventListener('keydown', this._keyDownHandler);
    window.addEventListener('keyup', this._keyUpHandler);
  }

  // ============================================================
  // ARCADE INPUT (GAMEPAD)
  // ============================================================

  private startArcadeInput() {
    const loop = () => {
      if (!this.gameInstance) return;

      const gp = navigator.getGamepads?.()[0];
      if (gp) {
        const dz = this.ARCADE.DEADZONE;
        const map: any = {};

        map.left  = gp.axes[0] < -dz;
        map.right = gp.axes[0] >  dz;
        map.up    = gp.axes[1] < -dz;
        map.down  = gp.axes[1] >  dz;

        if (gp.buttons[this.ARCADE.SHOOT]?.pressed) {
          map.shootOnce = true;
          this.playShotSound();
        }

        this.gameInstance.setInput(map);
      }

      this._gamepadRAF = requestAnimationFrame(loop);
    };

    this._gamepadRAF = requestAnimationFrame(loop);
  }

  // ============================================================
  // GAME OVER
  // ============================================================

  onGameOverClean(score: number) {
    this.gameInstance?.destroy();
    this.gameInstance = null;

    if (this._gamepadRAF) {
      cancelAnimationFrame(this._gamepadRAF);
      this._gamepadRAF = null;
    }

    this.score = score;

    this.highscoreService.getTopAlltime().subscribe(d => this.topAlltime = d);
    this.highscoreService.getTopToday().subscribe(d => this.topToday = d);

    const final = document.getElementById('final-score');
    if (final) final.textContent = String(this.score);

    document.getElementById('game-screen')?.classList.add('hidden');
    document.getElementById('gameover-screen')?.classList.remove('hidden');
  }

  // ============================================================
  // AUDIO
  // ============================================================

  private startBgm() {
    if (!this.bgm) {
      const src = (GameConfig as any).bgm || '/assets/music/background.mp3';
      this.bgm = new Audio(src);
      this.bgm.loop = true;
      this.bgm.volume = (GameConfig as any).bgmVolume ?? 0.25;
    }

    this.bgm.play().catch(() => {
      if (!this._bgmResumeHandler) {
        this._bgmResumeHandler = () => {
          this.bgm?.play().catch(() => {});
          window.removeEventListener('click', this._bgmResumeHandler!);
          window.removeEventListener('keydown', this._bgmResumeHandler!);
          this._bgmResumeHandler = null;
        };
        window.addEventListener('click', this._bgmResumeHandler);
        window.addEventListener('keydown', this._bgmResumeHandler);
      }
    });
  }

  private playShotSound() {
    if (!this.shotSfx) {
      const src = (GameConfig as any).shotSound || '/assets/music/shot.mp3';
      this.shotSfx = new Audio(src);
      this.shotSfx.preload = 'auto';
    }
    const s = this.shotSfx.cloneNode() as HTMLAudioElement;
    s.volume = (GameConfig as any).shotSoundVolume ?? 0.9;
    s.play().catch(() => {});
  }

  // ============================================================
  // DESTROY
  // ============================================================

  ngOnDestroy(): void {
    this.gameInstance?.destroy();
    if (this._gamepadRAF) cancelAnimationFrame(this._gamepadRAF);

    window.removeEventListener('keydown', this._keyDownHandler!);
    window.removeEventListener('keyup', this._keyUpHandler!);
  }

  back() {
    this.router.navigateByUrl('/');
  }

  hideHelp() {
    document.getElementById('help-screen')?.classList.add('hidden');
    document.getElementById('game-screen')?.classList.remove('hidden');
  }

  saveScore() {
    const input = document.getElementById('name') as HTMLInputElement | null;
    const name = (input?.value || 'Anonymous').trim();
    this.highscoreService.save(name, this.score).subscribe({
      next: () => {
        this.highscoreService.getTopAlltime().subscribe(d => this.topAlltime = d);
        this.highscoreService.getTopToday().subscribe(d => this.topToday = d);
        alert('Score saved');
      },
      error: (err) => {
        console.error('Failed to save score', err);
        alert('Failed to save score');
      }
    });
  }
}
