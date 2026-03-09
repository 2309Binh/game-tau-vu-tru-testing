
//  !!!

//diese datei ist nur noch für Starmanactive relevant. Die anderen Konstanten werden jetzt über game-config.service.ts und die json im backend verwaltet
//die meisten KOmnstanten können jetzt direkt in den Settings im Spiel geändert werden: auf der startseite  # drücken

//  !!!

export const GameConfig = {
    canvasBg: "#050513",
    canvasWidth: 800, //funktioniert noch nicht
    canvasHeight: 600, //funktioniert noch nicht 
    powerupChance: 0.4, //chance auf Powerup beim Zerstören einer Anomalie
    powerupTypeChance: 0.5, //chance, dass ein Powerup gut ist
    imagesToLoad : {
      ship: 'assets/picture/robot_ifm.png',
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
    // Reduce the half-width so collisions only register near the machine center.
      // Move collision area higher so collisions register earlier on screen
      machineCollisionYOffset: 150, // vertical offset from bottom where machine collision begins (was 150)
      machineCollisionHalfWidth: 600, // horizontal half-width of machine collision box
      machineVisualYOffset: 65,  // Visual offset for drawing the machine (pixels above bottom). Keep in sync with collision offset
    machineHP: 100, // Starting HP for the machine
    powerupTypesGood: [
      'IncreaseSpeed',
      'RepairMachine',
      'BonusPoints',
      'IncreaseWeapon',
      'Starman' //Kein Damage, Increase Speed und Bullet Speed erhöht, doppelte Punkte
    ],
    powerupTypesBad: [
      'DecreaseSpeed',
      'DamageMachine',
      'MinusPoints',
      'DecreaseWeapon',
    ],
    starmanActive: false,
    starmanActivePlayer2: false,
    starmanDuration: 10000,
    bulletSpeed: 8, //normal sind 8
    startSpeedAnomalies: 1,
    startSpeedPlayer: 6,
    powerUpTextDuration: 2000 ,
    popupTextDuration: 2000,
    playerDamageByAnomalieCollision: 10, //Schaden den der Spieler bei Kollision mit Anomalie nimmt
    playerDamageBlinkDuration: 60, //Dauer in ms wie lange der Spieler nach Schaden blinkt
    machineBlinkDuration: 60, //Dauer in ms wie lange die Maschine nach Schaden blinkt
    machineInvulnerableTimer: 30, //Dauer in ms wie lange die Maschine nach Schaden unverwundbar ist
    pointsPerLevel: 200,
    totalLives: 100,
    speedIncreasePerLevelAnomalies: 0.35, //multiplied by player level to increase anomaly speed
    schwierigkeitHPAnomalie: 0.12, //je höher der wert desto mehr HP haben die Anomalien - allgemein lässt sich hier die Schwierigkeit einstellen
    percentageBigAnomalie: 0.1, //Prozentsatz von Auftrittswahrscheinlichkeit einer "starken" Anomalien
    targetFps: 45, //Änderung der fps haben Auswirkungen auf die gesamte Spielgeschwindigkeit - am besten auf 45 lassen

    //Multiconfig:
    playerDamageByAnomalieCollisionMulti: 8, //Schaden den der Spieler bei Kollision mit Anomalie nimmt
    machineDamageAnomalieCollisionMulti: 4, //Prozentualer Wert der HP von Anomalie, die der Spieler an Schaden nimmt bei Kollision mit der Maschine
  };
  
 
  