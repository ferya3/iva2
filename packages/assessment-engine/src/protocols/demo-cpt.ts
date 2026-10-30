import type { ProtocolDefinition } from './types';

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
export const DEMO_CPT_PROTOCOL: ProtocolDefinition = {
  key: 'demo-cpt',
  version: '1.1.0',
  clinical: false,
  stimuli: {
    'v-1': { modality: 'visual', shape: 'text', text: '۱', color: '#ffffff', sizePx: 240 },
    'v-2': { modality: 'visual', shape: 'text', text: '۲', color: '#ffffff', sizePx: 240 },
    'a-1': { modality: 'auditory', assetKey: 'fa/digit-1', durationMs: 400, levelDb: -3 },
    'a-2': { modality: 'auditory', assetKey: 'fa/digit-2', durationMs: 400, levelDb: -3 },
  },
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
    {
      key: 'practice',
      practice: true,
      trials: 16,
      targetRatio: 0.5,
      modalities: ['visual', 'auditory'],
      targets: { visual: ['v-1'], auditory: ['a-1'] },
      nonTargets: { visual: ['v-2'], auditory: ['a-2'] },
      maxConsecutiveTargets: 4,
      instructions: {
        fa: 'هر وقت عدد ۱ را دیدی یا شنیدی «یک»، زود کلید فاصله را بزن. اگر عدد ۲ دیدی یا شنیدی «دو»، هیچ کاری نکن. این بخش تمرینی است.',
        en: 'Press Space when you see 1 or hear "one". Do nothing for 2 or "two". This is a practice block.',
      },
    },
    ...[1, 2, 3, 4].map((n) => ({
      key: `main-${n}`,
      practice: false,
      trials: 50,
      targetRatio: n % 2 ? 0.8 : 0.2,
      modalities: ['visual', 'auditory'] as Array<'visual' | 'auditory'>,
      targets: { visual: ['v-1'], auditory: ['a-1'] },
      nonTargets: { visual: ['v-2'], auditory: ['a-2'] },
      maxConsecutiveTargets: n % 2 ? 0 : 3,
      instructions: {
        fa: `بخش ${['', 'اول', 'دوم', 'سوم', 'چهارم'][n]} از ۴. مثل قبل: برای ۱ کلید فاصله را بزن، برای ۲ نزن. تا جایی که می‌توانی سریع و درست جواب بده.`,
        en: `Part ${n} of 4. Same rules: press Space for 1, not for 2. Be quick and accurate.`,
      },
    })),
  ],
};
