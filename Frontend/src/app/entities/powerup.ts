import { PowerupModel, AnomalieModel, BulletModel } from "../core/game-models";
import { GameConfig } from "../core/game-config";
import { GameConfigType } from "../core/services/game-config.service";
import { Player } from "../entities/player";



export class Powerup {

  private powerup: PowerupModel;
  private config: GameConfigType;

  constructor(anomalie: AnomalieModel, config: GameConfigType) {
    this.config = config;
    this.powerup = {
      x: anomalie.x,
      y: anomalie.y,
      speed: 3,
      type: Math.random() < this.config.powerupTypeChance ? "good" : "bad"
    };
  }
 
  get state(): PowerupModel {
    return this.powerup;
  }

  apply(player: Player, activeTexts: { text: string; x: number; y: number; spawnTime: number; duration: number }[]): void {

    let powerupText = '';

    if (this.powerup.type === "good") {
      let powerupType = this.config.powerupTypesGood[Math.floor(Math.random() * this.config.powerupTypesGood.length)];
      //let powerupType = 'Starman';
      console.log('Good Powerup applied: ' + powerupType);
      if (powerupType == 'IncreaseSpeed') {
        console.log('Speed before powerup: ' + player.speed);
        player.speed = Math.min(15, player.speed + 0.6);
        powerupText = 'Speed Increased!';
        console.log('Speed after powerup: ' + player.speed);
      } 

      else if (powerupType == 'Starman') {
        player.starmanActive = true;
        let playerSpeedBeforeStarman = player.speed;
        let playerWeaponBeforeStarman = player.levelWeapon;
        let scoreBeforeStarman = player.score;
        powerupText = 'Starman Activated! No Damage and double points for 10s!';
        
        setTimeout(() => { //Manche Sachen werden wieder zurück gesetzt bekommen aber trotzdem ein bisschen verbessert
          player.starmanActive = false;
          player.speed = Math.min(15, playerSpeedBeforeStarman + 0.5);
          player.levelWeapon = playerWeaponBeforeStarman + 1;
          this.config.bulletSpeed = 8;

        }, this.config.starmanDuration);

        player.speed = Math.min(15, player.speed + 2.1);
        player.levelWeapon = Math.min(8, player.levelWeapon + 2);
      } 

      else if (powerupType == 'RepairMachine') {
        player.lives = Math.min(100, player.lives + 20);
        powerupText = 'Machine Repaired +20 HP!';
      }
      
      else if (powerupType == 'BonusPoints') {
        player.score += 500;
        powerupText = '500 Bonus Points!';
      } 
      
      else if (powerupType == 'IncreaseWeapon') {
        console.log('Weapon Level before powerup: ' + player.levelWeapon);
        player.levelWeapon = Math.min(8, player.levelWeapon + 1);
        powerupText = 'Weapon Damage Increased!';
        console.log('Weapon Level after powerup: ' + player.levelWeapon);
      }
      
          
    } 
    else if (this.powerup.type === "bad") {
      let powerupType = this.config.powerupTypesBad[Math.floor(Math.random() * this.config.powerupTypesBad.length)];

      if (powerupType == 'DecreaseSpeed') {
        player.speed -= 0.6;
        powerupText = 'Speed Decreased!';
      }

      else if (powerupType == 'DamageMachine') {
        player.lives -= 20;
        powerupText = '-20 HP';
        if (player.lives <= 0) {
          player.lives = 0;
          player.isAlive = false;
        }
      }
      
      else if (powerupType == 'MinusPoints') {
        player.score -= 500;
        powerupText = '-500 Points!';
      } 
      
      else if (powerupType == 'DecreaseWeapon') {
        player.levelWeapon -= 1;
        powerupText = '-1 Level Weapon';
      }

      else if (powerupType == 'KeyChange') {
        player.keyChange = true;
        powerupText = 'KEYBOARD CONTROLS CHANGED!';
        setTimeout(() => {
          player.keyChange = false;
        }, this.config.keyChangeDuration);
      }
          
    } 

    activeTexts.push({
      text: powerupText,
      x: this.powerup.x,       
      y: this.powerup.y +10,
      spawnTime: performance.now(),
      duration: this.config.powerUpTextDuration      
    });
  
  }
}
