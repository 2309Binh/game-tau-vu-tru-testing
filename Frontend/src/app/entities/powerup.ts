import { PowerupModel, AnomalieModel, PlayerModel, BulletModel } from "../core/game-models";
import { GameConfig } from "../core/game-config";


export class Powerup {

  private powerup: PowerupModel;

  constructor(anomalie: AnomalieModel) {
    this.powerup = {
      x: anomalie.x,
      y: anomalie.y,
      speed: 3,
      type: Math.random() < GameConfig.powerupTypeChance ? "good" : "bad"
    };
  }

  get state(): PowerupModel {
    return this.powerup;
  }

  apply(player: PlayerModel): void {
    if (this.powerup.type === "good") {
      player.score += 200;
      player.levelWeapon = Math.min(5, player.levelWeapon + 1);
    } else {
      player.score = Math.max(0, player.score - 150);
      player.speed = Math.max(2, player.speed - 0.6);
    }
  }
}
