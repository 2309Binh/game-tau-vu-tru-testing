import { AnomalieModel, PlayerModel } from "../core/game-models";
import { Player } from "./player";
import { Bullet } from "./bullet";
import { GameConfigType } from "../core/services/game-config.service";


export class Anomalie {
  private level: number = 1;
  private spawnWaveCount: number = 0;
  private lastWaveAt: number = 0;

  private W: number;
  private H: number;
  private config: GameConfigType;

  constructor(config: GameConfigType, canvasWidth: number, canvasHeight: number) {
    this.config = config;
    this.W = canvasWidth;
    this.H = canvasHeight;
  }


  //erzeugt einzelne Anomalie
  /*
  createAnomalie(hp: number, speed: number, strength: number, scorePoints: number): AnomalieModel {
    return {
      x: Math.random() * this.W,
      y: 0,
      radius: Math.random() * (20 - 10) + 10,
      hp,
      speed,
      strength,
      scorePoints,
      imageIndex : undefined,
      maxHp: hp
    };
  }*/


  spawnWave(player: PlayerModel, anomalien: AnomalieModel[], side: 'left' | 'right' | 'all', canvasWidth: number, isMultiplayer : boolean): AnomalieModel[] {
    const count = 2 + Math.floor(this.level * 0.8) + Math.floor(Math.random() * 2);
  
    for (let i = 0; i < count; i++) {
      const r = 12 + Math.floor(Math.random() * 18) + this.level * 2;
      let x: number = 0;
  
      if(side === 'left') {
        x = Math.random() * (canvasWidth / 2 - 40) + 40;
      } 
      else if(side === 'right') {
        x = canvasWidth / 2  + Math.random() * (canvasWidth / 2 - 40);
      }
      else if(side === 'all') {
        x = Math.random() * (this.W - 80) + 40;
      }
  
      const hp = Math.round( //hier für multi schwierigkeit anpassen
        r * r * 
        (isMultiplayer ? this.config.schwierigkeitHPAnomalieMulti : this.config.schwierigkeitHPAnomalie) * 
        (1 + player.level * 0.18) *
        (0.85 + Math.random() * 0.3) *
        (Math.random() < (isMultiplayer ? this.config.percentageBigAnomalieMulti : this.config.percentageBigAnomalie) ? 2.5 : 1)
      );
  
      anomalien.push({
        x,
        y: -50 - (i * 150) - (Math.random() * 50),
        radius: r,
        speed: this.config.startSpeedAnomalies + Math.random() * 1.6 + (player.level * (isMultiplayer ? this.config.speedIncreasePerLevelAnomaliesMulti : this.config.speedIncreasePerLevelAnomalies)),
        hp,
        strength: 0,
        scorePoints: hp,
        imageIndex: Math.floor(Math.random() * 7),
        maxHp: hp
      });
    }
  
    this.spawnWaveCount++;
    return anomalien;
  }
  

  
  updateSpawn(player: PlayerModel, anomalienLength: number, images: any, ctx: any, anomalien: AnomalieModel[], side: 'left' | 'right' | 'all', canvasWidth: number, isMultiplayer : boolean): AnomalieModel[] {
    if (anomalienLength === 0 || (Date.now() - this.lastWaveAt > 1200 && anomalienLength < Math.max(1, 3 + Math.floor(this.level / 2)))) {
      this.spawnWave(player, anomalien, side, canvasWidth, isMultiplayer);
      this.lastWaveAt = Date.now();
    }
    return anomalien;
  }
  

  //Bewewegung von Anomalien
  move(player: Player,anomalienLength: number, anomalien: AnomalieModel[]): void {
    for (let i = anomalienLength - 1; i >= 0; i--) {
      const a = anomalien[i];

      a.y += a.speed;
      a.x += Math.sin((a.speed + Date.now() / 1000) * 2) * 0.5;
      // Machine collision handled centrally in game logic; do not duplicate here.

      // Offscreen
      if (a.y > this.H + 50) {
        anomalien.splice(i, 1);
      }
    }
  }

  
  // Apply a single level-up to the player (public so game logic
  // can trigger upgrades when score crosses thresholds).
  public levelUp(player: PlayerModel): void {
    player.level++;
    // Jede zweite Level Weapon-Upgrade
    if (player.level % 2 === 0) {
      player.levelWeapon = Math.min(5, player.levelWeapon + 1);
    } else { // Jede ungerade Level Speed-Upgrade
      player.speed += 0.4;
    }
    console.log("Player stats - Level: " + player.level + ", Weapon Level: " + player.levelWeapon + ", Speed: " + player.speed);
  }

  
  get currentLevel(): number {
    return this.level;
  }

  drawAnomalie(images: any, ctx: CanvasRenderingContext2D, anomalien: AnomalieModel[]): void {

    const anomalieImages = images.anomalie;

    for (const a of anomalien) {
      const img = a.imageIndex !== undefined ? anomalieImages[a.imageIndex] : null;
      const maxSize = Math.max(16, a.radius * 2);
      const aspectRatio = img.width / img.height; //Berücksichtigt das Seitenverhältnis des Bildes
      let width: number, height: number;

      if (aspectRatio > 1) {
        // Bild breiter als hoch
        width = maxSize;
        height = maxSize / aspectRatio;
      } else {
        // Bild höher oder quadratisch
        width = maxSize * aspectRatio;
        height = maxSize;
      }

      if (img) {
        ctx.drawImage(img, a.x - width / 2, a.y - height / 2, width, height);
      } else {
        ctx.fillStyle = '#8b5cf6';
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.radius, 0, Math.PI * 2);
        ctx.fill();
      }
  
      // Draw HP bar
      const fullWidth = a.radius * 2.1;
      const hpBarWidth = fullWidth * (a.hp / a.maxHp);

      ctx.fillStyle = '#ff6f00';
      ctx.fillRect(
        a.x - fullWidth / 2,
        a.y + a.radius + 10,
        hpBarWidth,
        4
      );
    }
  }
}
