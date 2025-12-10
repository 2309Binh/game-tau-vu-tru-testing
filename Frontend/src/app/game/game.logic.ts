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
          // mehrere Bilder parallel laden
          const loadedImages = await Promise.all(value.map(loadImage));
          (images as any)[key] = loadedImages;
        } else {
          // einzelnes Bild
          const img = await loadImage(value as string);
          (images as any)[key] = img;
        }
      } catch (e) {
        console.warn("Failed to load image(s)", value, e);
        (images as any)[key] = Array.isArray(value) ? [] : null;
      }
    }
  }

 /* -------------------- Berechnet entfernung zwischen zwei punkten -------------------- */


    
    function dist(ax: number, ay: number, bx: number, by: number) {
      const dx = ax - bx;
      const dy = ay - by;
      return Math.sqrt(dx * dx + dy * dy);
    }
    
  function step() { //wird jedes frame aufgerufen
    const livesBefore = player.state.lives; // merken wie viel leben vor frame
    player.move(input);

    if (fireCooldown > 0) fireCooldown -= 1;
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
    anomalie.updateSpawn(player.state, anomalien.length, images, ctx, anomalien); // ggf. neue Welle
    anomalie.move(player, anomalien.length, anomalien); // Bewegung + Kollisions-Callback (player.takeDamage)

    /* -------------------- ANOMALIE OFFSCREEN (HIT BOTTOM) -------------------- */
    for (let i = anomalien.length - 1; i >= 0; i--) {
      const a = anomalien[i];
      if (a.y > H) {
        player.state.lives -= 1;
        if (config.onLivesUpdate) config.onLivesUpdate(player.state.lives);
        anomalien.splice(i, 1);
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

            // LEVEL UP LOGIC
            const pts = config.pointsPerLevel || 2500;
            const calculatedLevel = Math.floor(player.state.score / pts) + 1;
            if (calculatedLevel > player.state.level) {
              player.state.level = calculatedLevel;
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

    // --- CHECK: Hat sich Leben in diesem Frame verändert ---
    if (player.state.lives !== livesBefore) {
      if (config.onLivesUpdate) {
        config.onLivesUpdate(player.state.lives);
      }
    }

    // Game Over
    if (player.state.lives <= 0) {
      running = false;
      if (config.onGameOver) config.onGameOver(player.state.score);
    }
  }

function render() {
  
  ctx.fillStyle = '#050513'; //background design
  ctx.fillRect(0, 0, W, H);

  drawMachine(W / 2, H - 50); //Maschine zeichnen

  player.drawPlayer(player.state.position.x, player.state.position.y, images, ctx); //player zeichnen

  bullet.drawBullet(ctx, bullets); //Bullets zeichnen

  anomalie.drawAnomalie(images, ctx, anomalien); //Anomalie zeichnen

  /* -------------------- Powerups zeichnen -------------------- */
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
  ctx.scale(8, 7);

  const img = images.maschine;
  if (img) {
    const drawW = 96;
    const drawH = 48;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    /*ctx.drawImage(img, -150 , -drawH / 2, drawW, drawH);
    ctx.drawImage(img, -100 , -drawH / 2, drawW, drawH);
    ctx.drawImage(img, -50, -drawH / 2, drawW, drawH);
    ctx.drawImage(img, -0 , -drawH / 2, drawW, drawH);
    ctx.drawImage(img, 50 , -drawH / 2, drawW, drawH);*/
  
    ctx.restore();
    return;
  }

  // Vector fallback if image isn't available
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

