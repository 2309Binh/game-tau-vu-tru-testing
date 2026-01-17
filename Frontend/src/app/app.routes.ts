import { Routes } from '@angular/router';
import { GameComponent } from './game/game.component';
import { GameStartComponent } from './GameStart/GameStart';
import { HighscoreComponent } from './highscore/highscore.component';
import { GameMultiComponent } from './game-multi/multi.component';
import { GameOverComponent } from './gameover/gameover';

export const routes: Routes = [
  { path: '', component: GameStartComponent, title: 'Start' },
  { path: 'game', component: GameComponent, title: 'Game' },
  { path: 'game-multi', component: GameMultiComponent, title: 'Game Multi' },
  { path: 'highscore', component: HighscoreComponent, title: 'Highscore' },
  { path: 'highscore', component: HighscoreComponent, title: 'Highscore' },
  { path: 'game-over', component: GameOverComponent, title: 'Game Over' }
];
