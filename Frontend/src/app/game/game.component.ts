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

  score = 0; lives = 100; level = 1;

  private gameInstance: any = null;
  private _keyDownHandler: ((e: KeyboardEvent)=>void) | null = null;
  private _keyUpHandler: ((e: KeyboardEvent)=>void) | null = null;
  private bgm: HTMLAudioElement | null = null;
  private shotSfx: HTMLAudioElement | null = null;

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
    // Guard DOM and storage access so SSR doesn't crash (document/window not defined on server)
    try{
      if(typeof document !== 'undefined'){
        const start = document.getElementById('start-screen');
        const help = document.getElementById('help-screen');
        const game = document.getElementById('game-screen');
        const over = document.getElementById('gameover-screen');
        if(start) { start.classList.remove('hidden'); }
        if(help) { help.classList.add('hidden'); }
        if(game) { game.classList.add('hidden'); }
        if(over) { over.classList.add('hidden'); }
        // populate highscores if present and localStorage available
        try{
          if(typeof window !== 'undefined' && 'localStorage' in window){
            const allKey = 'smart_game_alltime';
            const dailyKey = 'smart_game_daily_' + (new Date()).toISOString().slice(0,10);
            const at = document.getElementById('alltime-high'); 
            if(at) at.textContent = String(window.localStorage.getItem(allKey) || '0');
            const dt = document.getElementById('daily-high'); 
            if(dt) dt.textContent = String(window.localStorage.getItem(dailyKey) || '0');
          }
        }catch(err){ console.warn('Error reading localStorage', err); }
      }
    }catch(e){ console.warn('Error initializing UI state', e); }
  }

  start(){
    console.log('[GameComponent] start() called');
    const startScreen = document.getElementById('start-screen');
    const gameScreen = document.getElementById('game-screen');
    // hide other screens and show game screen
    const gameoverScreen = (typeof document !== 'undefined') ? document.getElementById('gameover-screen') : null;
    if(startScreen) startScreen.classList.add('hidden');
    if(gameoverScreen) gameoverScreen.classList.add('hidden');
    if(gameScreen) gameScreen.classList.remove('hidden');

    // ensure any previous instance is cleaned up so we start fresh
    try{
      if(this.gameInstance && this.gameInstance.destroy){
        this.gameInstance.destroy();
        this.detachKeyboardControls();
      }
    }catch(e){ console.warn('Error cleaning previous game instance', e); }
    this.gameInstance = null;

    // reset component HUD state
    this.score = 0; this.lives = 3; this.level = 1;

    const canvas = this.canvasRef.nativeElement;
    console.log('[GameComponent] creating initGame with canvas', canvas);
    // Start background music (user must have initiated via Start button)
    try{
      if(!this.bgm){
        this.bgm = new Audio('/assets/sound/background.mp3');
        this.bgm.loop = true;
        this.bgm.volume = 0.25;
      }
      // play returns a promise; ignore rejection (browsers may block autoplay)
      this.bgm.play().catch((err)=>console.warn('BGM play blocked', err));
    }catch(err){ console.warn('Error starting BGM', err); }
    this.gameInstance = initGame(canvas, {
      hudScore: (typeof document !== 'undefined') ? document.querySelector('#hud-score') : null,
      hudLives: (typeof document !== 'undefined') ? document.querySelector('#hud-lives') : null,
      hudLevel: (typeof document !== 'undefined') ? document.querySelector('#hud-level') : null,
      onGameOver: (score: number) => this.onGameOverClean(score),
      onFire: () => this.playShotSound()
    });
    // attach keyboard handlers
    this.attachKeyboardControls();
    console.log('[GameComponent] gameInstance created', this.gameInstance);
  }

  pause(){
    if(this.gameInstance){
      this.gameInstance.destroy();
      this.gameInstance = null;
      this.detachKeyboardControls();
      // stop background music when pausing/stopping
      try{ if(this.bgm){ this.bgm.pause(); this.bgm.currentTime = 0; } }catch(e){console.warn('Error stopping BGM', e);} 
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
      if(code === 'Space' || code === 'Spacebar') { map.shootOnce = true; e.preventDefault(); }
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
      // Do not toggle shoot on keyup; shooting is a one-shot on keydown only
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
  
  // Ensure the current game instance is cleaned up so Retry can start a fresh game
  onGameOverClean(sc:number){
    // destroy running instance if any
    try{
      if(this.gameInstance && this.gameInstance.destroy){
        this.gameInstance.destroy();
      }
    }catch(e){ console.warn('Error destroying game instance on game over', e); }
    this.gameInstance = null;
    this.detachKeyboardControls();
    // stop background music when game ends
    try{ if(this.bgm){ this.bgm.pause(); this.bgm.currentTime = 0; } }catch(e){console.warn('Error stopping BGM', e);} 
    // show gameover UI
    this.score = sc;
    const final = (typeof document !== 'undefined') ? document.getElementById('final-score') : null;
    if(final) final.textContent = String(sc);
    const gs = (typeof document !== 'undefined') ? document.getElementById('game-screen') : null;
    const go = (typeof document !== 'undefined') ? document.getElementById('gameover-screen') : null;
    if(gs) gs.classList.add('hidden');
    if(go) go.classList.remove('hidden');
  }

  ngOnDestroy(): void {
    if(this.gameInstance && this.gameInstance.destroy) this.gameInstance.destroy();
    this.detachKeyboardControls();
    try{ if(this.bgm){ this.bgm.pause(); this.bgm.currentTime = 0; } }catch(e){console.warn('Error stopping BGM on destroy', e);} 
    try{ if(this.shotSfx){ this.shotSfx.pause(); this.shotSfx.currentTime = 0; } }catch(e){console.warn('Error stopping shot SFX on destroy', e);} 
  }

  private playShotSound(){
    try{
      // lazy-create a reusable audio element and clone it to allow overlap
      if(!this.shotSfx){
        this.shotSfx = new Audio('/assets/sound/shot.mp3');
        this.shotSfx.preload = 'auto';
      }

      // clone the audio element so multiple shots can overlap
      const s = (this.shotSfx.cloneNode() as HTMLAudioElement);
      s.volume = 0.9;
      s.play().catch((err)=>{
        // playback can be blocked if user hasn't interacted; ignore
        // console.debug('Shot SFX play blocked', err);
      });
    }catch(err){ console.warn('Error playing shot SFX', err); }
  }
}

