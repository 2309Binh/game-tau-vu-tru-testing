import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HighscoreService, HighscoreDto } from '../core/services/highscore.service'; 

@Component({
  selector: 'app-game-over',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './gameover.html',
  styleUrls: ['./gameover.css']
})
export class GameOverComponent implements OnInit {

  score = 0;
  
  // ARCADE INPUT
  nameChars = ['A', 'A', 'A']; 
  activeSlot = 0; 
  readonly ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ .0123456789"; 

  // FLAGS
  isSaving = false; 
  scoreSaved = false; // Neu: Damit wir wissen, ob schon gespeichert wurde

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
    if (!this.score) {
      this.score = history.state['score'] || 0;
    }
    this.loadHighscores();
  }

  // --- STEUERUNG ---
  @HostListener('window:keydown', ['$event'])
  handleInput(event: KeyboardEvent) {
    const code = event.code; // KeyCode (Digit9, ArrowUp, etc.)

    // Verhindert Scrollen
    if(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)) {
      event.preventDefault();
    }

    // Wenn gerade gespeichert wird, nix tun
    if (this.isSaving) return;

    // --- NAVIGATION (Nur wenn noch nicht gespeichert wurde) ---
    if (!this.scoreSaved) {
        // 1. Buchstaben ändern
        if (code === 'ArrowUp' || code === 'KeyW') { this.changeChar(-1); }
        if (code === 'ArrowDown' || code === 'KeyS') { this.changeChar(1); }

        // 2. Position wechseln
        if (code === 'ArrowLeft' || code === 'KeyA') {
          this.activeSlot = (this.activeSlot > 0) ? this.activeSlot - 1 : 2;
        }
        if (code === 'ArrowRight' || code === 'KeyD') {
          this.activeSlot = (this.activeSlot < 2) ? this.activeSlot + 1 : 0;
        }
    }

    // --- BUTTONS ---
    
    // TASTE 8 (SELECT) -> SPEICHERN
    // (Nur wenn noch nicht gespeichert wurde)
    if ((code === 'Digit8' || code === 'Space') && !this.scoreSaved) {
       this.saveScore();
    }

    // TASTE 9 (START) -> ZURÜCK ZUM STARTBILDSCHIRM
    // (Egal ob gespeichert oder nicht)
    if (code === 'Digit9' || code === 'Enter' || code === 'ControlLeft') {
       this.onMenu();
    }
  }

  changeChar(direction: number) {
    const currentChar = this.nameChars[this.activeSlot];
    let index = this.ALPHABET.indexOf(currentChar);
    index += direction;
    if (index < 0) index = this.ALPHABET.length - 1;
    if (index >= this.ALPHABET.length) index = 0;
    this.nameChars[this.activeSlot] = this.ALPHABET[index];
  }

  loadHighscores() {
    this.highscoreService.getTopAlltime().subscribe(d => this.topAlltime = d);
    this.highscoreService.getTopToday().subscribe(d => this.topToday = d);
  }

  saveScore() {
    if (this.isSaving || this.scoreSaved) return;
    
    const finalName = this.nameChars.join('');
    this.isSaving = true;

    this.highscoreService.save(finalName, this.score).subscribe({
      next: () => {
        console.log('Score gespeichert!');
        this.isSaving = false;
        this.scoreSaved = true; // Input ausblenden, Erfolg anzeigen
        this.loadHighscores();  // Liste aktualisieren
        
        // Optional: Nach 3 Sekunden automatisch zum Start
        // setTimeout(() => this.onMenu(), 3000); 
      },
      error: (err) => {
        console.error('Fehler:', err);
        this.isSaving = false;
      }
    });
  }

  onMenu() { 
    this.router.navigate(['/']); 
  }
}