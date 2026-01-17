import { Anomalie } from "../entities/anomalie";
import { Player } from "../entities/player";
import { AnomalieModel, BulletModel, PowerupModel, PlayerModel, InputState } from "../core/game-models";
import { Powerup } from "../entities/powerup";
import { Bullet } from "../entities/bullet";
import { GameConfig } from "../core/game-config";

export interface GameInitConfig {
  onScoreUpdate?: (score: number) => void;
  onLivesUpdate?: (lives: number) => void;
  onLevelUpdate?: (level: number) => void;
  onGameOver?: (score: number) => void;
  
  pointsPerLevel: number;

  hudScore?: HTMLElement | null;
  hudLives?: HTMLElement | null;
  hudLevel?: HTMLElement | null;
}

// --- HELPER: Kollision zwischen zwei Rechtecken prüfen ---
function checkCollision(r1: any, r2: any): boolean {
  return (
    r1.x < r2.x + r2.w &&
    r1.x + r1.w > r2.x &&
    r1.y < r2.y + r2.h &&
    r1.y + r1.h > r2.y
  );
}

export function initGame(canvas: HTMLCanvasElement, config: GameInitConfig) {
  const ctx = canvas.getContext('2d')!;
  const W = canvas.width, H = canvas.height;

  let raf = 0;
  let running = true;

  const player = new Player(); 
  const anomalie = new Anomalie();
  const bullet = new Bullet(player.state);
  
  let bullets: BulletModel[] = [];
  let anomalien: AnomalieModel[] = []; 
  let powerups: Powerup[] = [];

  let fireCooldown = 0;
  
  // Timer für visuelles Feedback
  let damageBlinkTimer = 0;   // Für den Spieler
  let machineBlinkTimer = 0;  // Für die Maschine
  let machineInvulnerableTimer = 0; // frames during which machine takes no damage

  // INPUT
  const input: InputState = { left: false, right: false, up: false, down: false, shootOnce: false };
  const keyDownListener = (e: KeyboardEvent) => {
    switch (e.key) {
      case "ArrowLeft": case "a": input.left = true; break;
      case "ArrowRight": case "d": input.right = true; break;
      case "ArrowUp": case "w": input.up = true; break;
      case "ArrowDown": case "s": input.down = true; break;
      case " ": input.shootOnce = true; break;
    }
  };
  const keyUpListener = (e: KeyboardEvent) => {
    switch (e.key) {
      case "ArrowLeft": case "a": input.left = false; break;
      case "ArrowRight": case "d": input.right = false; break;
      case "ArrowUp": case "w": input.up = false; break;
      case "ArrowDown": case "s": input.down = false; break;
    }
  };
  if (typeof window !== 'undefined') {
    window.addEventListener("keydown", keyDownListener);
    window.addEventListener("keyup", keyUpListener);
  }
  
  //-----------------Image Preloading--------------------
  const images: { 
    ship: HTMLImageElement | null; 
    anomalie: HTMLImageElement[]; 
    maschine: HTMLImageElement | null 
  } = { ship: null, anomalie: [], maschine: null };
  
  function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(img);
      img.src = src;
    });
  }
  
  async function preloadImages() {
    const entries = Object.entries(GameConfig.imagesToLoad);
    for (const [key, value] of entries) {
      try {
        if (Array.isArray(value)) {
          const loadedImages = await Promise.all(value.map(loadImage));
          (images as any)[key] = loadedImages;
        } else {
          const img = await loadImage(value as string);
          (images as any)[key] = img;
        }
      } catch (e) {
        console.warn("Failed to load image(s)", value, e);
        (images as any)[key] = Array.isArray(value) ? [] : null;
      }
    }
  }

  /* -------------------- Helper: Distanz -------------------- */
  function dist(ax: number, ay: number, bx: number, by: number) {
    const dx = ax - bx;
    const dy = ay - by;
    return Math.sqrt(dx * dx + dy * dy);
  }
    
  function step() { 
    const livesBefore = player.state.lives; 
    player.move(input);

    if (fireCooldown > 0) fireCooldown -= 1;
    if (machineInvulnerableTimer > 0) machineInvulnerableTimer -= 1;
    if (input.shootOnce) {
      if (fireCooldown <= 0) {
        Bullet.fireBullet(bullets, player.state);
        fireCooldown = Math.max(6 - player.state.levelWeapon, 2);
      }
      input.shootOnce = false;
    }

    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.y -= b.speed;
      if (b.y < -10) bullets.splice(i, 1);
    }

    /* -------------------- ANOMALIE UPDATE & MOVE -------------------- */
    anomalie.updateSpawn(player.state, anomalien.length, images, ctx, anomalien); 
    anomalie.move(player, anomalien.length, anomalien); 

    /* -------------------- MASCHINEN & BODEN KOLLISION (Der wichtige Teil!) -------------------- */
    
    // Compute machine collision rect using GameConfig collision tuning.
    const machCenterX = W / 2;
    const machineHalfWidth = GameConfig.machineCollisionHalfWidth ?? 384;
    const machineTopY = H - (GameConfig.machineCollisionYOffset ?? 65);
    // Rectangle spans from collision top down to bottom of canvas
    const machineRect = {
      x: machCenterX - machineHalfWidth,
      y: machineTopY,
      w: machineHalfWidth * 2,
      h: H - machineTopY
    };

    for (let i = anomalien.length - 1; i >= 0; i--) {
      const a = anomalien[i];
      
      // Anomalie Hitbox
      const anomalyRect = {
          x: a.x - a.radius,
          y: a.y - a.radius,
          w: a.radius * 2,
          h: a.radius * 2
      };

      let hitMachine = false;

      // CHECK A: Trifft die Anomalie die Maschine?
      if (checkCollision(anomalyRect, machineRect)) {
          hitMachine = true;
          console.log("Treffer: Maschine (Mitte)!");
      }
      // CHECK B: Trifft die Anomalie den Boden (für die Seiten, wo keine Maschine ist)?
      else if (a.y > H) {
          hitMachine = true;
          console.log("Treffer: Boden (Seite)!");
      }

      // Wenn getroffen: apply damage unless machine is invulnerable
      if (hitMachine) {
        if (machineInvulnerableTimer <= 0) {
          const dmg = Math.max(1, Math.round((GameConfig.machineDamageAnomalieCollision / 100) * a.hp));
          player.takeDamage(dmg);

          // Start blink and invulnerability for ~1s (assuming ~60fps)
          machineBlinkTimer = 30;
          machineInvulnerableTimer = 30;

          if (config.onLivesUpdate) config.onLivesUpdate(player.state.lives);
        } else {
          // Machine is currently invulnerable: skip damage but still remove anomaly
          console.log('Maschine invulnerable - kein Schaden');
        }

        // Remove the anomalie in either case
        anomalien.splice(i, 1);
      }
    }

    /* -------------------- PLAYER VS ENEMY COLLISION -------------------- */
    const playerRect = {
      x: player.state.position.x + 10,
      y: player.state.position.y + 10,
      w: 40, 
      h: 40 
    };

    for (let i = anomalien.length - 1; i >= 0; i--) {
      const a = anomalien[i];
      const enemyRect = {
        x: a.x - a.radius,
        y: a.y - a.radius,
        w: a.radius * 2,
        h: a.radius * 2
      };

      if (checkCollision(playerRect, enemyRect)) {
        player.state.lives -= 10;
        damageBlinkTimer = 60; // Spieler blinkt
        anomalien.splice(i, 1);
        if (config.onLivesUpdate) config.onLivesUpdate(player.state.lives);
        continue; 
      }
    }

    /* -------------------- BULLET - ANOMALIE COLLISION -------------------- */
    let scoreChanged = false;
    for (let i = anomalien.length - 1; i >= 0; i--) {
      const a = anomalien[i];
      for (let j = bullets.length - 1; j >= 0; j--) {
        const b = bullets[j];
        if (dist(b.x, b.y, a.x, a.y) < a.radius + 2) {
          bullets.splice(j, 1);
          a.hp -= b.damage;

          if (a.hp <= 0) {
            player.state.score += a.scorePoints;
            scoreChanged = true;

            const pts = config.pointsPerLevel || 2500;
            const calculatedLevel = Math.floor(player.state.score / pts) + 1;
            if (calculatedLevel > player.state.level) {
              const diff = calculatedLevel - player.state.level;
              for (let k = 0; k < diff; k++) {
                anomalie.levelUp(player.state);
              }
              if (config.onLevelUpdate) config.onLevelUpdate(player.state.level);
            }

            if (Math.random() < (GameConfig.powerupChance ?? 0.18)) {
              powerups.push(new Powerup(a));
            }
            anomalien.splice(i, 1);
            break;
          }
        }
      }
    }

    if (scoreChanged && config.onScoreUpdate) {
      config.onScoreUpdate(player.state.score);
    }

    // Powerups
    for (let i = powerups.length - 1; i >= 0; i--) {
      const p = powerups[i];
      p.state.y += p.state.speed;
      if (dist(p.state.x, p.state.y, player.state.position.x, player.state.position.y) < 18) {
        p.apply(player.state);
        powerups.splice(i, 1);
        if (config.onLivesUpdate) config.onLivesUpdate(player.state.lives);
        if (config.onScoreUpdate) config.onScoreUpdate(player.state.score);
      } else if (p.state.y > H + 30) powerups.splice(i, 1);
    }

    // Fallback Check
    if (player.state.lives !== livesBefore) {
      if (config.onLivesUpdate) config.onLivesUpdate(player.state.lives);
    }

    // Game Over
    if (player.state.lives <= 0) {
      running = false;
      if (config.onGameOver) config.onGameOver(player.state.score);
    }
  }

  function render() {
    ctx.fillStyle = '#050513'; 
    ctx.fillRect(0, 0, W, H);

    // --- MASCHINE ZEICHNEN ---
    if (machineBlinkTimer > 0) machineBlinkTimer--;

    drawMachine(W / 2, H - (GameConfig.machineVisualYOffset ?? 80)); 
    
    // --- PLAYER ZEICHNEN ---
    if (damageBlinkTimer > 0) {
        damageBlinkTimer--; 
        if (Math.floor(damageBlinkTimer / 5) % 2 === 0) {
            ctx.globalAlpha = 0.3;
        } else {
            ctx.globalAlpha = 1.0;
        }
    }
    player.drawPlayer(player.state.position.x, player.state.position.y, images, ctx); 
    ctx.globalAlpha = 1.0; 
    // --------------------------

    bullet.drawBullet(ctx, bullets); 
    anomalie.drawAnomalie(images, ctx, anomalien); 

    for (const p of powerups) {
      ctx.fillStyle = p.state.type === 'good' ? '#60d394' : '#ff6b6b';
      ctx.beginPath();
      ctx.arc(p.state.x, p.state.y, 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  //Draw Machine
  function drawMachine(x: number, y: number) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(13, 7);

    // BLINK-LOGIK: Aggressiver (Ganz unsichtbar machen)
    // Damit man es auch auf dem grauen Metall sieht!
    if (machineBlinkTimer > 0) {
        if (Math.floor(machineBlinkTimer / 4) % 2 === 0) {
            // Komplett ausblenden (schwarzer Hintergrund blitzt durch)
            ctx.globalAlpha = 0; 
        } else {
            ctx.globalAlpha = 1.0;
        }
    }

    const img = images.maschine;
    if (img) {
      const drawW = 96;
      const drawH = 48;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();
      return;
    }

    // Vector fallback
    ctx.fillStyle = '#222';
    ctx.fillRect(-48, -12, 96, 24);
    ctx.fillStyle = '#444';
    ctx.fillRect(-36, -10, 72, 20);
    ctx.fillStyle = '#f9d423';
    ctx.fillRect(-6, -6, 12, 12);

    ctx.restore();
  }

  // game loop
  (async () => {
    console.log("Preloading images...");
    await preloadImages();

    let frame = () => {
      if (!running) return;
      step();
      render();
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
  })();

  /// API
  return {
    destroy() {
      running = false;
      cancelAnimationFrame(raf);
    },
    setInput(s: any) {
      Object.assign(input, s);
    },
  };
}