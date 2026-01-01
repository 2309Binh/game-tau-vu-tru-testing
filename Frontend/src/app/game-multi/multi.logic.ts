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

  // split-screen: left and right
  const halfW = Math.floor(W / 2);

  const playerL = new Player();
  const playerR = new Player();

  // position players roughly centered in each half
  playerL.state.position.x = halfW / 2;
  playerL.state.position.y = H - 140;
  playerR.state.position.x = halfW + halfW / 2;
  playerR.state.position.y = H - 140;

  const anomalieHelperL = new Anomalie();
  const anomalieHelperR = new Anomalie();

  let bulletsL: BulletModel[] = [];
  let bulletsR: BulletModel[] = [];
  let anomalienL: AnomalieModel[] = [];
  let anomalienR: AnomalieModel[] = [];
  let powerupsL: Powerup[] = [];
  let powerupsR: Powerup[] = [];

  let fireCooldownL = 0;
  let fireCooldownR = 0;

  // INPUT
  // separate inputs for left and right players
  const inputL: InputState = { left: false, right: false, up: false, down: false, shootOnce: false };
  const inputR: InputState = { left: false, right: false, up: false, down: false, shootOnce: false };

  const keyDownListener = (e: KeyboardEvent) => {
    const k = e.key;
    // Left player: WASD + Space
    if (k === 'a' || k === 'A') { inputL.left = true; e.preventDefault(); }
    if (k === 'd' || k === 'D') { inputL.right = true; e.preventDefault(); }
    if (k === 'w' || k === 'W') { inputL.up = true; e.preventDefault(); }
    if (k === 's' || k === 'S') { inputL.down = true; e.preventDefault(); }
    if (k === ' '){ inputL.shootOnce = true; e.preventDefault(); }

    // Right player: Arrow keys + Enter to shoot
    if (k === 'ArrowLeft') { inputR.left = true; e.preventDefault(); }
    if (k === 'ArrowRight') { inputR.right = true; e.preventDefault(); }
    if (k === 'ArrowUp') { inputR.up = true; e.preventDefault(); }
    if (k === 'ArrowDown') { inputR.down = true; e.preventDefault(); }
    if (k === 'Enter') { inputR.shootOnce = true; e.preventDefault(); }
  };
  const keyUpListener = (e: KeyboardEvent) => {
    const k = e.key;
    if (k === 'a' || k === 'A') inputL.left = false;
    if (k === 'd' || k === 'D') inputL.right = false;
    if (k === 'w' || k === 'W') inputL.up = false;
    if (k === 's' || k === 'S') inputL.down = false;
    if (k === ' ') inputL.shootOnce = false;

    if (k === 'ArrowLeft') inputR.left = false;
    if (k === 'ArrowRight') inputR.right = false;
    if (k === 'ArrowUp') inputR.up = false;
    if (k === 'ArrowDown') inputR.down = false;
    if (k === 'Enter') inputR.shootOnce = false;
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', keyDownListener);
    window.addEventListener('keyup', keyUpListener);
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
    
  function step() {
    // LEFT
    const livesBeforeL = playerL.state.lives;
    playerL.move(inputL);
    if (fireCooldownL > 0) fireCooldownL -= 1;
    if (inputL.shootOnce) {
      if (fireCooldownL <= 0) {
        Bullet.fireBullet(bulletsL, playerL.state);
        fireCooldownL = Math.max(6 - playerL.state.levelWeapon, 2);
      }
      inputL.shootOnce = false;
    }
    for (let i = bulletsL.length - 1; i >= 0; i--) {
      const b = bulletsL[i];
      b.y -= b.speed;
      if (b.y < -10) bulletsL.splice(i, 1);
    }

    // spawn left side anomalies
    if (anomalienL.length === 0 || (Date.now() - (anomalieHelperL as any).lastWaveAt > 1200 && anomalienL.length < Math.max(1, 3 + Math.floor((anomalieHelperL as any).currentLevel / 2)))) {
      const lvl = (anomalieHelperL as any).currentLevel || 1;
      const count = 2 + Math.floor(lvl * 0.8) + Math.floor(Math.random() * 2);
      for (let i = 0; i < count; i++) {
        const r = 12 + Math.floor(Math.random() * 18) + lvl * 2;
        const x = Math.random() * (halfW - 80) + 40;
        anomalienL.push({ x, y: -50 - (i * 150) - (Math.random() * 50), radius: r, speed: 1 + Math.random() * 1.6 + (lvl * 0.15), hp: r * 2, strength: Math.round(r * 10), scorePoints: 100 + Math.round(lvl * 10) + Math.round(r), imageIndex: Math.floor(Math.random() * 7) });
      }
      try { (anomalieHelperL as any).lastWaveAt = Date.now(); } catch {}
    }

    // move left anomalies
    for (let i = anomalienL.length - 1; i >= 0; i--) {
      const a = anomalienL[i];
      a.y += a.speed;
      a.x += Math.sin((a.speed + Date.now() / 1000) * 2) * 0.5;
      const machineCenterX = halfW / 2;
      const machineCollisionHalfWidth = (GameConfig.machineCollisionHalfWidth ?? 384) / 2; // scaled for half
      const machineCollisionTopY = H - (GameConfig.machineCollisionYOffset ?? 65);
      if (a.y + a.radius >= machineCollisionTopY && Math.abs(a.x - machineCenterX) < machineCollisionHalfWidth) {
        const dmg = Math.max(1, Math.round((GameConfig.machineDamageAnomalieCollision / 100) * a.hp));
        playerL.takeDamage(dmg);
        anomalienL.splice(i, 1);
        continue;
      }
      if (a.y > H + 50) anomalienL.splice(i, 1);
    }

    // collisions left
    let scoreChangedL = false;
    for (let i = anomalienL.length - 1; i >= 0; i--) {
      const a = anomalienL[i];
      for (let j = bulletsL.length - 1; j >= 0; j--) {
        const b = bulletsL[j];
        if (dist(b.x, b.y, a.x, a.y) < a.radius + 2) {
          bulletsL.splice(j, 1);
          a.hp -= b.damage;
          if (a.hp <= 0) {
            playerL.state.score += a.scorePoints;
            scoreChangedL = true;
            const pts = config.pointsPerLevel || 2500;
            const calculatedLevel = Math.floor(playerL.state.score / pts) + 1;
            if (calculatedLevel > playerL.state.level) {
              const diff = calculatedLevel - playerL.state.level;
              for (let k = 0; k < diff; k++) anomalieHelperL.levelUp(playerL.state);
              if (config.onLevelUpdate) config.onLevelUpdate(playerL.state.level);
            }
            if (Math.random() < (GameConfig.powerupChance ?? 0.18)) powerupsL.push(new Powerup(a));
            anomalienL.splice(i, 1);
            break;
          }
        }
      }
    }

    if (scoreChangedL && config.onScoreUpdate) config.onScoreUpdate(playerL.state.score);

    for (let i = powerupsL.length - 1; i >= 0; i--) {
      const p = powerupsL[i];
      p.state.y += p.state.speed;
      if (dist(p.state.x, p.state.y, playerL.state.position.x, playerL.state.position.y) < 18) {
        p.apply(playerL.state);
        powerupsL.splice(i, 1);
        if (config.onLivesUpdate) config.onLivesUpdate(playerL.state.lives);
        if (config.onScoreUpdate) config.onScoreUpdate(playerL.state.score);
      } else if (p.state.y > H + 30) powerupsL.splice(i, 1);
    }

    if (playerL.state.lives !== livesBeforeL) if (config.onLivesUpdate) config.onLivesUpdate(playerL.state.lives);

    // RIGHT (mirror of left but x offset)
    const livesBeforeR = playerR.state.lives;
    playerR.move(inputR);
    if (fireCooldownR > 0) fireCooldownR -= 1;
    if (inputR.shootOnce) {
      if (fireCooldownR <= 0) {
        Bullet.fireBullet(bulletsR, playerR.state);
        fireCooldownR = Math.max(6 - playerR.state.levelWeapon, 2);
      }
      inputR.shootOnce = false;
    }
    for (let i = bulletsR.length - 1; i >= 0; i--) {
      const b = bulletsR[i];
      b.y -= b.speed;
      if (b.y < -10) bulletsR.splice(i, 1);
    }

    // spawn right side anomalies
    if (anomalienR.length === 0 || (Date.now() - (anomalieHelperR as any).lastWaveAt > 1200 && anomalienR.length < Math.max(1, 3 + Math.floor((anomalieHelperR as any).currentLevel / 2)))) {
      const lvl = (anomalieHelperR as any).currentLevel || 1;
      const count = 2 + Math.floor(lvl * 0.8) + Math.floor(Math.random() * 2);
      for (let i = 0; i < count; i++) {
        const r = 12 + Math.floor(Math.random() * 18) + lvl * 2;
        const x = halfW + (Math.random() * (halfW - 80) + 40);
        anomalienR.push({ x, y: -50 - (i * 150) - (Math.random() * 50), radius: r, speed: 1 + Math.random() * 1.6 + (lvl * 0.15), hp: r * 2, strength: Math.round(r * 10), scorePoints: 100 + Math.round(lvl * 10) + Math.round(r), imageIndex: Math.floor(Math.random() * 7) });
      }
      try { (anomalieHelperR as any).lastWaveAt = Date.now(); } catch {}
    }

    for (let i = anomalienR.length - 1; i >= 0; i--) {
      const a = anomalienR[i];
      a.y += a.speed;
      a.x += Math.sin((a.speed + Date.now() / 1000) * 2) * 0.5;
      const machineCenterX = halfW + halfW / 2;
      const machineCollisionHalfWidth = (GameConfig.machineCollisionHalfWidth ?? 384) / 2;
      const machineCollisionTopY = H - (GameConfig.machineCollisionYOffset ?? 65);
      if (a.y + a.radius >= machineCollisionTopY && Math.abs(a.x - machineCenterX) < machineCollisionHalfWidth) {
        const dmg = Math.max(1, Math.round((GameConfig.machineDamageAnomalieCollision / 100) * a.hp));
        playerR.takeDamage(dmg);
        anomalienR.splice(i, 1);
        continue;
      }
      if (a.y > H + 50) anomalienR.splice(i, 1);
    }

    let scoreChangedR = false;
    for (let i = anomalienR.length - 1; i >= 0; i--) {
      const a = anomalienR[i];
      for (let j = bulletsR.length - 1; j >= 0; j--) {
        const b = bulletsR[j];
        if (dist(b.x, b.y, a.x, a.y) < a.radius + 2) {
          bulletsR.splice(j, 1);
          a.hp -= b.damage;
          if (a.hp <= 0) {
            playerR.state.score += a.scorePoints;
            scoreChangedR = true;
            const pts = config.pointsPerLevel || 2500;
            const calculatedLevel = Math.floor(playerR.state.score / pts) + 1;
            if (calculatedLevel > playerR.state.level) {
              const diff = calculatedLevel - playerR.state.level;
              for (let k = 0; k < diff; k++) anomalieHelperR.levelUp(playerR.state);
              if (config.onLevelUpdate) config.onLevelUpdate(playerR.state.level);
            }
            if (Math.random() < (GameConfig.powerupChance ?? 0.18)) powerupsR.push(new Powerup(a));
            anomalienR.splice(i, 1);
            break;
          }
        }
      }
    }

    // note: keep using config.onScoreUpdate for left player (HUD remains single-player style)
    if (scoreChangedR) { /* could notify separately if HUD updated for both */ }

    for (let i = powerupsR.length - 1; i >= 0; i--) {
      const p = powerupsR[i];
      p.state.y += p.state.speed;
      if (dist(p.state.x, p.state.y, playerR.state.position.x, playerR.state.position.y) < 18) {
        p.apply(playerR.state);
        powerupsR.splice(i, 1);
        if (config.onLivesUpdate) config.onLivesUpdate(playerR.state.lives);
        if (config.onScoreUpdate) config.onScoreUpdate(playerR.state.score);
      } else if (p.state.y > H + 30) powerupsR.splice(i, 1);
    }

    if (playerR.state.lives !== livesBeforeR) if (config.onLivesUpdate) config.onLivesUpdate(playerR.state.lives);

    // Game over when both dead
    if (playerL.state.lives <= 0 && playerR.state.lives <= 0) {
      running = false;
      if (config.onGameOver) config.onGameOver(Math.max(playerL.state.score, playerR.state.score));
    }
  }

function render() {
  ctx.fillStyle = '#050513'; //background design
  ctx.fillRect(0, 0, W, H);

  // divider
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(halfW - 1, 0, 2, H);

  // LEFT viewport
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, halfW, H);
  ctx.clip();

  drawMachine(halfW / 2, H - (GameConfig.machineVisualYOffset ?? 80));
  playerL.drawPlayer(playerL.state.position.x, playerL.state.position.y, images, ctx);
  // bullets
  const b = new Bullet(playerL.state);
  b.drawBullet(ctx, bulletsL);
  // anomalies
  anomalieHelperL.drawAnomalie(images, ctx, anomalienL);
  // powerups
  for (const p of powerupsL) {
    ctx.fillStyle = p.state.type === 'good' ? '#60d394' : '#ff6b6b';
    ctx.beginPath();
    ctx.arc(p.state.x, p.state.y, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();

  // RIGHT viewport
  ctx.save();
  ctx.beginPath();
  ctx.rect(halfW, 0, halfW, H);
  ctx.clip();

  drawMachine(halfW + halfW / 2, H - (GameConfig.machineVisualYOffset ?? 80));
  playerR.drawPlayer(playerR.state.position.x, playerR.state.position.y, images, ctx);
  const b2 = new Bullet(playerR.state);
  b2.drawBullet(ctx, bulletsR);
  anomalieHelperR.drawAnomalie(images, ctx, anomalienR);
  for (const p of powerupsR) {
    ctx.fillStyle = p.state.type === 'good' ? '#60d394' : '#ff6b6b';
    ctx.beginPath();
    ctx.arc(p.state.x, p.state.y, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

//Draw Machine
function drawMachine(x: number, y: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(13, 7);

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
    // Backwards-compatible: merge into left player input when a simple map is provided.
    if (!s) return;
    if (s.leftPlayer || s.rightPlayer) {
      if (s.leftPlayer) Object.assign(inputL, s.leftPlayer);
      if (s.rightPlayer) Object.assign(inputR, s.rightPlayer);
    } else {
      // assume legacy single input map -> apply to left player
      Object.assign(inputL, s);
    }
  },
};
}

