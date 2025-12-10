export interface PlayerModel {
    id: string;
    name: string;
    lives: number;
    position: {
      x: number;
      y: number;
    };
    speed: number;
    damage: number;
    isAlive: boolean;
    score: number;
    level: number;
    levelWeapon: number;
    width: number,
    height: number,
    color: 'blue',
  }
  
  export interface BulletModel {
    x: number;
    y: number;
    speed: number;
    damage: number;
  }
  
  export interface AnomalieModel {
    x: number;
    y: number;
    radius: number;
    hp: number;
    speed: number;
    strength: number;
    scorePoints: number;
    imageIndex?: number;
  }
  
  export interface PowerupModel {
    x: number;
    y: number;
    type: "good" | "bad";
    speed: number;
  }

  export interface InputState {
    left: boolean;
    right: boolean;
    up: boolean;
    down: boolean;
    //fire: boolean;
    shootOnce: boolean;
  }

