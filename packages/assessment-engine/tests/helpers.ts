import { EventRecorder, MemorySink, type EventSink } from '@cognitest/event-recorder';
import type { SessionEvent, StimulusPresentedEvent } from '@cognitest/shared-types';
import {
  AssessmentEngine,
  HeadlessAudioPort,
  HeadlessVisualPort,
  type EngineHooks,
  type ProtocolDefinition,
} from '../src';
import { ScriptedEnvironment, ScriptedInput, VirtualDisplay, flushMicrotasks } from '../src/testing';

export const SMALL_PROTOCOL: ProtocolDefinition = {
  key: 'test',
  version: '0.0.1',
  clinical: false,
  stimuli: {
    go: { modality: 'visual', shape: 'circle', color: '#0f0', sizePx: 100 },
    nogo: { modality: 'visual', shape: 'square', color: '#f00', sizePx: 100 },
    hi: { modality: 'auditory', frequencyHz: 1000, durationMs: 100, levelDb: -12 },
    lo: { modality: 'auditory', frequencyHz: 400, durationMs: 100, levelDb: -12 },
  },
  response: { keys: ['Space'], mouseButtons: ['left'] },
  timing: {
    leadInMs: 500,
    visualDurationMs: 167,
    responseWindowMs: 1000,
    anticipationMs: 100,
    soaMs: [1200, 1400],
    interBlockMs: 0,
    presentationLatencyFrames: 1,
    audioLookaheadMs: 100,
  },
  blocks: [
    {
      key: 'b0',
      practice: false,
      trials: 20,
      targetRatio: 0.5,
      modalities: ['visual'],
      targets: { visual: ['go'] },
      nonTargets: { visual: ['nogo'] },
      maxConsecutiveTargets: 3,
    },
  ],
};

export const withModalities = (modalities: Array<'visual' | 'auditory'>, trials = 20): ProtocolDefinition => ({
  ...SMALL_PROTOCOL,
  blocks: [
    {
      ...SMALL_PROTOCOL.blocks[0]!,
      trials,
      modalities,
      targets: { visual: ['go'], auditory: ['hi'] },
      nonTargets: { visual: ['nogo'], auditory: ['lo'] },
    },
  ],
});

export interface Harness {
  engine: AssessmentEngine;
  display: VirtualDisplay;
  input: ScriptedInput;
  env: ScriptedEnvironment;
  sink: MemorySink;
  recorder: EventRecorder;
  visual: HeadlessVisualPort;
  audio: HeadlessAudioPort;
}

export function createHarness(
  protocol: ProtocolDefinition = SMALL_PROTOCOL,
  opts: { seed?: number; hz?: number; audioLatency?: number; hooks?: EngineHooks; sinks?: EventSink[] } = {},
): Harness {
  const display = new VirtualDisplay(opts.hz ?? 60);
  const input = new ScriptedInput();
  const env = new ScriptedEnvironment();
  const sink = new MemorySink();
  const recorder = new EventRecorder({ clock: display.session, sinks: [sink, ...(opts.sinks ?? [])] });
  const visual = new HeadlessVisualPort();
  const audio = new HeadlessAudioPort(opts.audioLatency ?? 0);
  const engine = new AssessmentEngine({
    protocol,
    seed: opts.seed ?? 1234,
    clock: display.session,
    frames: display,
    visual,
    audio,
    input,
    environment: env,
    recorder,
    frameIntervalMs: display.interval,
    hooks: opts.hooks,
    wallClock: () => new Date('2026-10-30T08:00:00Z'),
  });
  return { engine, display, input, env, sink, recorder, visual, audio };
}

/**
 * Runs the engine to completion. `respond` is called for each presented
 * stimulus and may return a delay (ms after actual onset) for a key press.
 */
export async function runToEnd(
  h: Harness,
  respond: (ev: StimulusPresentedEvent) => number | number[] | null = () => null,
  onFrame?: (frame: number) => void,
) {
  await h.engine.prepare();
  const done = h.engine.run();
  const presses: number[] = [];
  let seen = 0;
  let frame = 0;
  for (let guard = 0; guard < 2_000_000; guard++) {
    if (h.display.hasPending) {
      const nextVsync = h.display.clock.now() + h.display.interval;
      presses.sort((a, b) => a - b);
      while (presses.length && presses[0]! <= nextVsync) {
        const at = presses.shift()!;
        h.display.advanceTo(Math.max(at, h.display.clock.now()));
        h.input.press(at);
      }
      h.display.step();
      onFrame?.(frame++);
      for (; seen < h.sink.events.length; seen++) {
        const ev = h.sink.events[seen]!;
        if (ev.type !== 'stimulus_presented') continue;
        const r = respond(ev);
        for (const d of r === null ? [] : Array.isArray(r) ? r : [r]) {
          presses.push(h.display.session.origin + ev.actual_time_ms + d);
        }
      }
    } else if (h.engine.state === 'running') {
      await flushMicrotasks();
    } else break;
  }
  return done;
}

export const ofType = <T extends SessionEvent['type']>(events: SessionEvent[], type: T) =>
  events.filter((e): e is Extract<SessionEvent, { type: T }> => e.type === type);
