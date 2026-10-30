import {
  AssessmentEngine,
  CompositeInput,
  KeyboardInput,
  MouseInput,
  createSessionClock,
  type BlockDefinition,
  type EngineProgress,
  type EngineSummary,
  type ProtocolDefinition,
} from '@cognitest/assessment-engine';
import { WebAudioPort } from '@cognitest/audio-engine';
import { EventRecorder } from '@cognitest/event-recorder';
import {
  AnimationFrameSource,
  DocumentEnvironment,
  DomStimulusRenderer,
} from '@cognitest/stimulus-renderer';
import { IpcOutboxSink } from './ipc-sink';
import { loadBundledAsset } from './stimulus-assets';

export interface RunOptions {
  protocol: ProtocolDefinition;
  seed: number;
  refreshRateHz: number;
  container: HTMLElement;
  record: (events: import('@cognitest/shared-types').SessionEvent[]) => void;
  beforeBlock: (block: BlockDefinition, index: number) => Promise<void>;
  onProgress: (p: EngineProgress) => void;
}

export interface RunHandle {
  done: Promise<{ summary: EngineSummary; lastSequence: number }>;
  abort(reason: string): void;
}

/** Wires the platform adapters into the assessment engine and runs it. */
export function runSession(o: RunOptions): RunHandle {
  const clock = createSessionClock();
  const sink = new IpcOutboxSink(o.record);
  const recorder = new EventRecorder({ clock, sinks: [sink] });
  const audioContext = new AudioContext({ latencyHint: 'interactive' });
  const engine = new AssessmentEngine({
    protocol: o.protocol,
    seed: o.seed,
    clock,
    frames: new AnimationFrameSource(window),
    visual: new DomStimulusRenderer({ container: o.container }),
    audio: new WebAudioPort({
      context: audioContext,
      clock,
      loadAsset: loadBundledAsset,
      decode: (data) => audioContext.decodeAudioData(data),
    }),
    input: new CompositeInput([new KeyboardInput(window), new MouseInput(window)]),
    environment: new DocumentEnvironment(document, window),
    recorder,
    frameIntervalMs: 1000 / o.refreshRateHz,
    hooks: { beforeBlock: o.beforeBlock, onProgress: o.onProgress },
  });

  const done = (async () => {
    try {
      await engine.prepare();
      const summary = await engine.run();
      return { summary, lastSequence: recorder.lastSequence };
    } finally {
      sink.flush();
      void audioContext.close();
    }
  })();

  return { done, abort: (reason) => engine.abort(reason) };
}
