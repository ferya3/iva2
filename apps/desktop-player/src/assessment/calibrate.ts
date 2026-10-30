import {
  analyzeInputLatency,
  describeAudioContext,
  evaluateCalibration,
  measureDisplay,
  type CalibrationResult,
  type CalibrationThresholds,
  type InputSample,
} from '@cognitest/calibration';

export async function measureDisplayTiming(durationMs = 3000) {
  return measureDisplay((cb) => requestAnimationFrame(cb), durationMs);
}

/** Collects `count` Space presses and their dispatch latency. */
export function collectKeyPresses(count: number, onPress: (n: number) => void): Promise<InputSample[]> {
  return new Promise((resolve) => {
    const samples: InputSample[] = [];
    const handler = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return;
      e.preventDefault();
      samples.push({ eventTime: e.timeStamp, handlerTime: performance.now() });
      onPress(samples.length);
      if (samples.length >= count) {
        window.removeEventListener('keydown', handler, { capture: true });
        resolve(samples);
      }
    };
    window.addEventListener('keydown', handler, { capture: true });
  });
}

/** Plays a short reference tone and reports the audio stack's latencies. */
export async function probeAudio(): Promise<{ ctx: AudioContext | null; info: ReturnType<typeof describeAudioContext> }> {
  try {
    const ctx = new AudioContext({ latencyHint: 'interactive' });
    await ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 1000;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.01);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.45);
    // outputLatency is only populated once audio is flowing.
    await new Promise((r) => setTimeout(r, 500));
    return { ctx, info: describeAudioContext(ctx) };
  } catch {
    return { ctx: null, info: describeAudioContext(null) };
  }
}

export function evaluate(
  display: Awaited<ReturnType<typeof measureDisplayTiming>>,
  input: InputSample[],
  audio: ReturnType<typeof describeAudioContext>,
  heard: boolean,
  thresholds: CalibrationThresholds,
): CalibrationResult {
  const result = evaluateCalibration(display, analyzeInputLatency(input), audio, thresholds);
  if (thresholds.requireAudio && !heard) {
    return { ...result, verdict: 'fail', reasons: [{ code: 'audio.not_heard', message: 'participant did not hear the reference tone' }, ...result.reasons] };
  }
  return result;
}
