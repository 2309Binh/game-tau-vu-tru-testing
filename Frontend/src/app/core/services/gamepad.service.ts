import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface CursorMove {
  x: number;
  y: number;
}

@Injectable({
  providedIn: 'root',
})
export class GamepadService {
  get(index: number = 0): Gamepad | null {
    const pads = navigator.getGamepads
      ? navigator.getGamepads()
      : [];
  
    return pads && pads.length > index ? pads[index] : null;
  }
  logGamepads() {
    const pads = navigator.getGamepads();
    for (let i = 0; i < pads.length; i++) {
      const gamepad = pads[i];
      if (gamepad) {
        console.log(`Gamepad ${i}: ${gamepad.id}`);
        console.log('Axes:', gamepad.axes);
        console.log('Buttons:', gamepad.buttons.map(button => button.value));
      }
    }
  }
  private cursorMoveSubject1 = new BehaviorSubject<CursorMove>({ x: 0, y: 0 });
  cursorMove1$ = this.cursorMoveSubject1.asObservable();

  private cursorMoveSubject2 = new BehaviorSubject<CursorMove>({ x: 0, y: 0 });
  cursorMove2$ = this.cursorMoveSubject2.asObservable();

  private deadzone = 0.15;
  private speed = 8;

  constructor(private zone: NgZone) {
    this.zone.runOutsideAngular(() => this.loop());
  }

  private loop() {
    const update = () => {
      // Controller 1
      const pad1 = this.get(0);
      if (pad1) {
        const x1 = Math.abs(pad1.axes[0]) > this.deadzone ? pad1.axes[0] * this.speed : 0;
        const y1 = Math.abs(pad1.axes[1]) > this.deadzone ? pad1.axes[1] * this.speed : 0;
        this.cursorMoveSubject1.next({ x: x1, y: y1 });
        // Debug: show pad1 raw axes and computed cursor move
        try { console.debug('[GamepadService] pad1', { id: pad1.id, axes: pad1.axes.slice(0,4), buttons: pad1.buttons.map(b=>b.pressed), cursor: { x: x1, y: y1 } }); } catch(e) {}
      } else {
        this.cursorMoveSubject1.next({ x: 0, y: 0 });
      }

      // Controller 2
      const pad2 = this.get(1);
      if (pad2) {
        const x2 = Math.abs(pad2.axes[0]) > this.deadzone ? pad2.axes[0] * this.speed : 0;
        const y2 = Math.abs(pad2.axes[1]) > this.deadzone ? pad2.axes[1] * this.speed : 0;
        this.cursorMoveSubject2.next({ x: x2, y: y2 });
        // Debug: show pad2 raw axes and computed cursor move
        try { console.debug('[GamepadService] pad2', { id: pad2.id, axes: pad2.axes.slice(0,4), buttons: pad2.buttons.map(b=>b.pressed), cursor: { x: x2, y: y2 } }); } catch(e) {}
      } else {
        this.cursorMoveSubject2.next({ x: 0, y: 0 });
      }

      requestAnimationFrame(update);
    };
    update();
  }
}
