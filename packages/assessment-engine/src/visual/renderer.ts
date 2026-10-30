import type { VisualPort } from '../ports';
import type { VisualStimulusSpec } from '../protocols/types';

/** No-op renderer for headless runs and tests; remembers what is shown. */
export class HeadlessVisualPort implements VisualPort {
  current: string | null = null;
  readonly history: Array<{ stimulusId: string | null }> = [];

  prepare(_stimuli: Record<string, VisualStimulusSpec>): void {}

  show(stimulusId: string): void {
    this.current = stimulusId;
    this.history.push({ stimulusId });
  }

  clear(): void {
    this.current = null;
    this.history.push({ stimulusId: null });
  }
}
