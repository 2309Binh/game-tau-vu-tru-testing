// Minimal TypeScript port of the standalone game logic.
export function initGame(canvas: HTMLCanvasElement, els: {
  hudScore: HTMLElement | null,
  hudLives: HTMLElement | null,
  hudLevel: HTMLElement | null,
  onGameOver?: (score: number)=>void,
  // optional callback invoked when the player fires a shot
  onFire?: ()=>void
}){
  const ctx = canvas.getContext('2d')!;
  const W = canvas.width, H = canvas.height;
  let raf = 0;
  let running = true;
  let player = { x: W/2, y: H-80, speed:4, levelWeapon:1 };
  let bullets: any[] = [];
  let meteors: any[] = [];
  let powerups: any[] = [];
  let score = 0, lives = 100, level = 1, spawnWaveCount = 0, lastWaveAt = 0, fireCooldown = 0;

  const input: any = { left:false, right:false, up:false, down:false, shoot:false };
  // support a one-shot firing flag `shootOnce` so firing can be triggered per key press
  input.shootOnce = false;

  const imagesToLoad = {
    ship: '/assets/picture/playership.png',
    meteor: '/assets/picture/meteor.png',
    maschine: '/assets/picture/maschine.png',
  };

  const images: { ship: HTMLImageElement | null; meteor: HTMLImageElement | null; maschine: HTMLImageElement | null } = { ship: null, meteor: null, maschine  : null };

  function loadImage(src: string): Promise<HTMLImageElement>{
    return new Promise((resolve, reject)=>{
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(e);
      img.src = src;
    });
  }

  async function preloadImages(){
    const entries = Object.entries(imagesToLoad);
    for(const [key, url] of entries){
      try{
        const img = await loadImage(url);
        if (key === 'ship') images.ship = img;
        else if (key === 'meteor') images.meteor = img;
        else if (key === 'maschine' || key === 'machine') images.maschine = img;
      } catch(e){
        console.warn('Failed to load image', url, e);
        if (key === 'ship') images.ship = null;
        else if (key === 'meteor') images.meteor = null;
        else if (key === 'maschine' || key === 'machine') images.maschine = null;
      }
    }
  }

 /* -------------------- UTILS -------------------- */
function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

function dist(ax: number, ay: number, bx: number, by: number) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

/* -------------------- BULLET -------------------- */
function fireBullet() {
  bullets.push({
    x: player.x,
    y: player.y - 14,
    speed: 8,
    damage: 15 + player.levelWeapon * 5,
  });
  // notify host that a shot was fired (for sound effects, analytics, etc.)
  try{ if (els.onFire) els.onFire(); } catch(e){ /* ignore */ }
}

/* -------------------- METEOR WAVE -------------------- */
function spawnWave() {
  const count =
    2 +
    Math.floor(level * 0.8) +
    Math.floor(Math.random() * 2);

  for (let i = 0; i < count; i++) {
    const r = 12 + Math.floor(Math.random() * 18) + level * 2;
    const x = Math.random() * (W - 80) + 40;

    meteors.push({
      x,
      y: -40 - Math.random() * 200,
      radius: r,
      speed:
        1 +
        Math.random() * 0.6 +
        level * 0.08,
      hp: r * 2,
      maxHp: r * 2,
      strength: Math.round(r * 10),
      score:
        100 +
        Math.round(level * 10) +
        Math.round(r),
    });
  }

  spawnWaveCount++;
  if (spawnWaveCount % 5 === 0) levelUp();
}

/* -------------------- LEVEL UP -------------------- */
function levelUp() {
  level++;

  if (level % 2 === 0) {
    player.levelWeapon++;
  } else {
    player.speed += 0.4;
  }
}

/* -------------------- POWERUP -------------------- */
function applyPowerup(p: any) {
  if (p.type === "good") {
    score += 200;
    player.levelWeapon = Math.min(5, player.levelWeapon + 1);
  } else {
    score = Math.max(0, score - 150);
    player.speed = Math.max(2, player.speed - 0.6);
  }
}

/* -------------------- DAMAGE -------------------- */
function applyPlayerDamage(n: number) {
  lives -= n;
}

function applyMachineDamage(n: number) {
  lives -= Math.max(1, Math.round(n / 2));
}


  function step() {
  /* -------------------- PLAYER MOVEMENT -------------------- */
  if (input.left)  player.x -= player.speed;
  if (input.right) player.x += player.speed;
  if (input.up)    player.y -= player.speed;
  if (input.down)  player.y += player.speed;

  player.x = clamp(player.x, 10, W - 10);
  player.y = clamp(player.y, 10, H - 10);

  /* -------------------- SHOOTING (one-shot) -------------------- */
  // Countdown cooldown each frame
  if (fireCooldown > 0) fireCooldown -= 1;

  // If a one-shot flag is set by input, fire once and clear the flag
  if (input.shootOnce) {
    if (fireCooldown <= 0) {
      fireBullet();
      fireCooldown = Math.max(6 - player.levelWeapon, 2);
    }
    // consume the one-shot trigger so holding Space doesn't retrigger
    input.shootOnce = false;
  }

  /* -------------------- BULLET UPDATE -------------------- */
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.y -= b.speed;

    if (b.y < -10) {
      bullets.splice(i, 1);
    }
  }

  /* -------------------- SPAWN METEORS -------------------- */
  const needNewWave =
    meteors.length === 0 ||
    (Date.now() - lastWaveAt > 1200 &&
     meteors.length < Math.max(1, 3 + Math.floor(level / 2)));

  if (needNewWave) {
    spawnWave();
    lastWaveAt = Date.now();
  }

  /* -------------------- METEOR MOVEMENT -------------------- */
  for (let i = meteors.length - 1; i >= 0; i--) {
    const m = meteors[i];

    m.y += m.speed;
    m.x += Math.sin((m.seed || 0 + Date.now() / 1000) * 2) * 0.5;

    // Meteor hits the machine
    // Tighten collision window to reduce accidental hits and lower damage
    if (m.y > H - 30 && Math.abs(m.x - W / 2) < 40) {
      const dmg = Math.max(1, Math.ceil(m.strength * 0.03));
      applyMachineDamage(dmg);
      meteors.splice(i, 1);
      continue;
    }

    // Meteor out of screen
    if (m.y > H + 50) {
      meteors.splice(i, 1);
    }
  }

  /* -------------------- BULLET - METEOR COLLISION -------------------- */
  for (let i = meteors.length - 1; i >= 0; i--) {
    const m = meteors[i];

    for (let j = bullets.length - 1; j >= 0; j--) {
      const b = bullets[j];

      if (dist(b.x, b.y, m.x, m.y) < m.radius + 2) {
        bullets.splice(j, 1);
        m.hp -= b.damage;

        if (m.hp <= 0) {
          score += m.score;

          // Chance to spawn powerup
          if (Math.random() < 0.18) {
            powerups.push({
              x: m.x,
              y: m.y,
              type: Math.random() < 0.7 ? "good" : "bad",
              speed: 1 + Math.random() * 0.6
            });
          }

          meteors.splice(i, 1);
        }
        break;
      }
    }
  }

  /* -------------------- POWERUP UPDATE -------------------- */
  for (let i = powerups.length - 1; i >= 0; i--) {
    const p = powerups[i];
    p.y += p.speed;

    if (dist(p.x, p.y, player.x, player.y) < 18) {
      applyPowerup(p);
      powerups.splice(i, 1);
    } else if (p.y > H + 30) {
      powerups.splice(i, 1);
    }
  }

  /* -------------------- RANDOM DAMAGE EVENT (disabled) -------------------- */
  // Random damage disabled — prevents unexpected life loss during playtesting.
  // If you want to re-enable later, restore the original block below.
  /*
  if (Math.random() < 0.005 + level * 0.001) {
    if (Math.random() < 0.08) applyPlayerDamage(1);
  }
  */

  /* -------------------- UPDATE HUD -------------------- */
  if (els.hudScore) els.hudScore.textContent = String(score);
  if (els.hudLives) els.hudLives.textContent = String(lives);
  if (els.hudLevel) els.hudLevel.textContent = String(level);

  /* -------------------- GAME OVER -------------------- */
  if (lives <= 0) {
    running = false;
    if (els.onGameOver) els.onGameOver(score);
  }
}


function render() {
  /* -------------------- BACKGROUND -------------------- */
  ctx.fillStyle = '#050513';
  ctx.fillRect(0, 0, W, H);

  /* -------------------- MACHINE & PLAYER -------------------- */
  drawMachine(W / 2, H - 20);
  drawPlayer(player.x, player.y);

  /* -------------------- BULLETS -------------------- */
  ctx.fillStyle = '#fff';
  for (const b of bullets) {
    ctx.fillRect(b.x - 2, b.y - 6, 4, 8);
  }

  /* -------------------- METEORS -------------------- */
  for (const m of meteors) {
    // Draw meteor
    if (images.meteor) {
      const img = images.meteor;
      const size = Math.max(16, m.radius * 2);
      ctx.drawImage(img, m.x - size / 2, m.y - size / 2, size, size);
    } else {
      ctx.fillStyle = '#8b5cf6';
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw HP bar
    ctx.fillStyle = '#111';
    ctx.fillRect(
      m.x - 8,
      m.y - 2,
      (m.hp / m.maxHp) * m.radius * 1.6,
      4
    );
  }

  /* -------------------- POWERUPS -------------------- */
  for (const p of powerups) {
    ctx.fillStyle = p.type === 'good' ? '#60d394' : '#ff6b6b';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
    ctx.fill();
  }
}

/* ---------------------------------------------------- */
/* DRAW PLAYER                                          */
/* ---------------------------------------------------- */
function drawMachine(x: number, y: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(3, 3);

  const img = images.maschine;
  if (img) {
    const drawW = 96;
    const drawH = 48;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
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

/* ---------------------------------------------------- */
/* DRAW PLAYER                                          */
/* ---------------------------------------------------- */
function drawPlayer(x: number, y: number) {
  const img = images.ship;

  // Draw sprite if available
  if (img) {
    const drawW = 48;
    const drawH = 48;

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, x - drawW / 2, y - drawH / 2, drawW, drawH);

    return;
  }

  // Fallback triangle ship
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(x, y - 10);
  ctx.lineTo(x - 8, y + 8);
  ctx.lineTo(x + 8, y + 8);
  ctx.closePath();
  ctx.fill();

  // Laser glow
  ctx.fillStyle = '#e04cff';
  ctx.fillRect(x - 1, y - 20, 2, 8);
}

/* ---------------------------------------------------- */
/* MAIN LOOP                                            */
/* ---------------------------------------------------- */
(async () => {
  await preloadImages();

  let frame = () => {
    if (!running) return;
    step();
    render();
    raf = requestAnimationFrame(frame);
  };

  raf = requestAnimationFrame(frame);
})();

/* ---------------------------------------------------- */
/* PUBLIC API                                           */
/* ---------------------------------------------------- */
return {
  destroy() {
    running = false;
    cancelAnimationFrame(raf);
  },

  setInput(s: any) {
    Object.assign(input, s);
  }
};
}
