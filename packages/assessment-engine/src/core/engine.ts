import type { ResponseValidity } from '@cognitest/shared-types';
import type { EventRecorder } from '@cognitest/event-recorder';
import type { Summary } from '@cognitest/timing-core';
import { createLifecycle, type EngineState } from './lifecycle';
import type {
  AudioPort,
  EnvironmentSource,
  FrameSource,
  InputSource,
  RawInput,
  SessionClock,
  VisualPort,
} from '../ports';
import {
  assertValidProtocol,
  type AuditoryStimulusSpec,
  type BlockDefinition,
  type ProtocolDefinition,
  type Trial,
  type VisualStimulusSpec,
} from '../protocols/types';
import { buildTimeline } from '../scheduler/timeline';
import { BlockScheduler, type TrialRuntime } from '../scheduler/scheduler';
import { FrameMonitor } from '../visual/frame-monitor';
import { LatencyMonitor } from '../timing/latency-monitor';

/** 1.1.0: recorded (asset) auditory stimuli. */
export const ENGINE_VERSION = '1.1.0';

export interface EngineProgress {
  blockIndex: number;
  blockCount: number;
  trialIndex: number;
  trialCount: number;
}

export interface EngineHooks {
  /** Show instructions and resolve when the participant is ready. */
  beforeBlock?(block: BlockDefinition, index: number): Promise<void>;
  onProgress?(progress: EngineProgress): void;
}

export interface EngineOptions {
  protocol: ProtocolDefinition;
  seed: number;
  clock: SessionClock;
  frames: FrameSource;
  visual: VisualPort;
  audio: AudioPort | null;
  input: InputSource;
  environment?: EnvironmentSource;
  recorder: EventRecorder;
  /** Measured during calibration (1000 / refresh rate). */
  frameIntervalMs: number;
  hooks?: EngineHooks;
  wallClock?: () => Date;
}

export interface EngineSummary {
  state: EngineState;
  trialsPresented: number;
  trialsDropped: number;
  responses: number;
  droppedFrames: number;
  droppedFrameRatio: number;
  dispatchLatency: Summary;
  lastSequence: number;
}

export class AssessmentEngine {
  private readonly lifecycle = createLifecycle();
  private readonly timeline: Trial[][];
  private readonly monitor: FrameMonitor;
  private readonly latency = new LatencyMonitor();
  private scheduler: BlockScheduler | null = null;
  private abortReason: string | null = null;
  private wakeBlock: (() => void) | null = null;
  private presented = 0;
  private dropped = 0;
  private responses = 0;

  constructor(private readonly o: EngineOptions) {
    assertValidProtocol(o.protocol);
    this.timeline = buildTimeline(o.protocol, o.seed);
    this.monitor = new FrameMonitor(o.frameIntervalMs);
  }

  get state(): EngineState {
    return this.lifecycle.state;
  }

  get trials(): readonly (readonly Trial[])[] {
    return this.timeline;
  }

  onStateChange(listener: (to: EngineState, from: EngineState) => void): () => void {
    return this.lifecycle.onChange(listener);
  }

  /** Pre-renders visual stimuli and decodes audio before the clock starts. */
  async prepare(): Promise<void> {
    this.lifecycle.transition('preparing');
    try {
      const visual: Record<string, VisualStimulusSpec> = {};
      const audio: Record<string, AuditoryStimulusSpec> = {};
      for (const [id, spec] of Object.entries(this.o.protocol.stimuli)) {
        if (spec.modality === 'visual') visual[id] = spec;
        else audio[id] = spec;
      }
      await this.o.visual.prepare(visual);
      if (Object.keys(audio).length) {
        if (!this.o.audio) throw new Error('protocol requires audio output');
        await this.o.audio.prepare(audio);
      }
      this.lifecycle.transition('ready');
    } catch (error) {
      this.lifecycle.transition('failed');
      throw error;
    }
  }

  async run(): Promise<EngineSummary> {
    this.lifecycle.transition('running');
    const { recorder, protocol } = this.o;
    const offInput = this.o.input.subscribe((raw) => this.onInput(raw));
    const offEnv = this.o.environment?.subscribe((signal) => recorder.record({ type: signal }));
    recorder.record({
      type: 'session_started',
      engine_version: ENGINE_VERSION,
      protocol_key: protocol.key,
      protocol_version: protocol.version,
      seed: this.o.seed,
      wall_clock_iso: (this.o.wallClock?.() ?? new Date()).toISOString(),
    });

    try {
      for (let b = 0; b < protocol.blocks.length && !this.abortReason; b++) {
        await this.o.hooks?.beforeBlock?.(protocol.blocks[b]!, b);
        if (this.abortReason) break;
        await this.runBlock(b);
      }
    } catch (error) {
      this.scheduler?.halt();
      this.finish('aborted', offInput, offEnv);
      this.lifecycle.transition('failed');
      throw error;
    }

    const aborted = this.abortReason !== null;
    this.finish(aborted ? 'aborted' : 'completed', offInput, offEnv);
    this.lifecycle.transition(aborted ? 'aborted' : 'completed');
    return this.summary();
  }

  /** Ends the session early; raw data recorded so far is kept. */
  abort(reason: string): void {
    if (this.lifecycle.state === 'ready') {
      this.abortReason = reason;
      this.lifecycle.transition('aborted');
      return;
    }
    if (this.lifecycle.state !== 'running' || this.abortReason) return;
    this.abortReason = reason;
    this.o.recorder.record({ type: 'marker', label: `abort:${reason}`.slice(0, 128) });
    this.scheduler?.halt();
    this.o.frames.cancel();
    this.wakeBlock?.();
  }

  summary(): EngineSummary {
    return {
      state: this.lifecycle.state,
      trialsPresented: this.presented,
      trialsDropped: this.dropped,
      responses: this.responses,
      droppedFrames: this.monitor.droppedFrames,
      droppedFrameRatio: this.monitor.droppedRatio,
      dispatchLatency: this.latency.summary(),
      lastSequence: this.o.recorder.lastSequence,
    };
  }

  private finish(reason: 'completed' | 'aborted', offInput: () => void, offEnv?: () => void): void {
    offInput();
    offEnv?.();
    this.o.frames.cancel();
    if (!this.o.recorder.isSealed) {
      this.o.recorder.record({ type: 'session_ended', reason });
      this.o.recorder.seal();
    }
  }

  private runBlock(index: number): Promise<void> {
    const { recorder, protocol, clock, frames } = this.o;
    const trials = this.timeline[index]!;
    const total = trials.length;
    recorder.record({
      type: 'block_started',
      block_index: index,
      block_key: protocol.blocks[index]!.key,
    });
    this.monitor.resume();

    const scheduler = new BlockScheduler(protocol, trials, this.o.visual, this.o.audio, {
      presented: (rt, frameNumber) => {
        this.presented++;
        if (rt.status === 'dropped') this.dropped++;
        this.o.hooks?.onProgress?.({
          blockIndex: index,
          blockCount: protocol.blocks.length,
          trialIndex: rt.trial.index,
          trialCount: total,
        });
        return recorder.record({
          type: 'stimulus_presented',
          trial_index: rt.trial.index,
          block_index: index,
          stimulus_id: rt.trial.stimulusId,
          modality: rt.trial.modality,
          is_target: rt.trial.isTarget,
          planned_time_ms: rt.plannedAt,
          actual_time_ms: rt.actualAt!,
          frame_number: frameNumber,
          presentation_status: rt.status!,
        }).sequence;
      },
      cleared: (rt) => {
        recorder.record({ type: 'stimulus_cleared', trial_index: rt.trial.index });
      },
    });
    this.scheduler = scheduler;

    return new Promise<void>((resolve, reject) => {
      const done = () => {
        this.wakeBlock = null;
        if (this.scheduler === scheduler) this.scheduler = null;
        if (!this.abortReason) recorder.record({ type: 'block_ended', block_index: index });
        resolve();
      };
      this.wakeBlock = done;
      const onFrame = (sourceTime: number) => {
        if (this.abortReason) return;
        try {
          const tick = this.monitor.tick(clock.fromSource(sourceTime));
          if (tick.droppedFrames > 0 && tick.interval !== null) {
            recorder.record({
              type: 'frame_drop',
              expected_interval_ms: this.monitor.expectedInterval,
              observed_interval_ms: tick.interval,
              dropped_frames: tick.droppedFrames,
            });
          }
          scheduler.onFrame(tick, this.monitor.expectedInterval);
          if (scheduler.done) done();
          else frames.request(onFrame);
        } catch (error) {
          this.wakeBlock = null;
          reject(error);
        }
      };
      frames.request(onFrame);
    });
  }

  private onInput(raw: RawInput): void {
    const handlerTime = this.o.clock.now();
    const scheduler = this.scheduler;
    if (!scheduler?.started || raw.repeat || this.abortReason) return;
    const { response, timing } = this.o.protocol;
    const accepted =
      raw.input === 'keyboard'
        ? response.keys.includes(raw.key)
        : (response.mouseButtons as string[]).includes(raw.key);
    if (!accepted) return;

    const received = this.o.clock.fromSource(raw.sourceTime);
    this.latency.record(received, handlerTime);
    const rt: TrialRuntime | null = scheduler.latestPresentedBefore(received);

    let validity: ResponseValidity = 'unmatched';
    let reaction: number | null = null;
    if (rt) {
      reaction = received - rt.actualAt!;
      if (reaction > timing.responseWindowMs) validity = 'late';
      else if (rt.responded) validity = 'unmatched';
      else {
        rt.responded = true;
        validity = reaction < timing.anticipationMs ? 'anticipatory' : 'valid';
      }
    }
    this.responses++;
    this.o.recorder.record({
      type: 'response',
      received_time_ms: received,
      input: raw.input,
      key: raw.key,
      stimulus_sequence: rt?.sequence ?? null,
      reaction_time_ms: reaction,
      validity,
    });
  }
}
