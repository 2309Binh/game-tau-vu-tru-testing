export const GameConfig = {
    canvasBg: "#050513",
    canvasWidth: 800, //funktioniert noch nicht
    canvasHeight: 600, //funktioniert noch nicht 
    powerupChance: 0.3, //chance auf Powerup beim Zerstören einer Anomalie
    powerupTypeChance: 0.5, //chance, dass ein Powerup gut ist
    imagesToLoad : {
      ship: 'assets/picture/robot.png',
      anomalie: [
        'assets/picture/ano1.png',
        'assets/picture/ano2.png',
        'assets/picture/ano3.png',
        'assets/picture/ano4.png',
        'assets/picture/ano5.png',
        'assets/picture/ano6.png',
        'assets/picture/ano7.png',
        'assets/picture/maschine.png'
      ],
      maschine: 'assets/picture/maschine.png',
    },
    bgm: 'assets/music/background.mp3',
    shotSound: 'assets/music/shot.mp3',
    bgmVolume: 0.25,
    shotSoundVolume: 0.9,
    machineDamageAnomalieCollision: 5, //Prozentualer Wert der HP von Anomalie, die der Spieler an Schaden nimmt bei Kollision mit der Maschine
    // Collision tuning for the machine (visual image is scaled when drawn)
    machineCollisionYOffset: 150, // vertical offset from bottom where machine collision begins
    machineCollisionHalfWidth: 600, // horizontal half-width of machine collision box
    // Visual offset for drawing the machine (pixels above bottom)
    machineVisualYOffset: 60  ,
    // HP for each machine in multiplayer
    machineHP: 100,
  };
  
 
  