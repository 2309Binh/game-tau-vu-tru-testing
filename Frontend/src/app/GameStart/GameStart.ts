import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-game-start',
  templateUrl: './GameStart.html',
  styleUrls: ['./GameStart.css']
})
export class GameStartComponent {

  constructor(private router: Router) {}

  startGame() {
    this.router.navigate(['/game']);
  }

  openHighscores() {
    this.router.navigate(['/highscore']);
  }

  openAnleitung() {
    this.router.navigate(['/anleitung']);
  }
}
