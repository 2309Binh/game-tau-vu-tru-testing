import { Component, Input } from '@angular/core';
import { DecimalPipe, CommonModule } from '@angular/common'; 

@Component({
  selector: 'app-hud',
  standalone: true,
  imports: [DecimalPipe, CommonModule],
  templateUrl: './hud.html',
  styleUrls: ['./hud.css']
})
export class HudComponent {
  @Input() score: number = 0;
  @Input() wave: number = 1;
  @Input() lives: number = 100;

  // Optional: two-player inputs (when used in split-screen)
  @Input() scoreL?: number;
  @Input() scoreR?: number;
  @Input() waveL?: number;
  @Input() waveR?: number;
  // When true, hide system-status related UI (used for multiplayer split-screen)
  @Input() multiplayer: boolean = false;

  hitIndicator: boolean = false;

  getConfidenceClass(): string {
    let classes = '';
    
    // --- FARBLOGIK ---
    
    // 1. Wenn Leben 70 oder weniger: WARNUNG (wird Orange im CSS)
    if (this.lives <= 70) {
        classes += ' warning';
    }
    
    // 2. Wenn Leben 30 oder weniger: KRITISCH (wird Rot)
    if (this.lives <= 30) {
        classes = ' critical'; 
    }

    // 3. Treffer-Feedback (höchste Priorität für Animation)
    if (this.hitIndicator) {
      classes += ' hit-feedback';
    }
    
    return classes.trim();
  }
}