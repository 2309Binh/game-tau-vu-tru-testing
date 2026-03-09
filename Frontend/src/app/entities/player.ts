
import { PlayerModel, InputState } from '../core/game-models';
import { GameConfigType } from '../core/services/game-config.service'; 
import { GameConfig } from '../core/game-config';

export class Player {

  private player: PlayerModel;
  private config: GameConfigType;

  // --- Player Attribute Zugriff ---

    get speed(): number {
      return this.player.speed;
    }
    set speed(value: number) {
      this.player.speed = value;
    }

    get lives(): number {
      return this.player.lives;
    }
    set lives(value: number) {
      this.player.lives = value;
    }

    get levelWeapon(): number {
      return this.player.levelWeapon;
    }
    set levelWeapon(value: number) {
      this.player.levelWeapon = value;
    }

    get score(): number {
      return this.player.score;
    }
    set score(value: number) {
      this.player.score = value;
    }

    get isAlive(): boolean {
      return this.player.isAlive;
    }
    set isAlive(value: boolean) {
      this.player.isAlive = value;
    }

    get starmanActive(): boolean {
      return this.player.starmanActive;
    }
    set starmanActive(value: boolean) {
      this.player.starmanActive = value;
    }

    get keyChange(): boolean {
      return this.player.keyChange;
    }
    set keyChange(value: boolean) {
      this.player.keyChange = value;
    }


  constructor(config: GameConfigType, isMultiplayer: boolean) {
    this.config = config;
    this.player = {
      id: '1',
      name: 'Player1',
      lives: this.config.totalLives,
      isAlive: true,
      position: {
        x: this.config.canvasWidth / 2,
        y: this.config.canvasHeight - this.config.playerStartPointY,
      },
      speed: isMultiplayer ? this.config.startSpeedPlayerMulti : this.config.startSpeedPlayerSingle,
      damage: 5,
      score: 0,
      level: 1,
      levelWeapon: 1,
      starmanActive: false,
      keyChange: false,
    };
  }

  // Getter Methode, damit man Player-Daten bekommen kann
  get state(): PlayerModel {
    return this.player;
  }

  // Bewegung begrenzen
  private border(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
  }


  move(input: InputState, canvasWidth?: number, canvasHeight?: number) {
    const maxW = typeof canvasWidth === 'number' ? canvasWidth : this.config.canvasWidth;
    const maxH = typeof canvasHeight === 'number' ? canvasHeight : this.config.canvasHeight;

    if (this.player.keyChange) {
      if (input.left === true) this.player.position.x += this.player.speed;
      if (input.right === true) this.player.position.x -= this.player.speed;
      if (input.up === true) this.player.position.y += this.player.speed;
      if (input.down === true) this.player.position.y -= this.player.speed;
    }
    else {
      if (input.left === true) this.player.position.x -= this.player.speed;
      if (input.right === true) this.player.position.x += this.player.speed;
      if (input.up === true) this.player.position.y -= this.player.speed;
      if (input.down === true) this.player.position.y += this.player.speed;
    }

    this.player.position.x = this.border(this.player.position.x, 0, maxW);
    this.player.position.y = this.border(this.player.position.y, 0, maxH);
  }

  takeDamage(amount: number) {
    if (!GameConfig.starmanActive) { // Kein Schaden, wenn Starman aktiv ist
      this.player.lives -= amount;
      if (this.player.lives <= 0) {
        this.player.lives = 0;
        this.player.isAlive = false;
      }
    }
  }

  drawPlayer(x: number, y: number, images: any, ctx: CanvasRenderingContext2D) {
    const img = images.ship;
    const drawW = 68;
    const drawH = 68;
  
    ctx.save();
    ctx.imageSmoothingEnabled = false;
  

    // Starman- Animation
    if (this.starmanActive) {
      const elapsed = performance.now(); // laufende Zeit für Animation
    
      const glowRadius = 20 + Math.sin(elapsed * 0.01) * 15; // stärker pulsierend
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, glowRadius);
    
      const t = elapsed * 0.004; // schnellere Regenbogenrotation
      gradient.addColorStop(0, `hsl(${(t * 360) % 360}, 100%, 70%)`);
      gradient.addColorStop(0.2, `hsl(${(t * 360 + 60) % 360}, 100%, 70%)`);
      gradient.addColorStop(0.4, `hsl(${(t * 360 + 120) % 360}, 100%, 70%)`);
      gradient.addColorStop(0.6, `hsl(${(t * 360 + 180) % 360}, 100%, 70%)`);
      gradient.addColorStop(0.8, `hsl(${(t * 360 + 240) % 360}, 100%, 70%)`);
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
    
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
      ctx.fill();
    }


    // Spieler zeichnen
    if (img) {
      ctx.drawImage(img, x - drawW / 2, y - drawH / 2, drawW, drawH);
      
    } else {
      // Fallback Triangle
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(x, y - 10);
      ctx.lineTo(x - 8, y + 8);
      ctx.lineTo(x + 8, y + 8);
      ctx.closePath();
      ctx.fill();
    }
    
  
    ctx.restore();
  }
}