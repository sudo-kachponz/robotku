import { describe, it, expect } from 'vitest';
import { OLED_ANIMS, AW, AH } from '../components/blockcoding/sim/oledAnimations';

describe('OLED animations', () => {
  for (const a of OLED_ANIMS) {
    it(`${a.id}: valid, non-empty, and actually moves`, () => {
      const f0 = a.frame(0);
      expect(f0.length).toBe(AW * AH); // right-sized bitmap for DISPLAY_BITMAP
      expect(/^[01]+$/.test(f0)).toBe(true);
      expect(f0.includes('1')).toBe(true); // something is drawn
      // some frame in the loop must differ from frame 0, else it's a static image
      const moves = Array.from({ length: a.frames }, (_, i) => a.frame(i)).some((f) => f !== f0);
      expect(moves).toBe(true);
    });
  }
});
