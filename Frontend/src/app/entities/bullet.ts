import {BulletModel, PlayerModel } from "../core/game-models";
import { GameConfigType } from "../core/services/game-config.service";

export class Bullet {
  private bullet: BulletModel;
  private config: GameConfigType;



  constructor(config: GameConfigType, player: PlayerModel) {
    this.config = config;
    this.bullet = {
      x: player.position.x,
      y: player.position.y - 14,
      speed: 8,
      damage: 15 + player.levelWeapon * 5,
    };
  }

  get state(): BulletModel {
    return this.bullet;
  }
  
  static fireBullet(bullets: BulletModel[], player: PlayerModel, config: GameConfigType): void {
    bullets.push({
      x: player.position.x,
      y: player.position.y - 14,
      speed: config.bulletSpeed,
      damage: 15 + player.levelWeapon * 5
    });
  }

  drawBullet(ctx: any, bullets: BulletModel[],player: PlayerModel): void {
    if(!player.starmanActive){
      ctx.fillStyle = '#fff'; 
      for (const b of bullets) {
        ctx.fillRect(b.x - 2, b.y - 6, 4, 8);
      }
    }
    else{
        for (let i = 0; i < bullets.length; i++) {
          const b = bullets[i];
      
          //Bunte Farbe, die sich über die Zeit ändert
          const hue = (performance.now() / 10 + i * 30) % 360; 
          ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
      
          ctx.fillRect(b.x - 2, b.y - 6, 4, 8);
        }
    }
  }
}