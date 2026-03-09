import { Anomalie } from "../entities/anomalie";
import { Player } from "../entities/player";
import { AnomalieModel, BulletModel, PowerupModel, PlayerModel, InputState } from "../core/game-models";
import { Powerup } from "../entities/powerup";
import { Bullet } from "../entities/bullet";
import { GameConfig } from "../core/game-config";
import { GameConfigService, GameConfigType } from "../core/services/game-config.service";


export interface GameInitConfig {
  onScoreUpdate?: (score: number) => void;
  onLivesUpdate?: (lives: number) => void;
  onLevelUpdate?: (level: number) => void;
  onGameOver?: (score: number) => void;
  
  
  pointsPerLevel: number;
  GameConfig: GameConfigType;

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

  const player = new Player(config.GameConfig, false); // false, da Singleplayer
  const anomalie = new Anomalie(config.GameConfig, W, H);
  const bullet = new Bullet(config.GameConfig, player.state);
  
  let bullets: BulletModel[] = [];
  let anomalien: AnomalieModel[] = []; 
  let powerups: Powerup[] = [];
  let activeTexts: { text: string; x: number; y: number; spawnTime: number; duration: number }[] = [];

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
    const entries = Object.entries(config.GameConfig.imagesToLoad);
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
        Bullet.fireBullet(bullets, player.state, config.GameConfig);
        fireCooldown = Math.max(6 - player.state.levelWeapon, 2);
      }
      input.shootOnce = false;
    }

    // -------------------- BULLET UPDATE & MOVE --------------------

    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.y -= b.speed;
      if (b.y < -10) bullets.splice(i, 1);
      
    }

    /* -------------------- ANOMALIE UPDATE & MOVE -------------------- */
    anomalie.updateSpawn(player.state, anomalien.length, images, ctx, anomalien, 'all', W, false); // false für Singleplayer
    anomalie.move(player, anomalien.length, anomalien); 

    /* -------------------- MASCHINEN & BODEN KOLLISION (Der wichtige Teil!) -------------------- */
    
    // Compute machine collision rect using GameConfig collision tuning.
    const machCenterX = W / 2;
    const machineHalfWidth = config.GameConfig.machineCollisionHalfWidth ?? 384;
    const machineTopY = H - (config.GameConfig.machineCollisionYOffset ?? 65);
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

      // Wenn getroffen und Starman deaktiviert: apply damage unless machine is invulnerable
      if (hitMachine && !player.starmanActive) { 
        if (machineInvulnerableTimer <= 0) {
          const dmg = Math.max(1, Math.round((config.GameConfig.machineDamageAnomalieCollision / 100) * a.hp)); //damage based on anomaly HP
          player.takeDamage(dmg);

          // Start blink and invulnerability for ~1s (assuming ~60fps)
          machineBlinkTimer = config.GameConfig.machineBlinkDuration;
          machineInvulnerableTimer = config.GameConfig.machineInvulnerableTimer;

          activeTexts.push({ //erzeugt Popup-Text wenn Maschine Schaden nimmt
            text: `-${dmg} HP!`,
            x: a.x,        
            y: a.y,        
            spawnTime: performance.now(),
            duration: config.GameConfig.popupTextDuration 
        });

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

      if (checkCollision(playerRect, enemyRect) ) { 
        if (!player.starmanActive){
          player.takeDamage(config.GameConfig.playerDamageByAnomalieCollision);
          damageBlinkTimer = config.GameConfig.playerDamageBlinkDuration; // Spieler blinkt

          activeTexts.push({ //erzeugt Popup-Text wenn Player Schaden nimmt
            text: `-${config.GameConfig.playerDamageByAnomalieCollision} HP!`,
            x: a.x,        
            y: a.y,        
            spawnTime: performance.now(),
            duration: config.GameConfig.popupTextDuration 
        });
        }
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
            let pointsGained = a.scorePoints;

            // Doppel-Punkte, wenn Starman aktiv
            if (player.starmanActive) {
                pointsGained *= 2;
            }

            player.state.score += pointsGained;
            scoreChanged = true;

            activeTexts.push({ //erzeugt Popup-Text wenn Anomalie zerstört wurde
              text: `+${pointsGained} Points!`,
              x: a.x,        
              y: a.y,        
              spawnTime: performance.now(),
              duration: config.GameConfig.popupTextDuration 
          });

            const pts = config.pointsPerLevel || 1500;
            const calculatedLevel = Math.floor(player.state.score / pts) + 1;
            if (calculatedLevel > player.state.level) {
              const diff = calculatedLevel - player.state.level;
              for (let k = 0; k < diff; k++) {
                anomalie.levelUp(player.state);
              }
              if (config.onLevelUpdate) config.onLevelUpdate(player.state.level);
            }

            if (Math.random() < config.GameConfig.powerupChance) {
              powerups.push(new Powerup(a,config.GameConfig));
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
        p.apply(player, activeTexts);
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
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(5, 5, 19, 0.65)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // --- MASCHINE ZEICHNEN ---
    if (machineBlinkTimer > 0) machineBlinkTimer--;

    drawMachine(W / 2, H - (config.GameConfig.machineVisualYOffset ?? 80)); 
    
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

    bullet.drawBullet(ctx, bullets,player.state); 
    anomalie.drawAnomalie(images, ctx, anomalien); 

    for (const p of powerups) {
      ctx.fillStyle = p.state.type === 'good' ? '#60d394' : '#ff6b6b';
      ctx.beginPath();
      ctx.arc(p.state.x, p.state.y, 8, 0, Math.PI * 2);
      ctx.fill();
    }  

    // --- POPUP-TEXTE ---
  const now = performance.now();
  activeTexts = activeTexts.filter(t => now - t.spawnTime < t.duration);

  activeTexts.forEach(t => {
    const elapsed = now - t.spawnTime;
    const floatY = t.y - elapsed * 0.03; // Float nach oben
    const alpha = 1 - elapsed / t.duration; // Fade Out

    ctx.save();
    ctx.globalAlpha = alpha; 
    ctx.fillStyle = "#ff7b00";
    ctx.font = "18px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(t.text, t.x, floatY);
    ctx.restore();
  });
  }



  //Draw Machine
  function drawMachine(x: number, y: number) {

    const drawH = 48;
    const drawW = 96;
    const scaleX = config.GameConfig.machineScaleXsingle;
    const scaleY = config.GameConfig.machineScaleYsingle;
    const posY = y + config.GameConfig.machineYsingle;

    ctx.save();
    ctx.translate(x, posY);
    ctx.scale(scaleX, scaleY);

    // BLINK-LOGIK: Aggressiver (Ganz unsichtbar machen)
    // Damit man es auch auf dem grauen Metall sieht!
    if (machineBlinkTimer > 0) {
        if (Math.floor(machineBlinkTimer / 4) % 2 === 0) {
            // Komplett ausblenden (schwarzer Hintergrund kommt durch)
            ctx.globalAlpha = 0; 
        } else {
            ctx.globalAlpha = 1.0;
        }
    }

    const img = images.maschine;

    if (img) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();
      return;
    }
    else {
      //Vector fallback
      ctx.fillStyle = '#222';
      ctx.fillRect(-48, -12, 96, 24);
      ctx.fillStyle = '#444';
      ctx.fillRect(-36, -10, 72, 20);
      ctx.fillStyle = '#f9d423';
      ctx.fillRect(-6, -6, 12, 12);
    }

    ctx.restore();
  }

  // game loop and fps control
  (async () => {
    console.log("Preloading images...");
    await preloadImages();
  
    const TARGET_FPS = config.GameConfig.targetFps;
    const FRAME_DURATION = 1000 / TARGET_FPS; 
    let lastTime = performance.now();
  
    const frame = (now: number) => {
      if (!running) return;
  
      if (now - lastTime >= FRAME_DURATION) {
        step();
        render();
        lastTime = now;
      }
  
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