import type { SessionEvent } from '@cognitest/shared-types';
import type { QualityFlag, QualityRules } from './types';
import type { ScoredTrial } from './trials';

const severity = (value: number, rule: { warn: number; critical: number }) =>
  value >= rule.critical ? 'critical' : value >= rule.warn ? 'warning' : null;

/**
 * Run-quality control. Every check compares against an explicit, versioned
 * threshold; a single frame drop never invalidates a session by itself —
 * only rates that exceed the protocol's acceptance criteria do.
 */
export function assessQuality(
  events: readonly SessionEvent[],
  trials: readonly ScoredTrial[],
  rules: QualityRules,
): QualityFlag[] {
  const flags: QualityFlag[] = [];
  const add = (
    code: string,
    sev: QualityFlag['severity'] | null,
    message: string,
    value?: number,
    threshold?: number,
  ) => {
    if (sev) flags.push({ code, severity: sev, message, value, threshold });
  };

  // --- Structural integrity (always critical) -------------------------------
  for (let i = 0; i < events.length; i++) {
    if (events[i]!.sequence !== i + 1) {
      add('integrity.sequence_gap', 'critical', `event stream has a gap at position ${i + 1}`, events[i]!.sequence, i + 1);
      break;
    }
  }
  for (let i = 1; i < events.length; i++) {
    if (events[i]!.timestamp_ms < events[i - 1]!.timestamp_ms) {
      add('integrity.order', 'critical', `timestamps decrease at sequence ${events[i]!.sequence}`);
      break;
    }
  }
  if (events[0]?.type !== 'session_started') add('integrity.no_start', 'critical', 'session_started is missing');
  const end = events.at(-1);
  if (end?.type !== 'session_ended') add('integrity.no_end', 'critical', 'session_ended is missing (incomplete upload?)');
  else if (end.reason === 'aborted') add('run.aborted', 'critical', 'the session was aborted before completion');

  // --- Presentation timing ---------------------------------------------------
  const scored = trials.filter((t) => !t.practice);
  if (scored.length) {
    const late = scored.filter((t) => t.stimulus.presentation_status === 'late').length / scored.length;
    const rLate = rules.lateOnsetRatio;
    add('timing.late_onsets', severity(late, rLate), `${(late * 100).toFixed(1)}% of stimuli started late`, late, rLate.warn);
    const dropped = scored.filter((t) => t.stimulus.presentation_status === 'dropped').length / scored.length;
    const rDrop = rules.droppedStimulusRatio;
    add('timing.dropped_stimuli', severity(dropped, rDrop), `${(dropped * 100).toFixed(1)}% of stimuli were not presented`, dropped, rDrop.warn);
  } else {
    add('run.no_trials', 'critical', 'no scored trials were presented');
  }

  const durationMin = Math.max((end?.timestamp_ms ?? 0) / 60_000, 1 / 60);
  const frameDrops = events.filter((e) => e.type === 'frame_drop').length / durationMin;
  add(
    'timing.frame_drops',
    severity(frameDrops, rules.frameDropEventsPerMinute),
    `${frameDrops.toFixed(1)} frame-drop episodes per minute`,
    frameDrops,
    rules.frameDropEventsPerMinute.warn,
  );

  // --- Environment interruptions --------------------------------------------
  let hiddenSince: number | null = null;
  let hidden = 0;
  for (const e of events) {
    if (e.type === 'visibility_hidden') hiddenSince ??= e.timestamp_ms;
    if (e.type === 'visibility_visible' && hiddenSince !== null) {
      hidden += e.timestamp_ms - hiddenSince;
      hiddenSince = null;
    }
  }
  if (hiddenSince !== null) hidden += (end?.timestamp_ms ?? hiddenSince) - hiddenSince;
  add('environment.hidden', severity(hidden, rules.hiddenTimeMs), `test window was hidden for ${Math.round(hidden)} ms`, hidden, rules.hiddenTimeMs.warn);

  const focus = events.filter((e) => e.type === 'focus_lost').length;
  add('environment.focus_lost', severity(focus, rules.focusLossCount), `window lost focus ${focus} time(s)`, focus, rules.focusLossCount.warn);

  const audio = events.filter((e) => e.type === 'audio_error').length;
  add('audio.errors', severity(audio, rules.audioErrors), `${audio} audio error(s) reported`, audio, rules.audioErrors.warn);

  // --- Engagement ------------------------------------------------------------
  const targets = scored.filter((t) => t.stimulus.is_target && !t.excluded);
  if (targets.length) {
    const om = targets.filter((t) => t.outcome === 'omission').length / targets.length;
    add('engagement.omissions', severity(om, rules.omissionRate), `omission rate ${(om * 100).toFixed(1)}% — check engagement/understanding`, om, rules.omissionRate.warn);
  }

  return flags;
}
