import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { HighscoreService, HighscoreDto } from '../core/services/highscore.service';
import { CommonModule, DatePipe } from '@angular/common';


@Component({
  selector: 'app-game-start',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './GameStart.html',
  styleUrls: ['./GameStart.css']
})
export class GameStartComponent implements OnInit, OnDestroy {

  topAlltime: HighscoreDto[] = [];
  topToday: HighscoreDto[] = [];
  showModeSelection = false;

   private sub?: Subscription;

  constructor(private router: Router,private highscoreService: HighscoreService
  ) {}

  ngOnInit(): void {
    // initial
    this.loadTopScores();

    // jedes Mal, wenn wir wieder auf "/" landen
    this.sub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        // wenn wir wieder im Start-Menü sind
        if (e.urlAfterRedirects === '/' || e.urlAfterRedirects.startsWith('/?')) {
          this.loadTopScores();
        }
      });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  private loadTopScores(): void {
    this.highscoreService.getTopAlltime().subscribe(d => this.topAlltime = d);
    this.highscoreService.getTopToday().subscribe(d => this.topToday = d);
  }

  onStart() {
    // open mode selection (Single / Multi)
    this.showModeSelection = true;
  }

  selectSingle() {
    this.showModeSelection = false;
    this.router.navigate(['/game']);
  }

  selectMulti() {
    this.showModeSelection = false;
    this.router.navigate(['/game-multi']);
  }

  onHighscores() {
    this.router.navigate(['/highscore']);
  }

  onAnleitung() {
    this.router.navigate(['/anleitung']);
  }
}
