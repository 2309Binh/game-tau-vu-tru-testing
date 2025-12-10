import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
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
  
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  // --- EINSTELLUNGEN ---
  readonly POINTS_PER_LEVEL = 2500; 

  // --- HUD VARIABLEN ---
  score = 0; 
  lives = 100; 
  level = 1;
  highscore = 0;
  
  // Punkte pro Level
  nextLevelThreshold = this.POINTS_PER_LEVEL;

  private gameInstance: any = null;
  private _keyDownHandler: ((e: KeyboardEvent)=>void) | null = null;
  private _keyUpHandler: ((e: KeyboardEvent)=>void) | null = null;

  // Audio
  private bgm: HTMLAudioElement | null = null;
  private shotSfx: HTMLAudioElement | null = null;

  constructor(private router: Router, private ngZone: NgZone) {}

  ngAfterViewInit(): void {
    // Canvas Größe
    try{
      const canvas = this.canvasRef?.nativeElement;
      if(canvas){
        if(!canvas.width) canvas.width = Math.max(400, Math.min(800, canvas.clientWidth || 400));
        if(!canvas.height) canvas.height = Math.max(300, Math.min(600, canvas.clientHeight || 480));
      }
    }catch(e){ console.warn('Error sizing canvas', e); }

    // Highscore laden
    try{
      if(typeof window !== 'undefined' && 'localStorage' in window){
        const allKey = 'smart_game_alltime';
        const savedScore = window.localStorage.getItem(allKey);
        this.highscore = savedScore ? parseInt(savedScore, 10) : 0;
      }
    }catch(err){ console.warn('Error reading localStorage', err); }

    if (typeof document !== 'undefined') {
    const game = document.getElementById('game-screen');
    const over = document.getElementById('gameover-screen');

    // Spiel sofort anzeigen
    if (game) game.classList.remove('hidden');

    // GameOver weiterhin versteckt
    if (over) over.classList.add('hidden');
    this.start();
    }
  }

  start(){
    console.log('[GameComponent] start() called');
    
    // Screens umschalten
    const startScreen = document.getElementById('start-screen');
    const gameScreen = document.getElementById('game-screen');
    const gameoverScreen = document.getElementById('gameover-screen');
    
    if(startScreen) startScreen.classList.add('hidden');
    if(gameoverScreen) gameoverScreen.classList.add('hidden');
    if(gameScreen) gameScreen.classList.remove('hidden');

    // Cleanup
    if(this.gameInstance && this.gameInstance.destroy){
      this.gameInstance.destroy();
      this.detachKeyboardControls();
    }
    this.gameInstance = null;

    // Reset Variablen
    this.score = 0; 
    this.lives = 100; 
    this.level = 1;
    this.nextLevelThreshold = this.POINTS_PER_LEVEL;

    const canvas = this.canvasRef.nativeElement;
    
    // BGM Starten
    try {
      if (!this.bgm) {
        this.bgm = new Audio(GameConfig.bgm);
        this.bgm.loop = true;
        this.bgm.volume = GameConfig.bgmVolume;
      }
      this.bgm.play().catch((err) => console.warn('BGM play blocked', err));
    } catch (err) { console.warn('Error starting BGM', err); }
    
    // --- INIT GAME LOGIC ---
    this.gameInstance = initGame(canvas, {
      
      // HIER WIRD DER FEHLER BEHOBEN: Wir übergeben pointsPerLevel
      pointsPerLevel: this.POINTS_PER_LEVEL,

      onScoreUpdate: (newScore: number) => {
        this.ngZone.run(() => {
          this.score = newScore;
          
        
          const currentLevel = Math.floor(this.score / this.POINTS_PER_LEVEL) + 1;
          
          // Wenn das HUD noch alt ist, zwingen wir es auf den neuen Stand:
          if (currentLevel > this.level) {
             console.log("HUD Zwangsuptade auf Level:", currentLevel);
             this.level = currentLevel;
          }
          
          // Nächstes Ziel berechnen
          this.nextLevelThreshold = this.level * this.POINTS_PER_LEVEL;
          // ------------------------------

          if (this.score > this.highscore) {
            this.highscore = this.score;
          }
        });
      },
      onLivesUpdate: (newLives: number) => {
        this.ngZone.run(() => {
          this.lives = newLives;
        });
      },
      onLevelUpdate: (newLevel: number) => {
        this.ngZone.run(() => {
          this.level = newLevel;
          this.nextLevelThreshold = this.level * this.POINTS_PER_LEVEL;
        });
      },
      onGameOver: (score: number) => {
        this.ngZone.run(() => {
          this.onGameOverClean(score);
        });
      }
    });
    
    this.attachKeyboardControls();
    console.log('[GameComponent] gameInstance created');
  }

  // --- Helpers ---

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

  back(){ this.router.navigateByUrl('/'); }

  showHelp(){ 
    document.getElementById('start-screen')?.classList.add('hidden'); 
    document.getElementById('help-screen')?.classList.remove('hidden'); 
  }
  
  hideHelp(){ 
    document.getElementById('help-screen')?.classList.add('hidden'); 
    document.getElementById('start-screen')?.classList.remove('hidden'); 
  }

  saveScore(){ 
    const name = ((document.getElementById('name') as HTMLInputElement)?.value || 'Anon').slice(0,12);
    const keyAll = 'smart_game_alltime'; 
    try{ 
      const all = Number(localStorage.getItem(keyAll) || '0'); 
      if(this.score > all) localStorage.setItem(keyAll, String(this.score)); 
      this.highscore = Math.max(this.score, all); 
    } catch(e){ console.warn('Could not save score', e); }
    
    document.getElementById('start-screen')?.classList.remove('hidden');
    document.getElementById('gameover-screen')?.classList.add('hidden');
  }

  onGameOverClean(sc:number){
    if(this.gameInstance && this.gameInstance.destroy){
      this.gameInstance.destroy();
    }
    this.gameInstance = null;
    this.detachKeyboardControls();
    
    this.score = sc;
    const final = document.getElementById('final-score');
    if(final) final.textContent = String(sc);
    
    document.getElementById('game-screen')?.classList.add('hidden');
    document.getElementById('gameover-screen')?.classList.remove('hidden');
  }

  ngOnDestroy(): void {
    if (this.gameInstance && this.gameInstance.destroy) this.gameInstance.destroy();
    this.detachKeyboardControls();
    
    try {
      if (this.bgm) {
        this.bgm.pause();
        this.bgm.currentTime = 0;
      }
    } catch {}
  }

  private playShotSound() {
    try {
      if (!this.shotSfx) {
        this.shotSfx = new Audio(GameConfig.shotSound);
        this.shotSfx.preload = 'auto';
      }
      const s = this.shotSfx.cloneNode() as HTMLAudioElement;
      s.volume = GameConfig.shotSoundVolume;

      s.play().catch(() => {});
    } catch (err) { console.warn('Error playing shot SFX', err); }
  }
}