import type { ResponseEvent, SessionEvent, StimulusPresentedEvent } from '@cognitest/shared-types';

export type Outcome = 'hit' | 'omission' | 'commission' | 'correct_rejection';

export interface ScoredTrial {
  stimulus: StimulusPresentedEvent;
  blockKey: string;
  practice: boolean;
  outcome: Outcome;
  /** First attributed response (valid or anticipatory), if any. */
  response: ResponseEvent | null;
  /** Reaction time of a hit; null otherwise. */
  rt: number | null;
  anticipatory: boolean;
  repeats: number;
  excluded: boolean;
}

/**
 * Joins stimuli with their attributed responses.
 * - hit: target + first response valid (≥ anticipation threshold)
 * - omission: target without a valid response (an anticipatory press does
 *   not count as detection)
 * - commission: non-target with any attributed first response
 * - correct rejection: non-target without response
 * Late responses (outside the window) never change the outcome.
 */
export function buildTrials(
  events: readonly SessionEvent[],
  practiceBlockKeys: readonly string[],
  excludeLateOnsets: boolean,
): ScoredTrial[] {
  const blockKeys = new Map<number, string>();
  const bySequence = new Map<number, ResponseEvent[]>();
  for (const e of events) {
    if (e.type === 'block_started') blockKeys.set(e.block_index, e.block_key);
    if (e.type === 'response' && e.stimulus_sequence !== null && e.validity !== 'late') {
      const list = bySequence.get(e.stimulus_sequence) ?? [];
      list.push(e);
      bySequence.set(e.stimulus_sequence, list);
    }
  }

  const trials: ScoredTrial[] = [];
  for (const e of events) {
    if (e.type !== 'stimulus_presented') continue;
    const blockKey = blockKeys.get(e.block_index) ?? `block-${e.block_index}`;
    const responses = bySequence.get(e.sequence) ?? [];
    const first = responses.find((r) => r.validity === 'valid' || r.validity === 'anticipatory') ?? null;
    const anticipatory = first?.validity === 'anticipatory';
    const responded = first !== null;
    const outcome: Outcome = e.is_target
      ? responded && !anticipatory
        ? 'hit'
        : 'omission'
      : responded
        ? 'commission'
        : 'correct_rejection';
    trials.push({
      stimulus: e,
      blockKey,
      practice: practiceBlockKeys.includes(blockKey),
      outcome,
      response: first,
      rt: outcome === 'hit' ? first!.reaction_time_ms : null,
      anticipatory,
      repeats: responses.filter((r) => r.validity === 'unmatched').length,
      excluded: e.presentation_status === 'dropped' || (excludeLateOnsets && e.presentation_status === 'late'),
    });
  }
  return trials;
}
