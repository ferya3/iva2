import { describe, expect, it } from 'vitest';
import { createHarness, ofType, runToEnd } from './helpers';
import { flushMicrotasks } from '../src/testing';

describe('response attribution', () => {
  it('computes reaction time from the presentation estimate', async () => {
    const h = createHarness();
    await runToEnd(h, (s) => (s.is_target ? 412.5 : null));
    const responses = ofType(h.sink.events, 'response');
    expect(responses).toHaveLength(10);
    for (const r of responses) {
      expect(r.validity).toBe('valid');
      expect(r.reaction_time_ms).toBeCloseTo(412.5, 6);
      const stim = h.sink.events[r.stimulus_sequence! - 1]!;
      expect(stim).toMatchObject({ type: 'stimulus_presented', is_target: true });
    }
  });

  it('classifies anticipatory, repeated and late responses', async () => {
    const h = createHarness();
    let n = 0;
    await runToEnd(h, () => {
      n++;
      if (n === 1) return 40; // anticipatory
      if (n === 2) return [300, 450]; // valid + repeat
      if (n === 3) return 1100; // after the window, before next onset
      return null;
    });
    expect(ofType(h.sink.events, 'response').map((r) => r.validity)).toEqual([
      'anticipatory',
      'valid',
      'unmatched',
      'late',
    ]);
  });

  it('ignores keys outside the protocol and auto-repeat', async () => {
    const h = createHarness();
    await h.engine.prepare();
    const run = h.engine.run();
    for (let i = 0; i < 60; i++) h.display.step();
    h.input.press(h.display.clock.now(), 'KeyA');
    h.input.press(h.display.clock.now(), 'Space', true);
    h.engine.abort('test');
    await run;
    expect(ofType(h.sink.events, 'response')).toHaveLength(0);
  });

  it('does not log key presses made between blocks', async () => {
    const h = createHarness(undefined, {
      hooks: {
        beforeBlock: async () => {
          h.input.press(h.display.clock.now());
        },
      },
    });
    await runToEnd(h);
    expect(ofType(h.sink.events, 'response')).toHaveLength(0);
  });
});

describe('lifecycle', () => {
  it('requires prepare() before run()', async () => {
    const h = createHarness();
    await expect(h.engine.run()).rejects.toThrow(/Illegal transition/);
  });

  it('aborts cleanly and seals the record', async () => {
    const h = createHarness();
    await h.engine.prepare();
    const run = h.engine.run();
    for (let i = 0; i < 200; i++) h.display.step();
    h.engine.abort('participant_request');
    const summary = await run;
    expect(summary.state).toBe('aborted');
    expect(h.sink.events.at(-2)).toMatchObject({ type: 'marker', label: 'abort:participant_request' });
    expect(h.sink.events.at(-1)).toMatchObject({ type: 'session_ended', reason: 'aborted' });
    expect(h.visual.current).toBeNull();
    expect(h.recorder.isSealed).toBe(true);
  });

  it('can abort while waiting for block instructions', async () => {
    let release!: () => void;
    const h = createHarness(undefined, {
      hooks: { beforeBlock: () => new Promise<void>((r) => (release = r)) },
    });
    await h.engine.prepare();
    const run = h.engine.run();
    await flushMicrotasks();
    h.engine.abort('closed');
    release();
    expect((await run).state).toBe('aborted');
    expect(ofType(h.sink.events, 'block_started')).toHaveLength(0);
  });

  it('records focus and visibility interruptions', async () => {
    const h = createHarness();
    await runToEnd(h, () => null, (frame) => {
      if (frame === 100) h.env.emit('visibility_hidden');
      if (frame === 101) h.env.emit('visibility_visible');
    });
    expect(ofType(h.sink.events, 'visibility_hidden')).toHaveLength(1);
    expect(ofType(h.sink.events, 'visibility_visible')).toHaveLength(1);
  });

  it('fails preparation when audio is required but unavailable', async () => {
    const { AssessmentEngine } = await import('../src');
    const h = createHarness();
    const engine = new AssessmentEngine({
      protocol: (await import('./helpers')).withModalities(['auditory']),
      seed: 1,
      clock: h.display.session,
      frames: h.display,
      visual: h.visual,
      audio: null,
      input: h.input,
      recorder: h.recorder,
      frameIntervalMs: h.display.interval,
    });
    await expect(engine.prepare()).rejects.toThrow(/audio/);
    expect(engine.state).toBe('failed');
  });
});
