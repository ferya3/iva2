import { describe, expect, it } from 'vitest';
import { createHarness, ofType, runToEnd, withModalities } from './helpers';

describe('visual presentation timing', () => {
  it('presents every stimulus within half a frame of its planned onset at 60 Hz', async () => {
    const h = createHarness();
    await runToEnd(h);
    const shown = ofType(h.sink.events, 'stimulus_presented');
    expect(shown).toHaveLength(20);
    for (const s of shown) {
      expect(s.presentation_status).toBe('on_time');
      expect(Math.abs(s.actual_time_ms - s.planned_time_ms)).toBeLessThanOrEqual(
        1000 / 60 / 2 + 0.5,
      );
    }
  });

  it('keeps visual duration within one frame of the protocol value', async () => {
    const h = createHarness();
    await runToEnd(h);
    const shown = ofType(h.sink.events, 'stimulus_presented');
    const cleared = ofType(h.sink.events, 'stimulus_cleared');
    expect(cleared).toHaveLength(shown.length);
    for (const s of shown) {
      const c = cleared.find((x) => x.trial_index === s.trial_index)!;
      // cleared is logged at the frame callback; the change shows one frame later.
      const visibleFor = c.timestamp_ms + 1000 / 60 - s.actual_time_ms;
      expect(Math.abs(visibleFor - 167)).toBeLessThanOrEqual(1000 / 60);
    }
  });

  it('also holds at 144 Hz', async () => {
    const h = createHarness(undefined, { hz: 144 });
    await runToEnd(h);
    for (const s of ofType(h.sink.events, 'stimulus_presented')) {
      expect(Math.abs(s.actual_time_ms - s.planned_time_ms)).toBeLessThanOrEqual(
        1000 / 144 / 2 + 0.5,
      );
    }
  });

  it('records frame drops and marks late onsets after a stall', async () => {
    const h = createHarness();
    // Stall 6 vsyncs shortly after the lead-in so the first onset is missed.
    h.display.stalls.set(28, 6);
    await runToEnd(h);
    const drops = ofType(h.sink.events, 'frame_drop');
    expect(drops).toHaveLength(1);
    expect(drops[0]!.dropped_frames).toBe(6);
    const statuses = ofType(h.sink.events, 'stimulus_presented').map((s) => s.presentation_status);
    expect(statuses[0]).toBe('late');
    expect(statuses.slice(1).every((s) => s === 'on_time')).toBe(true);
  });

  it('marks a stimulus dropped when its whole window is missed', async () => {
    const h = createHarness();
    h.display.stalls.set(28, 30); // 500 ms freeze
    const summary = await runToEnd(h);
    expect(ofType(h.sink.events, 'stimulus_presented')[0]!.presentation_status).toBe('dropped');
    expect(summary.trialsDropped).toBe(1);
  });
});

describe('audio scheduling', () => {
  it('hands sounds to the audio clock at their planned time', async () => {
    const h = createHarness(withModalities(['auditory']));
    await runToEnd(h);
    const shown = ofType(h.sink.events, 'stimulus_presented');
    expect(h.audio.scheduled).toHaveLength(20);
    for (const s of shown) {
      expect(s.frame_number).toBeNull();
      expect(s.actual_time_ms).toBe(s.planned_time_ms);
      expect(s.presentation_status).toBe('on_time');
    }
  });

  it('flags late audio when the port reports extra latency', async () => {
    const h = createHarness(withModalities(['auditory']), { audioLatency: 8 });
    await runToEnd(h);
    expect(
      ofType(h.sink.events, 'stimulus_presented').every((s) => s.presentation_status === 'late'),
    ).toBe(true);
  });
});
