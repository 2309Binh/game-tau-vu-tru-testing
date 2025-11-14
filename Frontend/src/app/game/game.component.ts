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

  score = 0; lives = 3; level = 1;

  private gameInstance: any = null;
  private _keyDownHandler: ((e: KeyboardEvent)=>void) | null = null;
  private _keyUpHandler: ((e: KeyboardEvent)=>void) | null = null;

  constructor(private router: Router) {}

  ngAfterViewInit(): void {
    // ensure canvas has reasonable pixel dimensions after view initializes
    try{
      const canvas = this.canvasRef?.nativeElement;
      if(canvas){
        // set default resolution if not already set
        if(!canvas.width) canvas.width = Math.max(400, Math.min(800, canvas.clientWidth || 400));
        if(!canvas.height) canvas.height = Math.max(300, Math.min(600, canvas.clientHeight || 480));
      }
    }catch(e){ console.warn('Error sizing canvas', e); }
    // Ensure correct initial UI state: show start screen, hide help/game/gameover
    try{
      const start = document.getElementById('start-screen');
      const help = document.getElementById('help-screen');
      const game = document.getElementById('game-screen');
      const over = document.getElementById('gameover-screen');
      if(start) { start.classList.remove('hidden'); }
      if(help) { help.classList.add('hidden'); }
      if(game) { game.classList.add('hidden'); }
      if(over) { over.classList.add('hidden'); }
      // populate highscores if present
      const allKey = 'smart_game_alltime';
      const dailyKey = 'smart_game_daily_' + (new Date()).toISOString().slice(0,10);
      const at = document.getElementById('alltime-high'); if(at) at.textContent = String(localStorage.getItem(allKey) || '0');
      const dt = document.getElementById('daily-high'); if(dt) dt.textContent = String(localStorage.getItem(dailyKey) || '0');
    }catch(e){ console.warn('Error initializing UI state', e); }
  }

  start(){
    console.log('[GameComponent] start() called');
    const startScreen = document.getElementById('start-screen');
    const gameScreen = document.getElementById('game-screen');
    if(startScreen) startScreen.classList.add('hidden');
    if(gameScreen) gameScreen.classList.remove('hidden');

    if(!this.gameInstance){
      const canvas = this.canvasRef.nativeElement;
      console.log('[GameComponent] creating initGame with canvas', canvas);
      this.gameInstance = initGame(canvas, {
        hudScore: document.querySelector('#hud-score'),
        hudLives: document.querySelector('#hud-lives'),
        hudLevel: document.querySelector('#hud-level'),
        onGameOver: (score: number) => this.onGameOver(score)
      });
      // attach keyboard handlers
      this.attachKeyboardControls();
      console.log('[GameComponent] gameInstance created', this.gameInstance);
    }
  }

  pause(){
    if(this.gameInstance){
      this.gameInstance.destroy();
      this.gameInstance = null;
      this.detachKeyboardControls();
    } else {
      const canvas = this.canvasRef.nativeElement;
      this.gameInstance = initGame(canvas, {
        hudScore: document.querySelector('#hud-score'),
        hudLives: document.querySelector('#hud-lives'),
        hudLevel: document.querySelector('#hud-level'),
        onGameOver: (score: number) => this.onGameOver(score)
      });
      this.attachKeyboardControls();
    }
  }

  private attachKeyboardControls(){
    if(this._keyDownHandler) return;
    this._keyDownHandler = (e: KeyboardEvent) => {
      if(!this.gameInstance) return;
      const code = e.code;
      const map: any = {};
      if(code === 'ArrowLeft' || code === 'KeyA') { map.left = true; e.preventDefault(); }
      if(code === 'ArrowRight' || code === 'KeyD') { map.right = true; e.preventDefault(); }
      if(code === 'ArrowUp' || code === 'KeyW') { map.up = true; e.preventDefault(); }
      if(code === 'ArrowDown' || code === 'KeyS') { map.down = true; e.preventDefault(); }
      if(code === 'Space' || code === 'Spacebar') { map.shoot = true; e.preventDefault(); }
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
      if(code === 'Space' || code === 'Spacebar') { map.shoot = false; e.preventDefault(); }
      this.gameInstance.setInput(map);
    };

    window.addEventListener('keydown', this._keyDownHandler);
    window.addEventListener('keyup', this._keyUpHandler);
  }

  private detachKeyboardControls(){
    if(this._keyDownHandler) window.removeEventListener('keydown', this._keyDownHandler);
    if(this._keyUpHandler) window.removeEventListener('keyup', this._keyUpHandler);
    this._keyDownHandler = null;
    this._keyUpHandler = null;
  }

  back(){ this.router.navigateByUrl('/'); }

  showHelp(){ const s = document.getElementById('start-screen'); const h = document.getElementById('help-screen'); if(s) s.classList.add('hidden'); if(h) h.classList.remove('hidden'); }
  hideHelp(){ const s = document.getElementById('start-screen'); const h = document.getElementById('help-screen'); if(h) h.classList.add('hidden'); if(s) s.classList.remove('hidden'); }

  saveScore(){ const name = ((document.getElementById('name') as HTMLInputElement)?.value || 'Anon').slice(0,12);
    const keyAll = 'smart_game_alltime'; const keyDaily = 'smart_game_daily_' + (new Date()).toISOString().slice(0,10);
    try{ const all = Number(localStorage.getItem(keyAll) || '0'); const daily = Number(localStorage.getItem(keyDaily) || '0'); if(this.score > all) localStorage.setItem(keyAll, String(this.score)); if(this.score > daily) localStorage.setItem(keyDaily, String(this.score)); }
    catch(e){ console.warn('Could not save score', e); }
    const go = document.getElementById('start-screen'); const go2 = document.getElementById('gameover-screen'); if(go) go.classList.remove('hidden'); if(go2) go2.classList.add('hidden');
  }

  onGameOver(sc:number){ this.score = sc; const final = document.getElementById('final-score'); if(final) final.textContent = String(sc); const gs = document.getElementById('game-screen'); const go = document.getElementById('gameover-screen'); if(gs) gs.classList.add('hidden'); if(go) go.classList.remove('hidden'); }

  ngOnDestroy(): void {
    if(this.gameInstance && this.gameInstance.destroy) this.gameInstance.destroy();
    this.detachKeyboardControls();
  }
}

