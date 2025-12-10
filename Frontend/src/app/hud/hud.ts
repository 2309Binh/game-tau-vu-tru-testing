import { Component, Input } from '@angular/core';
import { DecimalPipe } from '@angular/common';

@Component({
  selector: 'app-hud',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './hud.html',
  styleUrls: ['./hud.css']
})
export class HudComponent {
  @Input() score: number = 0;
  @Input() highscore: number = 0;
  @Input() wave: number = 1;
  @Input() lives: number = 100;
}