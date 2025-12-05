import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { initGame } from './game.logic';

@Component({
  standalone: true,
  imports: [CommonModule],
  selector: 'app-game',
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.css']
})
export class GameComponent implements AfterViewInit, OnDestroy {

  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  score = 0;
  lives = 50;
  level = 1;

  private gameInstance: any = null;
  private _keyDownHandler: ((e: KeyboardEvent) => void) | null = null;
  private _keyUpHandler: ((e: KeyboardEvent) => void) | null = null;

  private bgm: HTMLAudioElement | null = null;
  private shotSfx: HTMLAudioElement | null = null;
  private machineHitSfx: HTMLAudioElement | null = null;

  constructor(private router: Router) {}

  ngAfterViewInit(): void {
    // Ensure canvas resolution
    try {
      const canvas = this.canvasRef?.nativeElement;
      if (canvas) {
        if (!canvas.width) canvas.width = Math.max(400, Math.min(800, canvas.clientWidth || 400));
        if (!canvas.height) canvas.height = Math.max(300, Math.min(600, canvas.clientHeight || 480));
      }
    } catch (e) { console.warn('Error sizing canvas', e); }

    // Initial UI state
    try {
      if (typeof document !== 'undefined') {
        const start = document.getElementById('start-screen');
        const help = document.getElementById('help-screen');
        const game = document.getElementById('game-screen');
        const over = document.getElementById('gameover-screen');

        if (start) start.classList.remove('hidden');
        if (help) help.classList.add('hidden');
        if (game) game.classList.add('hidden');
        if (over) over.classList.add('hidden');

        // Load highscores
        try {
          if (typeof window !== 'undefined' && 'localStorage' in window) {
            const allKey = 'smart_game_alltime';
            const dailyKey = 'smart_game_daily_' + (new Date()).toISOString().slice(0, 10);

            const at = document.getElementById('alltime-high');
            if (at) at.textContent = String(localStorage.getItem(allKey) || '0');

            const dt = document.getElementById('daily-high');
            if (dt) dt.textContent = String(localStorage.getItem(dailyKey) || '0');
          }
        } catch (err) { console.warn('Error reading localStorage', err); }
      }
    } catch (e) { console.warn('Error initializing UI state', e); }
  }

  start() {
    console.log('[GameComponent] start() called');

    const startScreen = document.getElementById('start-screen');
    const gameScreen = document.getElementById('game-screen');
    const gameoverScreen = document.getElementById('gameover-screen');

    if (startScreen) startScreen.classList.add('hidden');
    if (gameoverScreen) gameoverScreen.classList.add('hidden');
    if (gameScreen) gameScreen.classList.remove('hidden');

    // Destroy previous game
    try {
      if (this.gameInstance && this.gameInstance.destroy) {
        this.gameInstance.destroy();
        this.detachKeyboardControls();
      }
    } catch (e) { console.warn('Error cleaning previous game instance', e); }

    this.gameInstance = null;

    // Reset stats
    this.score = 0;
    this.level = 1;

    const canvas = this.canvasRef.nativeElement;
    console.log('[GameComponent] creating initGame with canvas', canvas);

    // Start BGM
    try {
      if (!this.bgm) {
        this.bgm = new Audio('/assets/sound/background.mp3');
        this.bgm.loop = true;
        this.bgm.volume = 0.05;
      }
      this.bgm.play().catch((err) => console.warn('BGM play blocked', err));
    } catch (err) { console.warn('Error starting BGM', err); }

    // Init game
    this.gameInstance = initGame(canvas, {
      hudScore: document.querySelector('#hud-score'),
      hudLives: document.querySelector('#hud-lives'),
      hudLevel: document.querySelector('#hud-level'),
      onGameOver: (score: number) => this.onGameOverClean(score),
      onFire: () => this.playShotSound(),
      onMachineHit: () => this.playMachineHitSound(),
      // pass starting lives into game logic so edits to `this.lives` take effect
      startLives: this.lives,
    });

    this.attachKeyboardControls();

    console.log('[GameComponent] gameInstance created', this.gameInstance);
  }

  pause() {
    if (this.gameInstance) {
      this.gameInstance.destroy();
      this.gameInstance = null;
      this.detachKeyboardControls();

      try {
        if (this.bgm) {
          this.bgm.pause();
          this.bgm.currentTime = 0;
        }
      } catch (e) { console.warn('Error stopping BGM', e); }
    } else {
      const canvas = this.canvasRef.nativeElement;

      this.gameInstance = initGame(canvas, {
        hudScore: document.querySelector('#hud-score'),
        hudLives: document.querySelector('#hud-lives'),
        hudLevel: document.querySelector('#hud-level'),
        onGameOver: (score: number) => this.onGameOver(score),
        onFire: () => this.playShotSound(),
        onMachineHit: () => this.playMachineHitSound(),
        startLives: this.lives,
      });

      this.attachKeyboardControls();
    }
  }

  private attachKeyboardControls() {
    if (typeof window === 'undefined') return;
    if (this._keyDownHandler) return;

    this._keyDownHandler = (e: KeyboardEvent) => {
      if (!this.gameInstance) return;
      const map: any = {};
      const code = e.code;

      if (code === 'ArrowLeft' || code === 'KeyA') { map.left = true; e.preventDefault(); }
      if (code === 'ArrowRight' || code === 'KeyD') { map.right = true; e.preventDefault(); }
      if (code === 'ArrowUp' || code === 'KeyW') { map.up = true; e.preventDefault(); }
      if (code === 'ArrowDown' || code === 'KeyS') { map.down = true; e.preventDefault(); }
      if (code === 'Space' || code === 'Spacebar') { map.shootOnce = true; e.preventDefault(); }

      this.gameInstance.setInput(map);
    };

    this._keyUpHandler = (e: KeyboardEvent) => {
      if (!this.gameInstance) return;
      const map: any = {};
      const code = e.code;

      if (code === 'ArrowLeft' || code === 'KeyA') { map.left = false; e.preventDefault(); }
      if (code === 'ArrowRight' || code === 'KeyD') { map.right = false; e.preventDefault(); }
      if (code === 'ArrowUp' || code === 'KeyW') { map.up = false; e.preventDefault(); }
      if (code === 'ArrowDown' || code === 'KeyS') { map.down = false; e.preventDefault(); }

      this.gameInstance.setInput(map);
    };

    window.addEventListener('keydown', this._keyDownHandler);
    window.addEventListener('keyup', this._keyUpHandler);
  }

  private detachKeyboardControls() {
    if (typeof window === 'undefined') return;

    if (this._keyDownHandler)
      window.removeEventListener('keydown', this._keyDownHandler);

    if (this._keyUpHandler)
      window.removeEventListener('keyup', this._keyUpHandler);

    this._keyDownHandler = null;
    this._keyUpHandler = null;
  }

  back() {
    this.router.navigateByUrl('/');
  }

  showHelp() {
    const s = document.getElementById('start-screen');
    const h = document.getElementById('help-screen');
    if (s) s.classList.add('hidden');
    if (h) h.classList.remove('hidden');
  }

  hideHelp() {
    const s = document.getElementById('start-screen');
    const h = document.getElementById('help-screen');
    if (h) h.classList.add('hidden');
    if (s) s.classList.remove('hidden');
  }

  saveScore() {
    const name = (document.getElementById('name') as HTMLInputElement)?.value || 'Anon';
    const cleanName = name.slice(0, 12);

    const keyAll = 'smart_game_alltime';
    const keyDaily = 'smart_game_daily_' + (new Date()).toISOString().slice(0, 10);

    try {
      const all = Number(localStorage.getItem(keyAll) || '0');
      const daily = Number(localStorage.getItem(keyDaily) || '0');

      if (this.score > all) localStorage.setItem(keyAll, String(this.score));
      if (this.score > daily) localStorage.setItem(keyDaily, String(this.score));
    } catch (e) { console.warn('Could not save score', e); }

    const go = document.getElementById('start-screen');
    const go2 = document.getElementById('gameover-screen');

    if (go) go.classList.remove('hidden');
    if (go2) go2.classList.add('hidden');
  }

  onGameOver(sc: number) {
    this.score = sc;

    const final = document.getElementById('final-score');
    if (final) final.textContent = String(sc);

    const gs = document.getElementById('game-screen');
    const go = document.getElementById('gameover-screen');

    if (gs) gs.classList.add('hidden');
    if (go) go.classList.remove('hidden');
  }

  onGameOverClean(sc: number) {
    try {
      if (this.gameInstance && this.gameInstance.destroy)
        this.gameInstance.destroy();
    } catch (e) { console.warn('Error destroying game instance on game over', e); }

    this.gameInstance = null;
    this.detachKeyboardControls();

    try {
      if (this.bgm) {
        this.bgm.pause();
        this.bgm.currentTime = 0;
      }
    } catch (e) {}

    this.score = sc;

    const final = document.getElementById('final-score');
    if (final) final.textContent = String(sc);

    const gs = document.getElementById('game-screen');
    const go = document.getElementById('gameover-screen');

    if (gs) gs.classList.add('hidden');
    if (go) go.classList.remove('hidden');
  }

  ngOnDestroy(): void {
    try {
      if (this.gameInstance && this.gameInstance.destroy)
        this.gameInstance.destroy();
    } catch {}

    this.detachKeyboardControls();

    try {
      if (this.bgm) {
        this.bgm.pause();
        this.bgm.currentTime = 0;
      }
    } catch {}

    try {
      if (this.shotSfx) {
        this.shotSfx.pause();
        this.shotSfx.currentTime = 0;
      }
    } catch {}
    try {
      if (this.machineHitSfx) {
        this.machineHitSfx.pause();
        this.machineHitSfx.currentTime = 0;
      }
    } catch {}
  }

  private playShotSound() {
    try {
      if (!this.shotSfx) {
        this.shotSfx = new Audio('/assets/sound/shot.mp3');
        this.shotSfx.preload = 'auto';
      }

      const s = this.shotSfx.cloneNode() as HTMLAudioElement;
      s.volume = 0.9;

      s.play().catch(() => {});
    } catch (err) {
      console.warn('Error playing shot SFX', err);
    }
  }

  private playMachineHitSound() {
    try {
      console.log('[GameComponent] playMachineHitSound called');
      if (!this.machineHitSfx) {
        this.machineHitSfx = new Audio('/assets/sound/hit.mp3');
        this.machineHitSfx.preload = 'auto';
      }

      const s = this.machineHitSfx.cloneNode() as HTMLAudioElement;
      s.volume = 0.9;
      s.play().catch((err)=>{ console.warn('Machine hit SFX play blocked or failed', err); });
    } catch (err) {
      console.warn('Error playing machine hit SFX', err);
    }
  }
}
