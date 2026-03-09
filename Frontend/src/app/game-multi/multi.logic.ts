import { Anomalie } from "../entities/anomalie";
import { Player } from "../entities/player";
import { AnomalieModel, BulletModel, InputState } from "../core/game-models";
import { Bullet } from "../entities/bullet";
import { Powerup } from "../entities/powerup";
import { GameConfig } from "../core/game-config";
import { GameConfigService, GameConfigType } from "../core/services/game-config.service";

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
  GameConfig: GameConfigType;
}

function checkCollision(r1: any, r2: any): boolean {
  return (
    r1.x < r2.x + r2.w && r1.x + r1.w > r2.x &&
    r1.y < r2.y + r2.h && r1.y + r1.h > r2.y
  );
}

function dist(ax: number, ay: number, bx: number, by: number) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
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

  const playerL = new Player(config.GameConfig, true); // true für Multiplayer
  const playerR = new Player(config.GameConfig, true); // true für Multiplayer
  
  playerL.state.lives = config.GameConfig.totalLives;
  playerR.state.lives = config.GameConfig.totalLives;
  
  playerL.state.position.y = H - 140;
  playerR.state.position.y = H - 140;

  // Player 2 start X (right side)
  playerR.state.position.x = W * 0.75 - 20;

  if (W > 100) {
      playerL.state.position.x = W * 0.25 - 20;
  }

  let machineHPL = 100, machineHPR = 100;
  let blinkL_Player = 0, blinkL_Machine = 0;
  let blinkR_Player = 0, blinkR_Machine = 0;
  let machineInvulL = 0, machineInvulR = 0;

  let bulletsL: BulletModel[] = [], bulletsR: BulletModel[] = [];
  let anomalienL: AnomalieModel[] = [], anomalienR: AnomalieModel[] = [];

 
  let powerupsL: Powerup[] = [], powerupsR: Powerup[] = [];
  let activeTexts: { text: string; x: number; y: number; spawnTime: number; duration: number }[] = [];
  const anomalieHelper = new Anomalie(config.GameConfig, W, H);

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
    const entries = Object.entries(config.GameConfig.imagesToLoad);
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

/* -------------------- Helper: Distanz -------------------- */
function dist(ax: number, ay: number, bx: number, by: number) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
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
    // Only call move once per frame for P1
    playerL.move(inputL, W, H);

    if (playerL.state.position.x < 0) playerL.state.position.x = 0;
    
    // FIX: Boundary etwas lockern (von -40 auf -25), damit P1 die Mitte besser trifft
    if (playerL.state.position.x > halfW - 25) playerL.state.position.x = halfW - 25;

    if(fireCooldownL > 0) fireCooldownL--;
    if(machineInvulL > 0) machineInvulL--;
    if(inputL.shootOnce && fireCooldownL <= 0) { 
      Bullet.fireBullet(bulletsL, playerL.state, config.GameConfig); 
      fireCooldownL = 5; 
      inputL.shootOnce = false; 
      if(config.onShot) config.onShot('left');
    }
    for(let i=bulletsL.length-1; i>=0; i--) { 
        bulletsL[i].y -= bulletsL[i].speed; 
        if(bulletsL[i].y < -20) bulletsL.splice(i,1); 
    }
    
    anomalieHelper.updateSpawn(playerL.state, anomalienL.length, images, ctx, anomalienL, 'left',W, true); // true für Multiplayer
    for(const a of anomalienL) { a.y += a.speed; 
      if(a.x > halfW - a.radius) a.x = halfW - a.radius; 
    }

    
    
    // HITBOX P1
    const MACHINE_W_L = 864;
    const MACHINE_H_L = 140;   

    const machineRectL = {
      x: (halfW/2) - MACHINE_W_L / 2,
      y: (H-60) - MACHINE_H_L / 2,
      w: MACHINE_W_L,
      h: MACHINE_H_L
    };

    const playerRectL = { x: playerL.state.position.x, y: playerL.state.position.y, w: 40, h: 40 };

    for (let i = anomalienL.length - 1; i >= 0; i--) {

      const a = anomalienL[i];
      const aRect = { 
        x: a.x - a.radius, 
        y: a.y - a.radius, 
        w: a.radius*2, 
        h: a.radius*2 };

      let hit = false;

      if(checkCollision(playerRectL, aRect)) { // Kollision mit Spieler und Anomalie
        if (!playerL.starmanActive){
          playerL.takeDamage(config.GameConfig.playerDamageByAnomalieCollisionMulti);
          machineHPL -= config.GameConfig.playerDamageByAnomalieCollisionMulti;
          blinkL_Player = config.GameConfig.playerDamageBlinkDuration; // Spieler blinkt

          activeTexts.push({ //erzeugt Popup-Text wenn Player Schaden nimmt
            text: `-${config.GameConfig.playerDamageByAnomalieCollisionMulti} HP!`,
            x: a.x,        
            y: a.y,        
            spawnTime: performance.now(),
            duration: config.GameConfig.popupTextDuration 
        });
        }
          playerL.state.lives = machineHPL; 
          hit = true; 
      } 
      else if(checkCollision(machineRectL, aRect) || a.y > H) { // Kollision mit Maschine und Anomalie
        if (!playerL.starmanActive){
          const dmg = Math.max(1, Math.round((config.GameConfig.machineDamageAnomalieCollisionMulti / 100) * a.hp)); //damage based on anomaly HP
          playerL.takeDamage(dmg);
          machineHPL -= dmg;
          blinkL_Machine = config.GameConfig.machineBlinkDuration;

          activeTexts.push({ //erzeugt Popup-Text wenn Maschine Schaden nimmt
            text: `-${dmg} HP!`,
            x: a.x,        
            y: a.y,        
            spawnTime: performance.now(),
            duration: config.GameConfig.popupTextDuration 
        });
        }
          playerL.state.lives = machineHPL; 
          hit = true; 
      }

      if (hit) {
          if(config.onLivesUpdateLeft) config.onLivesUpdateLeft(playerL.state.lives); 
          if(config.onMachineHPUpdate) config.onMachineHPUpdate(machineHPL, machineHPR); 
          anomalienL.splice(i, 1); 
          continue; 
      }

      for(let j=bulletsL.length-1; j>=0; j--)
        { 
          const b = bulletsL[j]; 
          
          if(Math.sqrt((b.x-a.x)**2 + (b.y-a.y)**2) < a.radius + 2) 
            { 
              bulletsL.splice(j,1); a.hp -= b.damage; 
              if(a.hp <= 0) 
                { 
                  let pointsGained = a.scorePoints;
                  if (playerL.starmanActive) { // Doppel-Punkte, wenn Starman aktiv
                      pointsGained *= 2;
                  }
                  playerL.state.score += pointsGained; 

                  activeTexts.push({ //erzeugt Popup-Text wenn Anomalie zerstört wurde
                    text: `+${pointsGained} Points!`,
                    x: a.x,        
                    y: a.y,        
                    spawnTime: performance.now(),
                    duration: config.GameConfig.popupTextDuration 
                   });

                    const pts = config.pointsPerLevel || 1500;
                    const calculatedLevel = Math.floor(playerL.state.score / pts) + 1;
                    if (calculatedLevel > playerL.state.level) {
                      const diff = calculatedLevel - playerL.state.level;
                      for (let k = 0; k < diff; k++) {
                        anomalieHelper.levelUp(playerL.state);
                      }
                      if (config.onLevelUpdateLeft) config.onLevelUpdateLeft(playerL.state.level);
                    }

                   if (Math.random() < config.GameConfig.powerupChance) {
                    powerupsL.push(new Powerup(a,config.GameConfig));
                  }

                  if(config.onScoreUpdateLeft) config.onScoreUpdateLeft(playerL.state.score); 
                  anomalienL.splice(i,1); 
                } 
                break; 
              } 
            }
    }


    // --- P2 (RECHTS) ---
    // Use same movement logic as P1: call move once per frame
    playerR.move(inputR, W, H);

    // Boundary: restrict to right half (mirror of P1)
    if (playerR.state.position.x < halfW + 25) playerR.state.position.x = halfW + 25;
    if (playerR.state.position.x > W - 25) playerR.state.position.x = W - 25;

    if(fireCooldownR > 0) fireCooldownR--;
    if(machineInvulR > 0) machineInvulR--;
    if(inputR.shootOnce && fireCooldownR <= 0) { 
      Bullet.fireBullet(bulletsR, playerR.state, config.GameConfig); 
      fireCooldownR = 5; 
      inputR.shootOnce = false; 
      if(config.onShot) config.onShot('right');
    }
    for(let i=bulletsR.length-1; i>=0; i--) { 
        bulletsR[i].y -= bulletsR[i].speed; 
        if(bulletsR[i].y < -20) bulletsR.splice(i,1); 
    }
    
    // Anomalie Spawn P2
    
    // Player 2 / rechte Seite
    anomalienR = anomalieHelper.updateSpawn(playerR.state, anomalienR.length, images, ctx, anomalienR, 'right',W, true); // true für Multiplayer
    for(const a of anomalienR) { 
      a.y += a.speed; 
      if(a.x < halfW + a.radius) a.x = halfW + a.radius; // sorgt dafür, dass sie nicht links rutschen
  }

    //for(const a of anomalienR) { a.y += a.speed; }

    // HITBOX P2
    const MACHINE_W_R = 864;
    const MACHINE_H_R = 140;   

    const machineRectR = {
      x: ((halfW)+(halfW/2)) - MACHINE_W_R / 2,
      y: (H-60) - MACHINE_H_R / 2,
      w: MACHINE_W_R,
      h: MACHINE_H_R
    };
    const playerRectR = { x: playerR.state.position.x, y: playerR.state.position.y, w: 40, h: 40 };

    for (let i = anomalienR.length - 1; i >= 0; i--) {
      const a = anomalienR[i];
      const aRect = { x: a.x - a.radius, y: a.y - a.radius, w: a.radius*2, h: a.radius*2 };

      let hit = false;

      if(checkCollision(playerRectR, aRect)) { // Kollision mit Spieler und Anomalie
          if (!playerR.starmanActive){
          playerR.takeDamage(config.GameConfig.playerDamageByAnomalieCollisionMulti);
          machineHPR -= config.GameConfig.playerDamageByAnomalieCollisionMulti;
          blinkR_Player = config.GameConfig.playerDamageBlinkDuration; // Spieler blinkt

          activeTexts.push({ //erzeugt Popup-Text wenn Player Schaden nimmt
            text: `-${config.GameConfig.playerDamageByAnomalieCollisionMulti} HP!`,
            x: a.x,        
            y: a.y,        
            spawnTime: performance.now(),
            duration: config.GameConfig.popupTextDuration 
        });
        }
          playerR.state.lives = machineHPL; 
          hit = true; 
      } 
      else if(checkCollision(machineRectR, aRect) || a.y > H) { // Kollision mit Maschine und Anomalie
        if (!playerR.starmanActive){
          const dmg = Math.max(1, Math.round((config.GameConfig.machineDamageAnomalieCollisionMulti / 100) * a.hp)); //damage based on anomaly HP
          playerR.takeDamage(dmg);
          machineHPR -= dmg;
          blinkR_Machine = config.GameConfig.machineBlinkDuration;

          activeTexts.push({ //erzeugt Popup-Text wenn Maschine Schaden nimmt
            text: `-${dmg} HP!`,
            x: a.x,        
            y: a.y,        
            spawnTime: performance.now(),
            duration: config.GameConfig.popupTextDuration 
        });
        }
          playerL.state.lives = machineHPR; 
          hit = true; 
      }
      if (hit) {
          if(config.onLivesUpdateRight) config.onLivesUpdateRight(playerR.state.lives); 
          if(config.onMachineHPUpdate) config.onMachineHPUpdate(machineHPL, machineHPR); 
          anomalienR.splice(i, 1); 
          continue; 
      }
      for(let j=bulletsR.length-1; j>=0; j--)
        { 
          const b = bulletsR[j]; 
          
          if(Math.sqrt((b.x-a.x)**2 + (b.y-a.y)**2) < a.radius + 2) 
            { 
              bulletsR.splice(j,1); a.hp -= b.damage; 
              if(a.hp <= 0) 
                { 
                  let pointsGained = a.scorePoints;
                  if (playerR.starmanActive) { // Doppel-Punkte, wenn Starman aktiv
                      pointsGained *= 2;
                  }
                  playerR.state.score += pointsGained; 

                  activeTexts.push({ //erzeugt Popup-Text wenn Anomalie zerstört wurde
                    text: `+${pointsGained} Points!`,
                    x: a.x,        
                    y: a.y,        
                    spawnTime: performance.now(),
                    duration: config.GameConfig.popupTextDuration 
                   });

                   const pts = config.pointsPerLevel || 1500;
                   const calculatedLevel = Math.floor(playerR.state.score / pts) + 1;
                   if (calculatedLevel > playerR.state.level) {
                     const diff = calculatedLevel - playerR.state.level;
                     for (let k = 0; k < diff; k++) {
                       anomalieHelper.levelUp(playerR.state);
                     }
                     if (config.onLevelUpdateRight) config.onLevelUpdateRight(playerR.state.level);
                   }

                  if (Math.random() < config.GameConfig.powerupChance) {
                    powerupsR.push(new Powerup(a,config.GameConfig));
                  }
                  if(config.onScoreUpdateRight) config.onScoreUpdateRight(playerR.state.score); 
                  anomalienR.splice(i,1); 
                } 
                break; 
              } 
            }
    }

    // Powerups Links
    for (let i = powerupsL.length - 1; i >= 0; i--) {
      const p = powerupsL[i];
      p.state.y += p.state.speed;
      if (dist(p.state.x, p.state.y, playerL.state.position.x, playerL.state.position.y) < 18) {
        p.apply(playerL, activeTexts);
        machineHPL = playerL.state.lives; //sync da powerup die leben ändern kann
        powerupsL.splice(i, 1);
        if (config.onLivesUpdateLeft) config.onLivesUpdateLeft(playerL.state.lives);
        if (config.onScoreUpdateLeft) config.onScoreUpdateLeft(playerL.state.score);
      } else if (p.state.y > H + 30) powerupsL.splice(i, 1);
    }

    // Powerups rechts
    for (let i = powerupsR.length - 1; i >= 0; i--) {
      const p = powerupsR[i];
      p.state.y += p.state.speed;
      if (dist(p.state.x, p.state.y, playerR.state.position.x, playerR.state.position.y) < 18) {
        p.apply(playerR, activeTexts);
        machineHPR = playerR.state.lives; //sync da powerup die leben ändern kann
        powerupsR.splice(i, 1);
        if (config.onLivesUpdateRight) config.onLivesUpdateRight(playerR.state.lives);
        if (config.onScoreUpdateRight) config.onScoreUpdateRight(playerR.state.score);
      } else if (p.state.y > H + 30) powerupsR.splice(i, 1);
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
    if(blinkL_Machine > 0) { blinkL_Machine--; if(Math.floor(blinkL_Machine/4)%2===0) ctx.globalAlpha = 0; }
    drawMachine(halfW/2, H - 60); 
    ctx.globalAlpha = 1;
    if(blinkL_Player > 0) { blinkL_Player--; if(Math.floor(blinkL_Player/4)%2===0) ctx.globalAlpha = 0; }
    playerL.drawPlayer(playerL.state.position.x, playerL.state.position.y, images, ctx);
    ctx.globalAlpha = 1;

    if(!playerL.state.starmanActive){
      ctx.fillStyle = '#0ff'; 
      for (const b of bulletsL) {
        ctx.fillRect(b.x -2, b.y - 6, 4, 8);
      }
    }
    else{
        for (let i = 0; i < bulletsL.length; i++) {
          const b = bulletsL[i];
      
          //Bunte Farbe, die sich über die Zeit ändert
          const hue = (performance.now() / 10 + i * 30) % 360; 
          ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
      
          ctx.fillRect(b.x - 2, b.y - 6, 4, 8);
        }
    }
    
    anomalieHelper.drawAnomalie(images, ctx, anomalienL);
    for (const p of powerupsL) {
      ctx.fillStyle = p.state.type === 'good' ? '#60d394' : '#ff6b6b';
      ctx.beginPath();
      ctx.arc(p.state.x, p.state.y, 8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // RECHTS
    ctx.save(); ctx.beginPath(); ctx.rect(halfW, 0, halfW, H); ctx.clip();
    if(blinkR_Machine > 0) { blinkR_Machine--; if(Math.floor(blinkR_Machine/4)%2===0) ctx.globalAlpha = 0; }
    drawMachine(halfW + halfW/2, H - 60);
    ctx.globalAlpha = 1;
    if(blinkR_Player > 0) { blinkR_Player--; if(Math.floor(blinkR_Player/4)%2===0) ctx.globalAlpha = 0; }
    playerR.drawPlayer(playerR.state.position.x, playerR.state.position.y, images, ctx);
    ctx.globalAlpha = 1;


    if(!playerR.state.starmanActive){
      ctx.fillStyle = '#FFFFFF'; 
      for (const b of bulletsR) {
        ctx.fillRect(b.x -2, b.y - 6, 4, 8);
      }
    }
    else{
        for (let i = 0; i < bulletsR.length; i++) {
          const b = bulletsR[i];
      
          //Bunte Farbe, die sich über die Zeit ändert
          const hue = (performance.now() / 10 + i * 30) % 360; 
          ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
      
          ctx.fillRect(b.x - 2, b.y - 6, 4, 8);
        }
    }
  
    anomalieHelper.drawAnomalie(images, ctx, anomalienR);
    for (const p of powerupsR) {
      ctx.fillStyle = p.state.type === 'good' ? '#60d394' : '#ff6b6b';
      ctx.beginPath();
      ctx.arc(p.state.x, p.state.y, 8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // TRENNWAND
    ctx.strokeStyle = '#EF7D00'; ctx.lineWidth = 5; 
    ctx.beginPath(); ctx.moveTo(halfW, 0); ctx.lineTo(halfW, H); ctx.stroke();
    ctx.shadowBlur = 10; ctx.shadowColor = '#EF7D00'; ctx.stroke(); ctx.shadowBlur = 0;

    // POWERUPS links
    for (const p of powerupsL) {
      ctx.fillStyle = p.state.type === 'good' ? '#60d394' : '#ff6b6b';
      ctx.beginPath();
      ctx.arc(p.state.x, p.state.y, 8, 0, Math.PI * 2);
      ctx.fill();
    }  

    // POWERUPS rechts
    for (const p of powerupsR) {
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

  function drawMachine(x: number, y: number) {
      const drawH = 48;
      const drawW = 96;
      const scaleX = config.GameConfig.machineScaleXmulti;
      const scaleY = config.GameConfig.machineScaleYmulti;
      const posY = y + config.GameConfig.machineYmulti;

      ctx.save();
      ctx.translate(x, posY);
      ctx.scale(scaleX, scaleY); 
      if(images.maschine) ctx.drawImage(images.maschine, -drawW / 2, -drawH / 2, drawW, drawH);
      else {
        ctx.fillStyle = '#444'; ctx.fillRect(-48, -12, 96, 24);
        ctx.fillStyle = '#f9d423'; ctx.fillRect(-6, -6, 12, 12);
      }
      ctx.restore();
  }

  //game loop
  // fps control
  (async () => {
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


  return { 
      destroy() { 
        running = false; 
        cancelAnimationFrame(raf); 
        window.removeEventListener('keydown', keyDownListener); 
        window.removeEventListener('keyup', keyUpListener);
      }, 
      setInput(s:any) {
        try {
          if (!s) return;
          // remove player marker before applying
          const data = { ...s };
          const player = data.player;
          delete (data as any).player;

          if (player === 'left') {
            Object.assign(inputL, data);
          } else if (player === 'right') {
            Object.assign(inputR, data);
          } else {
            // fallback: apply to both players if no player specified
            Object.assign(inputL, data);
            Object.assign(inputR, data);
          }
        } catch (e) {}
      }
  };
}