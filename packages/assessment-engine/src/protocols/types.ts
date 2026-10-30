import type { Modality } from '@cognitest/shared-types';

export interface VisualStimulusSpec {
  modality: 'visual';
  shape: 'circle' | 'square' | 'triangle' | 'diamond' | 'text';
  color: string;
  sizePx: number;
  text?: string;
}

export interface AuditoryStimulusSpec {
  modality: 'auditory';
  /** Synthesised tone frequency; required unless `assetKey` is given. */
  frequencyHz?: number;
  /** Length of the sound (for a recording: the trimmed clip length). */
  durationMs: number;
  /** Peak gain in dBFS (≤ 0); applied to recordings too. */
  levelDb: number;
  /**
   * Recorded sound bundled with the player (e.g. a spoken word). Recordings
   * must start without leading silence: their first sample is the onset.
   */
  assetKey?: string;
}

export type StimulusSpec = VisualStimulusSpec | AuditoryStimulusSpec;

export interface BlockDefinition {
  key: string;
  practice: boolean;
  trials: number;
  /** Proportion of target trials, 0–1. */
  targetRatio: number;
  modalities: Modality[];
  targets: Partial<Record<Modality, string[]>>;
  nonTargets: Partial<Record<Modality, string[]>>;
  /** Shuffle constraint; 0 disables. */
  maxConsecutiveTargets: number;
  /** Persian/English instruction text shown before the block. */
  instructions?: { fa: string; en?: string };
}

export interface ProtocolDefinition {
  key: string;
  version: string;
  /** False for demo/research protocols that must never be used diagnostically. */
  clinical: boolean;
  stimuli: Record<string, StimulusSpec>;
  response: {
    keys: string[];
    mouseButtons: Array<'left' | 'right'>;
  };
  timing: {
    leadInMs: number;
    visualDurationMs: number;
    responseWindowMs: number;
    /** Responses faster than this are flagged anticipatory. */
    anticipationMs: number;
    /** Stimulus-onset asynchrony; [min, max] draws uniformly per trial. */
    soaMs: number | [number, number];
    interBlockMs: number;
    /**
     * Frames between the rAF callback that mutates the DOM and the vsync that
     * shows it. Must be confirmed by photodiode measurement per platform.
     */
    presentationLatencyFrames: number;
    /** How far ahead audio is handed to the audio clock. */
    audioLookaheadMs: number;
  };
  blocks: BlockDefinition[];
}

export interface Trial {
  index: number;
  blockIndex: number;
  stimulusId: string;
  modality: Modality;
  isTarget: boolean;
  /** Onset relative to the block start (after lead-in), ms. */
  onsetMs: number;
  durationMs: number;
}

export class ProtocolError extends Error {}

export function assertValidProtocol(p: ProtocolDefinition): void {
  const fail = (msg: string) => {
    throw new ProtocolError(`${p.key}@${p.version}: ${msg}`);
  };
  if (!p.blocks.length) fail('no blocks');
  if (!p.response.keys.length && !p.response.mouseButtons.length) fail('no response inputs');
  const { timing } = p;
  const minSoa = Array.isArray(timing.soaMs) ? timing.soaMs[0] : timing.soaMs;
  if (Array.isArray(timing.soaMs) && timing.soaMs[0] > timing.soaMs[1]) fail('soa min > max');
  if (timing.responseWindowMs > minSoa) fail('response window must not exceed the minimum SOA');
  if (timing.visualDurationMs >= minSoa) fail('visual duration must be shorter than the SOA');
  if (timing.anticipationMs < 0 || timing.anticipationMs >= timing.responseWindowMs)
    fail('bad anticipation');
  p.blocks.forEach((b, i) => {
    if (b.trials < 1) fail(`block ${i} has no trials`);
    if (b.targetRatio < 0 || b.targetRatio > 1) fail(`block ${i} target ratio out of range`);
    for (const m of b.modalities) {
      const ids = [...(b.targets[m] ?? []), ...(b.nonTargets[m] ?? [])];
      if (!(b.targets[m] ?? []).length && b.targetRatio > 0) fail(`block ${i} has no ${m} targets`);
      if (!(b.nonTargets[m] ?? []).length && b.targetRatio < 1)
        fail(`block ${i} has no ${m} non-targets`);
      for (const id of ids) {
        const spec = p.stimuli[id];
        if (!spec) fail(`unknown stimulus ${id}`);
        else if (spec.modality !== m) fail(`stimulus ${id} is not ${m}`);
        else if (spec.modality === 'auditory' && !spec.assetKey && !spec.frequencyHz) {
          fail(`stimulus ${id} needs frequencyHz or assetKey`);
        }
      }
    }
  });
}
