import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, ViewChild, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { initGame } from './multi.logic';
import { HudComponent } from '../hud/hud';
import { GameConfig } from '../core/game-config';
import { HighscoreService } from '../core/services/highscore.service';
import { HighscoreDto } from '../core/services/highscore.service';


@Component({
  standalone: true,
  selector: 'app-game-multi',
  imports: [CommonModule, HudComponent], 
  templateUrl: './multi.component.html',
  styleUrls: ['./multi.component.css']
})
export class GameMultiComponent implements AfterViewInit, OnDestroy {
  
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  
  @ViewChild(HudComponent) hudComponent!: HudComponent; 
  

  // --- EINSTELLUNGEN ---
  readonly POINTS_PER_LEVEL = 2500; 

  // --- HUD VARIABLEN ---
  score = 0; 
  lives = 100; 
  level = 1;
  highscore = 0;

  // --- HIGHSCORE LISTEN ---
  topAlltime: HighscoreDto[] = [];
  topToday: HighscoreDto[] = [];

  
  // Punkte pro Level
  nextLevelThreshold = this.POINTS_PER_LEVEL;

  private gameInstance: any = null;
  private _keyDownHandler: ((e: KeyboardEvent)=>void) | null = null;
  private _keyUpHandler: ((e: KeyboardEvent)=>void) | null = null;

  // Audio
  private bgm: HTMLAudioElement | null = null;
  private shotSfx: HTMLAudioElement | null = null;
  private _bgmResumeHandler: EventListener | null = null;

  constructor(private router: Router, private ngZone: NgZone, private highscoreService: HighscoreService ) {}

  ngAfterViewInit(): void {
    // Canvas Größe - Initialer Check
    try{
      const canvas = this.canvasRef?.nativeElement;
      if(canvas){
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
    }catch(e){ console.warn('Error sizing canvas', e); }

    // (removed local highscore persistence)

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

  // Reagiert auf Fenster-Größenänderung
  @HostListener('window:resize')
  onResize() {
    const canvas = this.canvasRef?.nativeElement;
    if (canvas) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      GameConfig.canvasWidth = window.innerWidth;
      GameConfig.canvasHeight = window.innerHeight;
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

    // Vollbild aktivieren und Config updaten
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    GameConfig.canvasWidth = window.innerWidth;
    GameConfig.canvasHeight = window.innerHeight;
    
    // BGM Starten
    try {
      if (!this.bgm) {
        const bgmSrc = (GameConfig as any).bgm || '/assets/sound/background.mp3';
        this.bgm = new Audio(bgmSrc);
        this.bgm.loop = true;
        this.bgm.volume = (GameConfig as any).bgmVolume || 0.25;
      }

      // Versuche phát ngay; nếu browser chặn (autoplay policy),
      // đăng ký một handler để thử phát lại sau tương tác người dùng.
      this.bgm.play().catch(() => {
        // Autoplay blocked: silently register one-time resume on first user gesture
        if (!this._bgmResumeHandler) {
          this._bgmResumeHandler = (e: Event) => {
            try {
              this.bgm?.play().catch(()=>{});
            } finally {
              if (this._bgmResumeHandler) {
                window.removeEventListener('click', this._bgmResumeHandler);
                window.removeEventListener('keydown', this._bgmResumeHandler);
                this._bgmResumeHandler = null;
              }
            }
          };
          window.addEventListener('click', this._bgmResumeHandler);
          window.addEventListener('keydown', this._bgmResumeHandler);
        }
      });
    } catch (err) { console.warn('Error starting BGM', err); }
    
    // --- INIT GAME LOGIC ---
    this.gameInstance = initGame(canvas, {
      
      pointsPerLevel: this.POINTS_PER_LEVEL,

      onScoreUpdate: (newScore: number) => {
        this.ngZone.run(() => {
          this.score = newScore;
          
          const currentLevel = Math.floor(this.score / this.POINTS_PER_LEVEL) + 1;
          
          if (currentLevel > this.level) {
             console.log("HUD Zwangsuptade auf Level:", currentLevel);
             this.level = currentLevel;
          }
          
          this.nextLevelThreshold = this.level * this.POINTS_PER_LEVEL;

        });
      },
      
      
      onLivesUpdate: (newLives: number) => {
        this.ngZone.run(() => {
          
          if (newLives < this.lives && this.hudComponent) {
             
             
             this.hudComponent.hitIndicator = true;

             
             setTimeout(() => {
                if (this.hudComponent) {
                   this.hudComponent.hitIndicator = false;
                }
             }, 300);
          }

          this.lives = newLives;
        });
      },
      // ----------------------------------------------------

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
    
    // input handled inside game logic for split-screen; do not attach legacy handlers
    // this.attachKeyboardControls();
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

  saveScore() {
  const name =
    (document.getElementById('name') as HTMLInputElement)?.value || 'Anon';

  this.highscoreService
    .save(name.slice(0, 12), this.score)
    .subscribe({
      next: () => {
        console.log('Score gespeichert');
      },
      error: err => console.error(err)
    });
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

    this.highscoreService.getTopAlltime().subscribe(data => {
      this.topAlltime = data;
    });

    this.highscoreService.getTopToday().subscribe(data => {
      this.topToday = data;
    });
    
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

    if (this._bgmResumeHandler) {
      try {
        window.removeEventListener('click', this._bgmResumeHandler as EventListener);
        window.removeEventListener('keydown', this._bgmResumeHandler as EventListener);
      } catch {}
      this._bgmResumeHandler = null;
    }
  }

  private playShotSound() {
    try {
      if (!this.shotSfx) {
        const shotSrc = (GameConfig as any).shotSound || '/assets/sound/shot.mp3';
        this.shotSfx = new Audio(shotSrc);
        this.shotSfx.preload = 'auto';
      }
      const s = this.shotSfx.cloneNode() as HTMLAudioElement;
      s.volume = (GameConfig as any).shotSoundVolume || 0.9;

      s.play().catch(() => {});
    } catch (err) { console.warn('Error playing shot SFX', err); }
  }
}