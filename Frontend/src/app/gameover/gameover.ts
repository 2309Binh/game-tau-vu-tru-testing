import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HighscoreService, HighscoreDto } from '../core/services/highscore.service'; // Pfad prüfen

@Component({
  selector: 'app-game-over',
  standalone: true,
  imports: [CommonModule], // FormsModule brauchen wir nicht mehr!
  templateUrl: './gameover.html',
  styleUrls: ['./gameover.css']
})
export class GameOverComponent implements OnInit {

  score = 0;
  
  // --- NEU: ARCADE INPUT VARIABLES ---
  nameChars = ['A', 'A', 'A']; // Startet immer mit AAA
  activeSlot = 0; // Welcher Buchstabe wird gerade geändert? (0, 1 oder 2)
  readonly ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ .0123456789"; 
  // -----------------------------------

  topAlltime: HighscoreDto[] = [];
  topToday: HighscoreDto[] = [];

  constructor(
    private router: Router,
    private highscoreService: HighscoreService
  ) {
    const nav = this.router.getCurrentNavigation();
    this.score = nav?.extras.state?.['score'] || 0;
  }

  ngOnInit(): void {
    this.loadHighscores();
  }

  // Lauscht auf Joystick-Eingaben (Pfeiltasten) und Buttons
  @HostListener('window:keydown', ['$event'])
  handleInput(event: KeyboardEvent) {
    const key = event.code;

    // 1. Buchstaben ändern (HOCH / RUNTER)
    if (key === 'ArrowUp' || key === 'KeyW') {
      this.changeChar(-1); // Vorheriger Buchstabe
    }
    if (key === 'ArrowDown' || key === 'KeyS') {
      this.changeChar(1); // Nächster Buchstabe
    }

    // 2. Position wechseln (LINKS / RECHTS)
    if (key === 'ArrowLeft' || key === 'KeyA') {
      this.activeSlot = (this.activeSlot > 0) ? this.activeSlot - 1 : 2;
    }
    if (key === 'ArrowRight' || key === 'KeyD') {
      this.activeSlot = (this.activeSlot < 2) ? this.activeSlot + 1 : 0;
    }

    // 3. Speichern / Bestätigen (SPACE / ENTER)
    if (key === 'Space' || key === 'Enter' || key === 'Digit9' || key === 'Numpad9') {
      this.saveScore();
    }
  }

  changeChar(direction: number) {
    const currentChar = this.nameChars[this.activeSlot];
    let index = this.ALPHABET.indexOf(currentChar);
    
    // Index verschieben
    index += direction;

    // Loop-Logik (Nach Z kommt A, vor A kommt Z)
    if (index < 0) index = this.ALPHABET.length - 1;
    if (index >= this.ALPHABET.length) index = 0;

    this.nameChars[this.activeSlot] = this.ALPHABET[index];
  }

  loadHighscores() {
    this.highscoreService.getTopAlltime().subscribe(d => this.topAlltime = d);
    this.highscoreService.getTopToday().subscribe(d => this.topToday = d);
  }

  saveScore() {
    // Array zu String zusammenbauen ("A", "B", "C" -> "ABC")
    const finalName = this.nameChars.join('');

    this.highscoreService.save(finalName, this.score).subscribe({
      next: () => {
        console.log('Score gespeichert!');
        this.loadHighscores();
        // Optional: Nach dem Speichern direkt zum Menu oder Neustart
        setTimeout(() => this.onMenu(), 1000); 
      },
      error: (err) => console.error(err)
    });
  }

  onRetry() { this.router.navigate(['/game']); }
  onMenu() { this.router.navigate(['/']); }
}