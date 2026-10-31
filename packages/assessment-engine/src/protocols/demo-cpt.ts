import type { BlockDefinition, ProtocolDefinition } from './types';

/**
 * Generic audio-visual Go/No-Go continuous performance task with the digits
 * 1 (respond) and 2 (withhold), shown as Persian numerals and spoken in
 * Persian — easy to tell apart for young children, unlike high/low tones.
 *
 * Engineering/demo protocol: NOT a clinical instrument and not a copy of any
 * commercial test's protocol, scales or norms. Norms and validity evidence
 * must come from a dedicated psychometric study before any clinical use.
 *
 * Spoken digits are bundled with the desktop player
 * (apps/desktop-player/src/assets/stimuli/fa/); replace them with studio
 * recordings for production — see the README next to them.
 */
const STIMULI: ProtocolDefinition['stimuli'] = {
  'v-1': { modality: 'visual', shape: 'text', text: '۱', color: '#ffffff', sizePx: 240 },
  'v-2': { modality: 'visual', shape: 'text', text: '۲', color: '#ffffff', sizePx: 240 },
  'a-1': { modality: 'auditory', assetKey: 'fa/digit-1', durationMs: 400, levelDb: -3 },
  'a-2': { modality: 'auditory', assetKey: 'fa/digit-2', durationMs: 400, levelDb: -3 },
};

const PART_NAMES = ['', 'اول', 'دوم', 'سوم', 'چهارم'];

function block(
  key: string,
  trials: number,
  targetRatio: number,
  maxConsecutiveTargets: number,
  instructions: BlockDefinition['instructions'],
  practice = false,
): BlockDefinition {
  return {
    key,
    practice,
    trials,
    targetRatio,
    modalities: ['visual', 'auditory'],
    targets: { visual: ['v-1'], auditory: ['a-1'] },
    nonTargets: { visual: ['v-2'], auditory: ['a-2'] },
    maxConsecutiveTargets,
    instructions,
  };
}

/**
 * Four main blocks alternate frequent targets (80 %, tests response
 * inhibition) and rare targets (20 %, tests sustained attention).
 */
function mainBlocks(
  trials: number,
  text: (n: number) => NonNullable<BlockDefinition['instructions']>,
): BlockDefinition[] {
  return [1, 2, 3, 4].map((n) =>
    block(`main-${n}`, trials, n % 2 ? 0.8 : 0.2, n % 2 ? 0 : 3, text(n)),
  );
}

/** Standard version: ages 9 and up (adolescents and adults). */
export const DEMO_CPT_PROTOCOL: ProtocolDefinition = {
  key: 'demo-cpt',
  version: '1.1.0',
  clinical: false,
  stimuli: STIMULI,
  response: { keys: ['Space'], mouseButtons: ['left'] },
  timing: {
    leadInMs: 1500,
    visualDurationMs: 200,
    responseWindowMs: 1400,
    anticipationMs: 150,
    soaMs: [1500, 2000],
    interBlockMs: 5000,
    presentationLatencyFrames: 1,
    audioLookaheadMs: 120,
  },
  blocks: [
    block(
      'practice',
      16,
      0.5,
      4,
      {
        fa: 'هر وقت عدد ۱ را دیدی یا شنیدی «یک»، زود کلید فاصله را بزن. اگر عدد ۲ دیدی یا شنیدی «دو»، هیچ کاری نکن. این بخش تمرینی است.',
        en: 'Press Space when you see 1 or hear "one". Do nothing for 2 or "two". This is a practice block.',
      },
      true,
    ),
    ...mainBlocks(50, (n) => ({
      fa: `بخش ${PART_NAMES[n]} از ۴. مثل قبل: برای ۱ کلید فاصله را بزن، برای ۲ نزن. تا جایی که می‌توانی سریع و درست جواب بده.`,
      en: `Part ${n} of 4. Same rules: press Space for 1, not for 2. Be quick and accurate.`,
    })),
  ],
};

/**
 * Child version: ages 6–8. Same task and stimuli, but easier to follow:
 * longer practice, digits stay on screen longer, more time to answer, fewer
 * trials per block (≈ 5.5 min instead of 7) and longer rests between blocks.
 * Scores are not comparable with the standard version; each version needs
 * its own norms.
 */
export const DEMO_CPT_CHILD_PROTOCOL: ProtocolDefinition = {
  ...DEMO_CPT_PROTOCOL,
  version: '1.1.0-child',
  stimuli: {
    ...STIMULI,
    'v-1': { modality: 'visual', shape: 'text', text: '۱', color: '#ffffff', sizePx: 280 },
    'v-2': { modality: 'visual', shape: 'text', text: '۲', color: '#ffffff', sizePx: 280 },
  },
  timing: {
    ...DEMO_CPT_PROTOCOL.timing,
    leadInMs: 2000,
    visualDurationMs: 300,
    responseWindowMs: 1700,
    soaMs: [1800, 2300],
    interBlockMs: 8000,
  },
  blocks: [
    block(
      'practice',
      20,
      0.5,
      3,
      {
        fa: 'بازی اعداد! هر وقت ۱ را دیدی یا شنیدی «یک»، کلید بزرگ فاصله را بزن. اگر ۲ دیدی یا شنیدی «دو»، دستت را نگه دار و نزن. اول با هم تمرین می‌کنیم.',
        en: 'Number game! Press the big Space key for 1 or "one". Hold still for 2 or "two". Let\'s practise first.',
      },
      true,
    ),
    ...mainBlocks(30, (n) => ({
      fa: `آفرین! بخش ${PART_NAMES[n]} از ۴. یادت باشد: ۱ ← بزن، ۲ ← نزن.`,
      en: `Well done! Part ${n} of 4. Remember: 1 → press, 2 → don't press.`,
    })),
  ],
};
