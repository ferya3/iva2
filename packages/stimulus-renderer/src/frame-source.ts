import type { FrameSource } from '@cognitest/assessment-engine';

/** requestAnimationFrame-backed frame source for browsers and Electron. */
export class AnimationFrameSource implements FrameSource {
  private handle: number | null = null;

  constructor(private readonly win: Pick<Window, 'requestAnimationFrame' | 'cancelAnimationFrame'> = window) {}

  request(callback: (t: number) => void): void {
    this.handle = this.win.requestAnimationFrame((t) => {
      this.handle = null;
      callback(t);
    });
  }

  cancel(): void {
    if (this.handle !== null) this.win.cancelAnimationFrame(this.handle);
    this.handle = null;
  }
}
