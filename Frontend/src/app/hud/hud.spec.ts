import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HudComponent} from './hud';

describe('Hud', () => {
  let component: HudComponent;
  let fixture: ComponentFixture<HudComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HudComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HudComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
