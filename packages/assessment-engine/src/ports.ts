import type { InputType } from '@cognitest/shared-types';
import type { AuditoryStimulusSpec, VisualStimulusSpec } from './protocols/types';

/** Clock in the session timebase that can also convert platform timestamps. */
export interface SessionClock {
  now(): number;
  /** Converts a platform timestamp (rAF time, Event.timeStamp) to session time. */
  fromSource(sourceTime: number): number;
}

export interface FrameSource {
  /** Calls back once on the next frame with a platform timestamp. */
  request(callback: (sourceTime: number) => void): void;
  cancel(): void;
}

export interface VisualPort {
  prepare(stimuli: Record<string, VisualStimulusSpec>): void | Promise<void>;
  /** Must mutate the display synchronously inside the frame callback. */
  show(stimulusId: string): void;
  clear(): void;
}

export interface AudioPort {
  prepare(stimuli: Record<string, AuditoryStimulusSpec>): Promise<void>;
  /**
   * Schedules playback so that sound leaves the output at session time `at`.
   * Returns the best estimate of that output time in session time.
   */
  schedule(stimulusId: string, at: number): number;
  stopAll(): void;
}

export interface RawInput {
  input: InputType;
  key: string;
  /** Platform timestamp (Event.timeStamp). */
  sourceTime: number;
  repeat: boolean;
}

export interface InputSource {
  subscribe(handler: (input: RawInput) => void): () => void;
}

export type EnvironmentSignal = 'focus_lost' | 'focus_gained' | 'visibility_hidden' | 'visibility_visible';

export interface EnvironmentSource {
  subscribe(handler: (signal: EnvironmentSignal) => void): () => void;
}
