import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface GameConfigType {
  canvasBg: string;
  canvasWidth: number;
  canvasHeight: number;
  powerupChance: number;
  powerupTypeChance: number;
  imagesToLoad: { ship: string; anomalie: string[]; maschine: string };
  bgm: string;
  shotSound: string;
  bgmVolume: number;
  shotSoundVolume: number;
  machineDamageAnomalieCollision: number;
  machineCollisionYOffset: number;
  machineCollisionHalfWidth: number;
  machineVisualYOffset: number;
  machineHP: number;
  powerupTypesGood: string[];
  powerupTypesBad: string[];
  starmanActive: boolean;
  starmanDuration: number;
  bulletSpeed: number;
  startSpeedAnomalies: number;
  startSpeedPlayerSingle: number;
  startSpeedPlayerMulti: number;
  powerUpTextDuration: number;
  popupTextDuration: number;
  playerDamageByAnomalieCollision: number;
  playerDamageBlinkDuration: number;
  machineBlinkDuration: number;
  machineInvulnerableTimer: number;
  pointsPerLevel: number;
  totalLives: number;
  speedIncreasePerLevelAnomalies: number;
  schwierigkeitHPAnomalie: number;
  percentageBigAnomalie: number;
  targetFps: number;
  playerDamageByAnomalieCollisionMulti: number;
  machineDamageAnomalieCollisionMulti: number;
  keyChangeDuration: number;
  machineScaleXsingle: number;
  machineScaleYsingle: number;
  machineYsingle: number;
  machineYmulti: number;
  playerStartPointY: number;
  machineScaleXmulti: number;
  machineScaleYmulti: number;
  speedIncreasePerLevelAnomaliesMulti: number;
  schwierigkeitHPAnomalieMulti: number;
  percentageBigAnomalieMulti: number;
}

@Injectable({
  providedIn: 'root'
})
export class GameConfigService {
  private api = 'http://localhost:5100/api/config';
  private configSignal = signal<GameConfigType | null>(null);

  constructor(private http: HttpClient) {
    this.loadConfig();
  }

  get config() {
    return this.configSignal.asReadonly();
  }

  // Backend laden
  async loadConfig() {
    try {
      const backendConfig = await firstValueFrom(this.http.get<GameConfigType>(this.api));
      this.configSignal.set(backendConfig);
      console.log('Config vom Backend geladen:', backendConfig);
    } catch (err) {
      console.error('Fehler beim Laden der Config vom Backend:', err);
    }
  }

  // Update + speichert direkt im Backend
  updateConfig(updates: Partial<GameConfigType>) {
    const current = this.configSignal();
    if (!current) return;

    const newConfig = { ...current, ...updates };
    this.configSignal.set(newConfig);
    this.saveToBackend(newConfig);
  }

  private saveToBackend(config: GameConfigType) {
    this.http.post(this.api, config).subscribe({
      next: () => console.log('Config auf Backend gespeichert'),
      error: (err) => console.error('Fehler beim Speichern auf Backend:', err)
    });
  }

  async resetToDefault() {
    try {
      // JSON-Datei auf Server neu laden
      const defaultConfig = await firstValueFrom(this.http.get<GameConfigType>(`${this.api}/default`));
      this.configSignal.set(defaultConfig);
      this.saveToBackend(defaultConfig);
      console.log('Config auf Standardwerte zurückgesetzt');
    } catch (err) {
      console.error('Fehler beim Zurücksetzen auf Standard:', err);
    }
  }

  async downloadConfig() {
    const config = this.configSignal();
    if (!config) return;

    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'game-config.json';
    link.click();
    window.URL.revokeObjectURL(url);
  }
}