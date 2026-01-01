import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface HighscoreDto {
  playerName: string;
  score: number;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class HighscoreService {
  private api = 'http://localhost:5000/api/highscore';

  constructor(private http: HttpClient) {}

  getTopAlltime(): Observable<HighscoreDto[]> {
    return this.http.get<HighscoreDto[]>(`${this.api}/top/alltime`);
  }

  getTopToday(): Observable<HighscoreDto[]> {
    return this.http.get<HighscoreDto[]>(`${this.api}/top/today`);
  }

  save(name: string, score: number) {
    return this.http.post(this.api, {
      playerName: name,
      score: score
    });
  }
}
