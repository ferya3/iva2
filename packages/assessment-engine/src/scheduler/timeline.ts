import type { Modality } from '@cognitest/shared-types';
import { createRng, shuffle } from '@cognitest/timing-core';
import type { BlockDefinition, ProtocolDefinition, Trial } from '../protocols/types';

/**
 * Builds the full, deterministic trial list for a protocol. Identical
 * (protocol, seed) pairs always yield identical timelines, which makes a
 * session reproducible from its session_started event alone.
 */
export function buildTimeline(protocol: ProtocolDefinition, seed: number): Trial[][] {
  const rng = createRng(seed);
  return protocol.blocks.map((block, blockIndex) => buildBlock(protocol, block, blockIndex, rng));
}

function buildBlock(
  protocol: ProtocolDefinition,
  block: BlockDefinition,
  blockIndex: number,
  rng: () => number,
): Trial[] {
  const targetCount = Math.round(block.trials * block.targetRatio);
  let flags = Array.from({ length: block.trials }, (_, i) => i < targetCount);
  // Rejection sampling for the run-length constraint (bounded attempts, then
  // a deterministic repair pass so construction can never loop forever).
  for (let attempt = 0; attempt < 1000; attempt++) {
    flags = shuffle(flags, rng);
    if (!block.maxConsecutiveTargets || longestRun(flags) <= block.maxConsecutiveTargets) break;
  }
  if (block.maxConsecutiveTargets) flags = repairRuns(flags, block.maxConsecutiveTargets);

  const pick = <T>(items: readonly T[]): T => items[Math.floor(rng() * items.length)]!;
  const { soaMs } = protocol.timing;
  let onset = 0;
  return flags.map((isTarget, index) => {
    const modality: Modality = pick(block.modalities);
    const pool = (isTarget ? block.targets : block.nonTargets)[modality] ?? [];
    const stimulusId = pick(pool);
    const spec = protocol.stimuli[stimulusId]!;
    const trial: Trial = {
      index,
      blockIndex,
      stimulusId,
      modality,
      isTarget,
      onsetMs: onset,
      durationMs: spec.modality === 'auditory' ? spec.durationMs : protocol.timing.visualDurationMs,
    };
    onset += Array.isArray(soaMs) ? soaMs[0] + Math.round(rng() * (soaMs[1] - soaMs[0])) : soaMs;
    return trial;
  });
}

function longestRun(flags: readonly boolean[]): number {
  let best = 0;
  let run = 0;
  for (const f of flags) {
    run = f ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

function repairRuns(flags: boolean[], max: number): boolean[] {
  const out = [...flags];
  let run = 0;
  for (let i = 0; i < out.length; i++) {
    run = out[i] ? run + 1 : 0;
    if (run > max) {
      const j = out.findIndex((f, k) => k > i && !f);
      if (j === -1) break;
      [out[i], out[j]] = [false, true];
      run = 0;
    }
  }
  return out;
}

export function blockDurationMs(protocol: ProtocolDefinition, trials: readonly Trial[]): number {
  const last = trials.at(-1);
  return last ? protocol.timing.leadInMs + last.onsetMs + protocol.timing.responseWindowMs : 0;
}
