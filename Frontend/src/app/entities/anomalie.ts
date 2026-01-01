import { AnomalieModel, PlayerModel } from "../core/game-models";
import { GameConfig } from "../core/game-config";
import { Player } from "./player";

export class Anomalie {
  private level: number = 1;
  private spawnWaveCount: number = 0;
  private lastWaveAt: number = 0;

  private readonly W = GameConfig.canvasWidth;
  private readonly H = GameConfig.canvasHeight;

  //erzeugt einzelne Anomalie
  createAnomalie(hp: number, speed: number, strength: number, scorePoints: number): AnomalieModel {
    return {
      x: Math.random() * this.W,
      y: 0,
      radius: Math.random() * (20 - 10) + 10,
      hp,
      speed,
      strength,
      scorePoints,
      imageIndex : undefined
    };
  }


  spawnWave(player: PlayerModel, anomalien: AnomalieModel[]): AnomalieModel[] {
    const count =
      2 +
      Math.floor(this.level * 0.8) +
      Math.floor(Math.random() * 2);

    for (let i = 0; i < count; i++) {
      const r = 12 + Math.floor(Math.random() * 18) + this.level * 2; //radius größer je höher das level 
      const x = Math.random() * (this.W - 80) + 40; //zufälige Position 

      anomalien.push({ //neue Anomalie wird in internen Array gepusht
        x,
        y: -50 - (i * 150) - (Math.random() * 50),
        radius: r,
        speed: 1 + Math.random() * 1.6 + (this.level * 0.15),
        hp: r * 2,
        strength: Math.round(r * 10), //zur zeit nicht gebraucht 
        scorePoints: 100 + Math.round(this.level * 10) + Math.round(r),
        imageIndex: Math.floor(Math.random() * 7) //Zufälliges Bild für die Anomalie auswählen
      });
    }

    this.spawnWaveCount++;
    // Level progression is driven by score (game logic). Do not
    // change player stats here to avoid unexpected upgrades.
    return anomalien;
  }

  
   updateSpawn(player: PlayerModel, anomalienLength: number, images: any, ctx: any, anomalien: AnomalieModel[]): AnomalieModel[] {
    const needNewWave =
     anomalienLength === 0 ||
      (Date.now() - this.lastWaveAt > 1200 &&
      anomalienLength < Math.max(1, 3 + Math.floor(this.level / 2)));

    if (needNewWave) {
      this.spawnWave(player, anomalien);
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

      // Hits machine: use GameConfig thresholds so visual machine size matches collision
      const machineCenterX = this.W / 2;
      const machineCollisionHalfWidth = (GameConfig.machineCollisionHalfWidth ?? 384);
      const machineCollisionTopY = this.H - (GameConfig.machineCollisionYOffset ?? 65);

      if (a.y + a.radius >= machineCollisionTopY && Math.abs(a.x - machineCenterX) < machineCollisionHalfWidth) {
        // damage is percentage of anomalie's HP, fallback to small fixed damage
        const dmg = Math.max(1, Math.round((GameConfig.machineDamageAnomalieCollision / 100) * a.hp));
        player.takeDamage(dmg);
        anomalien.splice(i, 1);
        continue;
      }

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
      console.log("Weapon level increased to " + player.levelWeapon);
    } else { // Jede ungerade Level Speed-Upgrade
      player.speed += 0.4;
      console.log("Speed increased to " + player.speed);
    }
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
      const hpBarWidth = fullWidth * (a.hp / (a.radius * 2));

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
