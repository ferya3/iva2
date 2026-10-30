import {
  contextTimeFor,
  performanceTimeFor,
  type AudioPort,
  type AuditoryStimulusSpec,
  type ClockPair,
  type SessionClock,
} from '@cognitest/assessment-engine';

type Ctx = Pick<
  AudioContext,
  'currentTime' | 'sampleRate' | 'baseLatency' | 'destination' | 'createBuffer' | 'createBufferSource' | 'resume' | 'close' | 'state'
> & {
  outputLatency?: number;
  getOutputTimestamp?: () => AudioTimestamp;
};

export interface WebAudioPortOptions {
  context: Ctx;
  /** Session clock; its `origin` maps session time to performance time. */
  clock: SessionClock & { origin: number };
  /** Resolves `assetKey` stimuli to encoded audio (e.g. from the local asset cache). */
  loadAsset?: (assetKey: string) => Promise<ArrayBuffer>;
  decode?: (data: ArrayBuffer) => Promise<AudioBuffer>;
  /** Raised-cosine ramp to avoid clicks at onset/offset. */
  rampMs?: number;
}

/**
 * Web Audio implementation of the engine's AudioPort.
 *
 * Sounds are pre-rendered to AudioBuffers and started with
 * AudioBufferSourceNode.start(when), which is sample-accurate on the audio
 * clock. The audio clock is mapped to the performance timeline through
 * getOutputTimestamp(); the reported output latency is subtracted so that
 * the *acoustic* onset, not the buffer hand-off, lands on the planned time.
 * Reported latencies are OS estimates — loopback measurement is still
 * required for validation.
 */
export class WebAudioPort implements AudioPort {
  private readonly buffers = new Map<string, AudioBuffer>();
  private readonly active = new Set<AudioBufferSourceNode>();

  constructor(private readonly o: WebAudioPortOptions) {}

  async prepare(stimuli: Record<string, AuditoryStimulusSpec>): Promise<void> {
    if (this.o.context.state === 'suspended') await this.o.context.resume();
    for (const [id, spec] of Object.entries(stimuli)) {
      this.buffers.set(id, await this.buildBuffer(spec));
    }
  }

  /** Output latency in ms (0 when the platform does not report it). */
  get outputLatencyMs(): number {
    const ctx = this.o.context;
    const out = typeof ctx.outputLatency === 'number' ? ctx.outputLatency : 0;
    return (out || ctx.baseLatency || 0) * 1000;
  }

  private clockPair(): ClockPair {
    const ts = this.o.context.getOutputTimestamp?.();
    if (ts?.contextTime !== undefined && ts.performanceTime !== undefined && ts.performanceTime > 0) {
      return { contextTime: ts.contextTime, performanceTime: ts.performanceTime };
    }
    // Fallback: assume currentTime corresponds to "now".
    return { contextTime: this.o.context.currentTime, performanceTime: this.o.clock.now() + this.o.clock.origin };
  }

  schedule(stimulusId: string, at: number): number {
    const buffer = this.buffers.get(stimulusId);
    if (!buffer) throw new Error(`audio stimulus ${stimulusId} was not prepared`);
    const ctx = this.o.context;
    const pair = this.clockPair();
    const latencyS = this.outputLatencyMs / 1000;
    const wanted = contextTimeFor(at + this.o.clock.origin, pair) - latencyS;
    const when = Math.max(wanted, ctx.currentTime);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.onended = () => this.active.delete(source);
    source.start(when);
    this.active.add(source);
    return performanceTimeFor(when + latencyS, pair) - this.o.clock.origin;
  }

  stopAll(): void {
    for (const s of this.active) {
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
    }
    this.active.clear();
  }

  private async buildBuffer(spec: AuditoryStimulusSpec): Promise<AudioBuffer> {
    if (spec.assetKey) {
      if (!this.o.loadAsset || !this.o.decode) throw new Error('asset stimuli need loadAsset and decode');
      return this.o.decode(await this.o.loadAsset(spec.assetKey));
    }
    const ctx = this.o.context;
    const samples = synthesizeTone(spec, ctx.sampleRate, this.o.rampMs ?? 5);
    const buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
    buffer.copyToChannel(samples, 0);
    return buffer;
  }
}

/** Pure sine synthesis with raised-cosine ramps; exported for testing. */
export function synthesizeTone(
  spec: Pick<AuditoryStimulusSpec, 'frequencyHz' | 'durationMs' | 'levelDb'>,
  sampleRate: number,
  rampMs = 5,
): Float32Array<ArrayBuffer> {
  if (spec.levelDb > 0) throw new RangeError('levelDb must be ≤ 0 dBFS');
  const n = Math.round((spec.durationMs / 1000) * sampleRate);
  const ramp = Math.min(Math.round((rampMs / 1000) * sampleRate), Math.floor(n / 2));
  const gain = 10 ** (spec.levelDb / 20);
  const out = new Float32Array(n);
  const w = (2 * Math.PI * spec.frequencyHz) / sampleRate;
  for (let i = 0; i < n; i++) {
    let env = 1;
    if (i < ramp) env = 0.5 * (1 - Math.cos((Math.PI * i) / ramp));
    else if (i >= n - ramp) env = 0.5 * (1 - Math.cos((Math.PI * (n - 1 - i)) / ramp));
    out[i] = gain * env * Math.sin(w * i);
  }
  return out;
}
