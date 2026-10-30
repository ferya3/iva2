import type { AudioPort } from '../ports';
import type { AuditoryStimulusSpec } from '../protocols/types';

/** Audio port that "plays" instantly with a fixed latency; for tests. */
export class HeadlessAudioPort implements AudioPort {
  readonly scheduled: Array<{ stimulusId: string; at: number }> = [];

  constructor(private readonly latencyMs = 0) {}

  async prepare(_stimuli: Record<string, AuditoryStimulusSpec>): Promise<void> {}

  schedule(stimulusId: string, at: number): number {
    this.scheduled.push({ stimulusId, at });
    return at + this.latencyMs;
  }

  stopAll(): void {}
}
