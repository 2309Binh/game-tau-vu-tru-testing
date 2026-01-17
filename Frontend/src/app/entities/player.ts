
import { PlayerModel, InputState } from '../core/game-models';
import { GameConfig } from '../core/game-config';

export class Player {

  private player: PlayerModel;

  constructor() {
    this.player = {
      id: '1',
      name: 'Player1',
      lives: 100,
      isAlive: true,
      position: {
        x: GameConfig.canvasWidth / 2,
        y: GameConfig.canvasHeight - 80,
      },
      speed: 5,
      damage: 5,
      score: 0,
      level: 1,
      levelWeapon: 1,
      width: 40,
      height: 40,
      color: 'blue',
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
    const maxW = typeof canvasWidth === 'number' ? canvasWidth : GameConfig.canvasWidth;
    const maxH = typeof canvasHeight === 'number' ? canvasHeight : GameConfig.canvasHeight;

    if (input.left === true) this.player.position.x -= this.player.speed;
    if (input.right === true) this.player.position.x += this.player.speed;
    if (input.up === true) this.player.position.y -= this.player.speed;
    if (input.down === true) this.player.position.y += this.player.speed;

    this.player.position.x = this.border(this.player.position.x, 0, maxW);
    this.player.position.y = this.border(this.player.position.y, 0, maxH);
  }

  takeDamage(amount: number) {
    this.player.lives -= amount;
    if (this.player.lives <= 0) {
      this.player.lives = 0;
      this.player.isAlive = false;
    }
  }

  drawPlayer(x: number, y: number,images: any, ctx: any) {
    const img = images.ship;
  
    if (img) {
      const drawW = 68;
      const drawH = 68;
  
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, x - drawW / 2, y - drawH / 2, drawW, drawH);
  
      return;
    }
  
    // Fallback triangle ship
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(x, y - 10);
    ctx.lineTo(x - 8, y + 8);
    ctx.lineTo(x + 8, y + 8);
    ctx.closePath();
    ctx.fill();
  
    // Laser glow
    ctx.fillStyle = '#e04cff';
    ctx.fillRect(x - 1, y - 20, 2, 8);
  }
}