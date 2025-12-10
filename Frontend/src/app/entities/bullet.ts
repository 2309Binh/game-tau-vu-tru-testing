import {BulletModel, PlayerModel } from "../core/game-models";

export class Bullet {
  private bullet: BulletModel;

  constructor(player: PlayerModel) {
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

  move(): void {
    this.bullet.y -= this.bullet.speed;
  }
  
  static fireBullet(bullets: BulletModel[], player: PlayerModel) {
    bullets.push({
      x: player.position.x,
      y: player.position.y - 14,
      speed: 8,
      damage: 15 + player.levelWeapon * 5
    });
  }

  drawBullet(ctx: any, bullets: BulletModel[]): void {
    ctx.fillStyle = '#fff'; 
    for (const b of bullets) {
      ctx.fillRect(b.x - 2, b.y - 6, 4, 8);
  }
  }
}