import type { EnvironmentSignal, EnvironmentSource } from '@cognitest/assessment-engine';

/** Reports focus and visibility changes of the test window. */
export class DocumentEnvironment implements EnvironmentSource {
  constructor(
    private readonly doc: Document = document,
    private readonly win: Pick<Window, 'addEventListener' | 'removeEventListener'> = window,
  ) {}

  subscribe(handler: (signal: EnvironmentSignal) => void): () => void {
    const onVisibility = () => handler(this.doc.hidden ? 'visibility_hidden' : 'visibility_visible');
    const onBlur = () => handler('focus_lost');
    const onFocus = () => handler('focus_gained');
    this.doc.addEventListener('visibilitychange', onVisibility);
    this.win.addEventListener('blur', onBlur);
    this.win.addEventListener('focus', onFocus);
    return () => {
      this.doc.removeEventListener('visibilitychange', onVisibility);
      this.win.removeEventListener('blur', onBlur);
      this.win.removeEventListener('focus', onFocus);
    };
  }
}
