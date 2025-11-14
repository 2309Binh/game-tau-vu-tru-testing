import { Component, signal } from '@angular/core';
import { GameComponent } from './game/game.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [GameComponent],
  // render only the game component
  template: `<app-game></app-game>`,
  styleUrls: ['./app.css']
})
export class App {
  protected readonly title = signal('Frontend');
}
