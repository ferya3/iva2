// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { DEMO_CPT_PROTOCOL, type VisualStimulusSpec } from '@cognitest/assessment-engine';
import { DomStimulusRenderer } from '../src';

const visualStimuli = () =>
  Object.fromEntries(
    Object.entries(DEMO_CPT_PROTOCOL.stimuli).filter(([, s]) => s.modality === 'visual'),
  ) as Record<string, VisualStimulusSpec>;

describe('DomStimulusRenderer', () => {
  it('pre-builds hidden nodes and toggles a single one', () => {
    const container = document.createElement('div');
    const r = new DomStimulusRenderer({ container });
    r.prepare(visualStimuli());
    const nodes = container.querySelectorAll<HTMLElement>('[data-stimulus]');
    expect(nodes).toHaveLength(2);
    expect([...nodes].every((n) => n.style.visibility === 'hidden')).toBe(true);

    r.show('v-target');
    expect(r.current).toBe('v-target');
    r.show('v-nontarget');
    const visible = [...nodes].filter((n) => n.style.visibility === 'visible');
    expect(visible.map((n) => n.dataset.stimulus)).toEqual(['v-nontarget']);

    r.clear();
    expect(r.current).toBeNull();
  });

  it('throws for an unprepared stimulus', () => {
    const r = new DomStimulusRenderer({ container: document.createElement('div') });
    expect(() => r.show('missing')).toThrow(/not prepared/);
  });
});
