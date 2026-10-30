import type { InputSource, RawInput } from '../ports';

type PointerTarget = Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;

const BUTTONS: Record<number, string> = { 0: 'left', 1: 'middle', 2: 'right' };

/** pointerdown fires on press (not release) — the response moment. */
export class MouseInput implements InputSource {
  constructor(private readonly target: PointerTarget) {}

  subscribe(handler: (input: RawInput) => void): () => void {
    const listener = (e: Event) => {
      const p = e as PointerEvent;
      if (p.pointerType && p.pointerType !== 'mouse') return;
      handler({ input: 'mouse', key: BUTTONS[p.button] ?? `button${p.button}`, sourceTime: p.timeStamp, repeat: false });
    };
    this.target.addEventListener('pointerdown', listener, { capture: true });
    return () => this.target.removeEventListener('pointerdown', listener, { capture: true });
  }
}

/** Fans in several input sources. */
export class CompositeInput implements InputSource {
  constructor(private readonly sources: InputSource[]) {}

  subscribe(handler: (input: RawInput) => void): () => void {
    const offs = this.sources.map((s) => s.subscribe(handler));
    return () => offs.forEach((off) => off());
  }
}
