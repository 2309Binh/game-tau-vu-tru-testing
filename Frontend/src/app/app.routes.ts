import { Routes } from '@angular/router';
import { GameComponent } from './game/game.component';
import { GameStartComponent } from './GameStart/GameStart';
import { HighscoreComponent } from './highscore/highscore.component';

export const routes: Routes = [
  { path: '', component: GameStartComponent, title: 'Start' },
  { path: 'game', component: GameComponent, title: 'Game' },
  { path: 'highscore', component: HighscoreComponent, title: 'Highscore' }
];
