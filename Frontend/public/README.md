Mini Smartlimit Watcher — Frontend demo

This folder contains a minimal standalone HTML/JS canvas demo implementing the game's frontend concept.

Files:
- `game.html` — entry page (start screen, gameover, gameplay canvas).
- `game.css` — styling.
- `game.js` — simple game logic and mechanics (single-file, readable).

Run locally:
- Open `Frontend/public/game.html` in your browser (double-click or "Open File").
- Or serve the folder with a small static server (recommended for mobile input):

	PowerShell example:

	```powershell
	cd Frontend/public; python -m http.server 8000; # if Python is installed
	```

Notes:
- This is a simple, single-file frontend to demonstrate gameplay mechanics.
- It's intentionally minimal and easy to read; feel free to ask me to integrate it into the Angular app further, add graphics, or extend mechanics (powerups, multiplayer, levels UI, highscore list, persistence, etc.).
