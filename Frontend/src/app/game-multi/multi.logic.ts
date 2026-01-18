import { Anomalie } from "../entities/anomalie";
import { Player } from "../entities/player";
import { AnomalieModel, BulletModel, InputState } from "../core/game-models";
import { Bullet } from "../entities/bullet";
import { GameConfig } from "../core/game-config";

export interface GameInitConfig {
  onScoreUpdateLeft?: (score: number) => void;
  onScoreUpdateRight?: (score: number) => void;
  onLevelUpdateLeft?: (level: number) => void;
  onLevelUpdateRight?: (level: number) => void;
  onLivesUpdateLeft?: (lives: number) => void;
  onLivesUpdateRight?: (lives: number) => void;
  onMachineHPUpdate?: (leftHP: number, rightHP: number) => void;
  onShot?: (player: 'left' | 'right') => void;
  onGameOver?: (score: number) => void;
  onWinner?: (winnerName: string) => void; 
  pointsPerLevel: number;
}

function checkCollision(r1: any, r2: any): boolean {
  return (
    r1.x < r2.x + r2.w && r1.x + r1.w > r2.x &&
    r1.y < r2.y + r2.h && r1.y + r1.h > r2.y
  );
}

export function initGame(canvas: HTMLCanvasElement, config: GameInitConfig) {
  const ctx = canvas.getContext('2d')!;
  
  // *** SCALING FIX ***
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  ctx.scale(dpr, dpr);
  
  let W = window.innerWidth;
  let H = window.innerHeight;
  let halfW = Math.floor(W / 2);

  let raf = 0;
  let running = true;
  let gameOverTriggered = false;

  const playerL = new Player();
  const playerR = new Player();
  
  playerL.state.lives = 100;
  playerR.state.lives = 100;
  
  playerL.state.position.y = H - 140;
  playerR.state.position.y = H - 140;

  // *** MANUELLE POSITIONS-KONTROLLE FÜR P2 ***
  let p2ManualX = W * 0.75 - 20;

  if (W > 100) {
      playerL.state.position.x = W * 0.25 - 20;
  }

  let machineHPL = 100, machineHPR = 100;
  let blinkL_Player = 0, blinkL_Machine = 0;
  let blinkR_Player = 0, blinkR_Machine = 0;

  let bulletsL: BulletModel[] = [], bulletsR: BulletModel[] = [];
  let anomalienL: AnomalieModel[] = [], anomalienR: AnomalieModel[] = [];
  
  const anomalieHelper = new Anomalie();
  let fireCooldownL = 0, fireCooldownR = 0;
  const inputL: InputState = { left: false, right: false, up: false, down: false, shootOnce: false };
  const inputR: InputState = { left: false, right: false, up: false, down: false, shootOnce: false };

  // --- CONTROLS ---
  const keyDownListener = (e: KeyboardEvent) => {
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight', ' '].includes(e.key)) e.preventDefault();
    const k = e.key.toLowerCase();
    const code = e.code;

    // P1 (WASD)
    if (k === 'a' || code === 'KeyA') inputL.left = true;
    if (k === 'd' || code === 'KeyD') inputL.right = true;
    if (k === 'w' || code === 'KeyW') inputL.up = true;
    if (k === 's' || code === 'KeyS') inputL.down = true;
    if (k === ' ' || code === 'Space') inputL.shootOnce = true;
    
    // P2 (Pfeiltasten)
    if (e.key === 'ArrowLeft') inputR.left = true;
    if (e.key === 'ArrowRight') inputR.right = true;
    if (e.key === 'ArrowUp') inputR.up = true;
    if (e.key === 'ArrowDown') inputR.down = true;
    if (e.key === 'Enter') inputR.shootOnce = true;
  };

  const keyUpListener = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    const code = e.code;

    if (k === 'a' || code === 'KeyA') inputL.left = false;
    if (k === 'd' || code === 'KeyD') inputL.right = false;
    if (k === 'w' || code === 'KeyW') inputL.up = false;
    if (k === 's' || code === 'KeyS') inputL.down = false;
    if (k === ' ' || code === 'Space') inputL.shootOnce = false;
    
    if (e.key === 'ArrowLeft') inputR.left = false;
    if (e.key === 'ArrowRight') inputR.right = false;
    if (e.key === 'ArrowUp') inputR.up = false;
    if (e.key === 'ArrowDown') inputR.down = false;
    if (e.key === 'Enter') inputR.shootOnce = false;
  };

  if(typeof window !== 'undefined') {
    window.addEventListener('keydown', keyDownListener);
    window.addEventListener('keyup', keyUpListener);
  }

  // --- IMAGES ---
  const images: any = { ship: null, anomalie: [], maschine: null };
  function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve) => {
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
          images[key] = await Promise.all(value.map(loadImage));
        } else {
          images[key] = await loadImage(value as string);
        }
      } catch (e) {}
    }
  }

  // --- STEP ---
  function step() {
    if (gameOverTriggered) return;

    if (window.innerWidth !== W || window.innerHeight !== H) {
        W = window.innerWidth;
        H = window.innerHeight;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        ctx.setTransform(1, 0, 0, 1, 0, 0); 
        ctx.scale(dpr, dpr); 
        halfW = Math.floor(W / 2);
    }

    // --- P1 (LINKS) ---
    playerL.move(inputL, W, H);
    // Boundary P1: 0 bis Mitte minus Spielerbreite

    // === P1 (LINKS) ===
    playerL.move(inputL);

    if (playerL.state.position.x < 0) playerL.state.position.x = 0;
    
    // FIX: Boundary etwas lockern (von -40 auf -25), damit P1 die Mitte besser trifft
    if (playerL.state.position.x > halfW - 25) playerL.state.position.x = halfW - 25;

    if(fireCooldownL > 0) fireCooldownL--;
    if(inputL.shootOnce && fireCooldownL <= 0) { 
      Bullet.fireBullet(bulletsL, playerL.state); 
      fireCooldownL = 5; 
      inputL.shootOnce = false; 
      if(config.onShot) config.onShot('left');
    }
    for(let i=bulletsL.length-1; i>=0; i--) { 
        bulletsL[i].y -= bulletsL[i].speed; 
        if(bulletsL[i].y < -20) bulletsL.splice(i,1); 
    }
    
    anomalieHelper.updateSpawn(playerL.state, anomalienL.length, images, ctx, anomalienL);
    for(const a of anomalienL) { a.y += a.speed; if(a.x > halfW - a.radius) a.x = halfW - a.radius; }
    
    // HITBOX P1
    const machineRectL = { x: (halfW/2) - 150, y: H - 180, w: 300, h: 180 }; 
    const playerRectL = { x: playerL.state.position.x, y: playerL.state.position.y, w: 40, h: 40 };

    for (let i = anomalienL.length - 1; i >= 0; i--) {
      const a = anomalienL[i];
      const aRect = { x: a.x - a.radius, y: a.y - a.radius, w: a.radius*2, h: a.radius*2 };
      let hit = false;
      if(checkCollision(playerRectL, aRect)) { 
          machineHPL -= 10; playerL.state.lives = machineHPL; blinkL_Player = 40; hit = true; 
      } else if(checkCollision(machineRectL, aRect) || a.y > H) { 
          machineHPL -= 10; playerL.state.lives = machineHPL; blinkL_Machine = 40; hit = true; 
      }
      if (hit) {
          if(config.onLivesUpdateLeft) config.onLivesUpdateLeft(playerL.state.lives); 
          if(config.onMachineHPUpdate) config.onMachineHPUpdate(machineHPL, machineHPR); 
          anomalienL.splice(i, 1); continue; 
      }
      for(let j=bulletsL.length-1; j>=0; j--){ const b = bulletsL[j]; if(Math.sqrt((b.x-a.x)**2 + (b.y-a.y)**2) < a.radius + 2) { bulletsL.splice(j,1); a.hp -= b.damage; if(a.hp <= 0) { playerL.state.score += a.scorePoints; if(config.onScoreUpdateLeft) config.onScoreUpdateLeft(playerL.state.score); anomalienL.splice(i,1); } break; } }
    }


    // --- P2 (RECHTS) ---
    playerR.move(inputR, W, H);
    
    // 4. BOUNDARY P2 FIX (Das Problem mit der Wand)
    // Linke Grenze: Exakt die Mitte (halfW)
    if (playerR.state.position.x < halfW) playerR.state.position.x = halfW;
    // Rechte Grenze: Volle Breite (W) minus Puffer (50px)
    if (playerR.state.position.x > W - 50) playerR.state.position.x = W - 50; 


    // === P2 (RECHTS) - MANUAL OVERRIDE ===
    const speed = 5; 
    if (inputR.left) p2ManualX -= speed;
    if (inputR.right) p2ManualX += speed;

    if (p2ManualX < halfW + 5) p2ManualX = halfW + 5;
    
    // FIX: Boundary etwas lockern (von -40 auf -25), damit P2 den rechten Rand besser trifft
    if (p2ManualX > W - 25) p2ManualX = W - 25;

    playerR.move(inputR);
    playerR.state.position.x = p2ManualX;

    if(fireCooldownR > 0) fireCooldownR--;
    if(inputR.shootOnce && fireCooldownR <= 0) { 
      Bullet.fireBullet(bulletsR, playerR.state); 
      fireCooldownR = 5; 
      inputR.shootOnce = false; 
      if(config.onShot) config.onShot('right');
    }
    for(let i=bulletsR.length-1; i>=0; i--) { 
        bulletsR[i].y -= bulletsR[i].speed; 
        if(bulletsR[i].y < -20) bulletsR.splice(i,1); 
    }
    
    // Anomalie Spawn P2
    if(Math.random() < 0.02) {
        const lvl = playerR.state.level || 1;
        const r = 12 + Math.random() * 10 + (lvl * 2);
        const randomImgIndex = Math.floor(Math.random() * 3);

        // FIX: Spawning Bereich anpassen!
        // Statt (halfW - 80) nehmen wir (halfW - 120), damit Anomalien nicht zu weit rechts spawnen.
        anomalienR.push({ 
            x: halfW + 40 + Math.random() * (halfW - 120), 
            y: -50, radius: r, speed: 2 + (lvl * 0.1), hp: r * 2, 
            scorePoints: 100 + Math.round(r), strength: 1, imageIndex: randomImgIndex 
        } as any);
    }
    for(const a of anomalienR) { a.y += a.speed; }

    // HITBOX P2
    const machineRectR = { x: (halfW + halfW/2) - 150, y: H - 180, w: 300, h: 180 };
    const playerRectR = { x: playerR.state.position.x, y: playerR.state.position.y, w: 40, h: 40 };

    for (let i = anomalienR.length - 1; i >= 0; i--) {
      const a = anomalienR[i];
      const aRect = { x: a.x - a.radius, y: a.y - a.radius, w: a.radius*2, h: a.radius*2 };
      let hit = false;
      if(checkCollision(playerRectR, aRect)) { 
          machineHPR -= 10; playerR.state.lives = machineHPR; blinkR_Player = 40; hit = true; 
      } else if(checkCollision(machineRectR, aRect) || a.y > H) { 
          machineHPR -= 10; playerR.state.lives = machineHPR; blinkR_Machine = 40; hit = true; 
      }
      if (hit) {
          if(config.onLivesUpdateRight) config.onLivesUpdateRight(playerR.state.lives); 
          if(config.onMachineHPUpdate) config.onMachineHPUpdate(machineHPL, machineHPR); 
          anomalienR.splice(i, 1); continue; 
      }
      for(let j=bulletsR.length-1; j>=0; j--){ const b = bulletsR[j]; if(Math.sqrt((b.x-a.x)**2 + (b.y-a.y)**2) < a.radius + 2) { bulletsR.splice(j,1); a.hp -= b.damage; if(a.hp <= 0) { playerR.state.score += a.scorePoints; if(config.onScoreUpdateRight) config.onScoreUpdateRight(playerR.state.score); anomalienR.splice(i,1); } break; } }
    }

    // WINNER CHECK
    let winner = '';
    if(machineHPL <= 0) winner = 'PLAYER 2';
    else if(machineHPR <= 0) winner = 'PLAYER 1';

    if(winner && !gameOverTriggered) {
        running = false;
        gameOverTriggered = true;
        if(config.onWinner) config.onWinner(winner);
    }
  }

  function render() {
    ctx.fillStyle = '#050513';
    ctx.fillRect(0, 0, W, H);
    
    // LINKS
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, halfW, H); ctx.clip();
    if(blinkL_Machine > 0) { blinkL_Machine--; if(Math.floor(blinkL_Machine/4)%2===0) ctx.globalAlpha = 0.5; }
    drawMachine(halfW/2, H - 60); 
    ctx.globalAlpha = 1;
    if(blinkL_Player > 0) { blinkL_Player--; if(Math.floor(blinkL_Player/4)%2===0) ctx.globalAlpha = 0; }
    playerL.drawPlayer(playerL.state.position.x, playerL.state.position.y, images, ctx);
    ctx.globalAlpha = 1;
    for(const b of bulletsL) { ctx.fillStyle='#0ff'; ctx.fillRect(b.x, b.y, 4, 10); } 
    anomalieHelper.drawAnomalie(images, ctx, anomalienL);
    ctx.restore();

    // RECHTS
    ctx.save(); ctx.beginPath(); ctx.rect(halfW, 0, halfW, H); ctx.clip();
    if(blinkR_Machine > 0) { blinkR_Machine--; if(Math.floor(blinkR_Machine/4)%2===0) ctx.globalAlpha = 0.5; }
    drawMachine(halfW + halfW/2, H - 60);
    ctx.globalAlpha = 1;
    if(blinkR_Player > 0) { blinkR_Player--; if(Math.floor(blinkR_Player/4)%2===0) ctx.globalAlpha = 0; }
    playerR.drawPlayer(playerR.state.position.x, playerR.state.position.y, images, ctx);
    ctx.globalAlpha = 1;
    for(const b of bulletsR) { ctx.fillStyle='#FFFFFF'; ctx.fillRect(b.x, b.y, 4, 10); } 
    anomalieHelper.drawAnomalie(images, ctx, anomalienR);
    ctx.restore();

    // TRENNWAND
    ctx.strokeStyle = '#EF7D00'; ctx.lineWidth = 5; 
    ctx.beginPath(); ctx.moveTo(halfW, 0); ctx.lineTo(halfW, H); ctx.stroke();
    ctx.shadowBlur = 10; ctx.shadowColor = '#EF7D00'; ctx.stroke(); ctx.shadowBlur = 0;
  }

  function drawMachine(x: number, y: number) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(9, 5); 
      if(images.maschine) ctx.drawImage(images.maschine, -48, -24, 96, 48);
      else {
        ctx.fillStyle = '#444'; ctx.fillRect(-48, -12, 96, 24);
        ctx.fillStyle = '#f9d423'; ctx.fillRect(-6, -6, 12, 12);
      }
      ctx.restore();
  }

  (async () => {
    await preloadImages();
    const frame = () => { if(!running) return; step(); render(); raf = requestAnimationFrame(frame); };
    raf = requestAnimationFrame(frame);
  })();

  return { 
      destroy() { 
        running = false; 
        cancelAnimationFrame(raf); 
        window.removeEventListener('keydown', keyDownListener); 
        window.removeEventListener('keyup', keyUpListener);
      }, 
      setInput(s:any) {} 
  };
}