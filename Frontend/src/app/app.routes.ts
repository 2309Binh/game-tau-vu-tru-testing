import { Routes } from '@angular/router';
import { GameComponent } from './game/game.component';

export const routes: Routes = [
	{ path: 'game', component: GameComponent },
	// Redirect root to /game so app has a clear entry (avoid redirect-to-self loop)
	{ path: '', pathMatch: 'full', redirectTo: 'game' },
];
