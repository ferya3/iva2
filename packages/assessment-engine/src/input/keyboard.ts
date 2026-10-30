import type { InputSource, RawInput } from '../ports';

type KeyTarget = Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;

/**
 * Listens on keydown in the capture phase so UI handlers cannot delay or
 * swallow responses. Uses KeyboardEvent.code (layout-independent: a Persian
 * keyboard layout yields the same "Space"/"KeyJ" codes as an English one).
 */
export class KeyboardInput implements InputSource {
  constructor(private readonly target: KeyTarget) {}

  subscribe(handler: (input: RawInput) => void): () => void {
    const listener = (e: Event) => {
      const k = e as KeyboardEvent;
      handler({ input: 'keyboard', key: k.code, sourceTime: k.timeStamp, repeat: k.repeat });
    };
    this.target.addEventListener('keydown', listener, { capture: true });
    return () => this.target.removeEventListener('keydown', listener, { capture: true });
  }
}
