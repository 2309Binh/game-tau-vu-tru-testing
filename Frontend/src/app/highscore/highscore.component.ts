import { Component } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';

interface Highscore {
  id: number;
  playerName: string;
  score: number;
  createdAt: string;
}

@Component({
  selector: 'app-highscore',
  standalone: true,
  imports: [CommonModule, HttpClientModule, DatePipe],
  templateUrl: './highscore.component.html',
  styleUrls: ['./highscore.component.css']
})
export class HighscoreComponent {

  highscores: Highscore[] = [];

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadHighscores();
  }

  loadHighscores(): void {
    this.http.get<Highscore[]>('http://localhost:5000/api/highscore')
      .subscribe(data => {
        this.highscores = data;
      });
  }
}
