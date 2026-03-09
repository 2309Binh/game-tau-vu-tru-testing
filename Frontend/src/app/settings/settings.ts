import { Component, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GameConfigService, GameConfigType } from '../core/services/game-config.service';

type EditableConfigKey = keyof Omit<GameConfigType, 'imagesToLoad' | 'powerupTypesGood' | 'powerupTypesBad'>;

interface ConfigField {
  key: EditableConfigKey;
  label: string;
  description: string;
  type: 'number' | 'text' | 'boolean';
  step?: string;
}

interface ConfigCategory {
  title: string;
  fields: ConfigField[];
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.html',
  styleUrls: ['./settings.css']
})
export class SettingsComponent {
  private configService = inject(GameConfigService);
  
  config = this.configService.config;
  
  configCategories = computed<ConfigCategory[]>(() => [
    {
      title: 'Canvas',
      fields: [
        { key: 'canvasBg', label: 'Hintergrundfarbe', description: 'Hintergrundfarbe des Spiels', type: 'text' },
        { key: 'canvasWidth', label: 'Canvas Breite', description: 'Breite des Canvas', type: 'number' },
        { key: 'canvasHeight', label: 'Canvas Höhe', description: 'Höhe des Canvas', type: 'number' },
      ]
    },
    {
      title: 'Audio',
      fields: [
        { key: 'bgm', label: 'Hintergrundmusik', description: 'Pfad zur Hintergrundmusik', type: 'text' },
        { key: 'shotSound', label: 'Schuss-Sound', description: 'Pfad zum Schuss-Sound', type: 'text' },
        { key: 'bgmVolume', label: 'Musik Lautstärke', description: 'Lautstärke der Hintergrundmusik (0-1)', type: 'number', step: '0.01' },
        { key: 'shotSoundVolume', label: 'Schuss Lautstärke', description: 'Lautstärke des Schuss-Sounds (0-1)', type: 'number', step: '0.01' },
      ]
    },
    {
      title: 'Gameplay',
      fields: [
        { key: 'powerupChance', label: 'Powerup Chance', description: 'Wahrscheinlichkeit für Powerup-Spawn (0-1)', type: 'number', step: '0.01' },
        { key: 'powerupTypeChance', label: 'Gute Powerup Chance', description: 'Wahrscheinlichkeit für gute Powerups (0-1)', type: 'number', step: '0.01' },
        { key: 'bulletSpeed', label: 'Schuss-Geschwindigkeit', description: 'Geschwindigkeit der Schüsse', type: 'number' },
        { key: 'targetFps', label: 'Ziel FPS', description: 'Bilder pro Sekunde', type: 'number' },
      ]
    },
    {
      title: 'Powerup Sachen',
      fields: [
        { key: 'starmanDuration', label: 'Starman Dauer', description: 'Dauer des Starman-Effekts in ms', type: 'number' },
        { key: 'keyChangeDuration', label: 'Key Change Dauer', description: 'Dauer des KeyChange-Effekts in ms', type: 'number' },
      ]
    },
    {
      title: 'Maschine',
      fields: [
        { key: 'machineHP', label: 'Maschinen HP', description: 'Start-Lebenspunkte der Maschine', type: 'number' },
        { key: 'machineDamageAnomalieCollision', label: 'Maschinen Kollisionsschaden', description: 'Schaden bei Anomalie-Kollision (Prozent)', type: 'number' },
        { key: 'machineCollisionYOffset', label: 'Maschinen Y-Offset', description: 'Vertikaler Offset für Kollisionserkennung', type: 'number' },
        { key: 'machineCollisionHalfWidth', label: 'Maschinen Kollisionsbreite', description: 'Halbe Breite der Kollisionsbox', type: 'number' },
        { key: 'machineVisualYOffset', label: 'Maschinen Visual Y-Offset', description: 'Visueller Offset zum Zeichnen', type: 'number' },
        { key: 'machineBlinkDuration', label: 'Maschinen Blink-Dauer', description: 'Blink-Dauer nach Schaden (ms)', type: 'number' },
        { key: 'machineInvulnerableTimer', label: 'Maschinen Unverwundbarkeit', description: 'Unverwundbarkeit nach Schaden (ms)', type: 'number' },
        { key: 'machineScaleXsingle', label: 'Maschinen Scale X für Single', description: 'Scale halt', type: 'number' },
        { key: 'machineScaleYsingle', label: 'Maschinen Scale Y für Single', description: 'Scale halt', type: 'number' },
        { key: 'machineYsingle', label: 'Maschinen Y-Position Single', description: 'Y-Position der Maschine verschieben', type: 'number' },
        { key: 'machineYmulti', label: 'Maschinen Y-Position Multi', description: 'Y-Position der Maschine verschieben', type: 'number' },
        { key: 'machineScaleXmulti', label: 'Maschinen Scale X für Multi', description: 'Scale halt', type: 'number' },
        { key: 'machineScaleYmulti', label: 'Maschinen Scale Y für Multi', description: 'Scale halt', type: 'number' },
      ]
    },
    {
      title: 'Spieler',
      fields: [
        { key: 'startSpeedPlayerSingle', label: 'Spieler Start-Speed', description: 'Startgeschwindigkeit des Spielers', type: 'number' },
        { key: 'startSpeedPlayerMulti', label: 'Spieler Start-Speed (Multi)', description: 'Startgeschwindigkeit des Spielers im Multiplayer', type: 'number' },
        { key: 'playerDamageByAnomalieCollision', label: 'Spieler Kollisionsschaden', description: 'Schaden bei Anomalie-Kollision', type: 'number' },
        { key: 'playerDamageBlinkDuration', label: 'Spieler Blink-Dauer', description: 'Blink-Dauer nach Schaden (ms)', type: 'number' },
        { key: 'totalLives', label: 'Gesamt-Leben', description: 'Startanzahl der Leben', type: 'number' },
        { key: 'playerStartPointY', label: 'Spieler Start Y-Position', description: 'Y-Position des Spielers beim Start', type: 'number' },
      ]
    },
    {
      title: 'Anomalien',
      fields: [
        { key: 'startSpeedAnomalies', label: 'Anomalie Start-Speed', description: 'Startgeschwindigkeit der Anomalien', type: 'number', step: '0.1' },
        { key: 'speedIncreasePerLevelAnomalies', label: 'Speed-Erhöhung pro Level', description: 'Geschwindigkeitserhöhung der Anomalien', type: 'number', step: '0.01' },
        { key: 'schwierigkeitHPAnomalie', label: 'Schwierigkeitsgrad HP', description: 'HP-Multiplikator für Anomalien', type: 'number', step: '0.01' },
        { key: 'percentageBigAnomalie', label: 'Große Anomalie %', description: 'Auftrittswahrscheinlichkeit starker Anomalien', type: 'number', step: '0.01' },
        { key: 'speedIncreasePerLevelAnomaliesMulti', label: 'Speed-Erhöhung pro Level (Multi)', description: 'Geschwindigkeitserhöhung der Anomalien im Multiplayer', type: 'number', step: '0.01' },
        { key: 'schwierigkeitHPAnomalieMulti', label: 'Schwierigkeitsgrad HP (Multi)', description: 'HP-Multiplikator für Anomalien im Multiplayer', type: 'number', step: '0.01' },
        { key: 'percentageBigAnomalieMulti', label: 'Große Anomalie % (Multi)', description: 'Auftrittswahrscheinlichkeit starker Anomalien im Multiplayer', type: 'number', step: '0.01' },
      ]
    },
    {
      title: 'Level',
      fields: [
        { key: 'pointsPerLevel', label: 'Punkte pro Level', description: 'Benötigte Punkte für Level-Up', type: 'number' },
      ]
    },
    {
      title: 'UI & Anzeige',
      fields: [
        { key: 'powerUpTextDuration', label: 'Powerup Text Dauer', description: 'Anzeigedauer des Powerup-Texts (ms)', type: 'number' },
        { key: 'popupTextDuration', label: 'Popup Text Dauer', description: 'Anzeigedauer von Popup-Texten (ms)', type: 'number' },
      ]
    },
    {
      title: 'Multiplayer',
      fields: [
        { key: 'playerDamageByAnomalieCollisionMulti', label: 'Spieler Schaden (Multi)', description: 'Kollisionsschaden im Multiplayer', type: 'number' },
        { key: 'machineDamageAnomalieCollisionMulti', label: 'Maschinen Schaden (Multi)', description: 'Kollisionsschaden im Multiplayer (Prozent)', type: 'number' },
      ]
    },
  ]);

  updateConfigValue(key: EditableConfigKey, value: any) {
    const current = this.config();
    if (!current) return;

    const parsedValue = this.parseValue(current[key], value);
    this.configService.updateConfig({ [key]: parsedValue });
    // Speichert direkt im Backend
  }



  async reloadConfig() {
    await this.configService.loadConfig();
    alert('Config neu geladen!');
  }

  private parseValue(currentValue: any, newValue: any) {
    if (typeof currentValue === 'number') return Number(newValue);
    if (typeof currentValue === 'boolean') return Boolean(newValue);
    return newValue;
  }
}