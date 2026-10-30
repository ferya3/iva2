import type { ProtocolDefinition } from './types';

/**
 * Generic audio-visual Go/No-Go continuous performance task used for
 * engineering, timing validation and demos. It is NOT a clinical instrument
 * and does not reproduce any proprietary test; norms and validity evidence
 * must come from a dedicated psychometric study before any clinical use.
 */
export const DEMO_CPT_PROTOCOL: ProtocolDefinition = {
  key: 'demo-cpt',
  version: '1.0.0',
  clinical: false,
  stimuli: {
    'v-target': { modality: 'visual', shape: 'circle', color: '#22c55e', sizePx: 160 },
    'v-nontarget': { modality: 'visual', shape: 'square', color: '#ef4444', sizePx: 150 },
    'a-target': { modality: 'auditory', frequencyHz: 1000, durationMs: 150, levelDb: -12 },
    'a-nontarget': { modality: 'auditory', frequencyHz: 440, durationMs: 150, levelDb: -12 },
  },
  response: { keys: ['Space'], mouseButtons: ['left'] },
  timing: {
    leadInMs: 1500,
    visualDurationMs: 167,
    responseWindowMs: 1300,
    anticipationMs: 100,
    soaMs: [1400, 1800],
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
      targets: { visual: ['v-target'], auditory: ['a-target'] },
      nonTargets: { visual: ['v-nontarget'], auditory: ['a-nontarget'] },
      maxConsecutiveTargets: 4,
      instructions: {
        fa: 'هر بار دایره سبز دیدید یا صدای زیر (بلند) شنیدید، کلید فاصله را فشار دهید. برای مربع قرمز یا صدای بم کاری نکنید. این مرحله تمرینی است.',
        en: 'Press Space for the green circle or the high tone. Do nothing for the red square or the low tone. This is a practice block.',
      },
    },
    ...[1, 2, 3, 4].map((n) => ({
      key: `main-${n}`,
      practice: false,
      trials: 50,
      targetRatio: n % 2 ? 0.8 : 0.2,
      modalities: ['visual', 'auditory'] as Array<'visual' | 'auditory'>,
      targets: { visual: ['v-target'], auditory: ['a-target'] },
      nonTargets: { visual: ['v-nontarget'], auditory: ['a-nontarget'] },
      maxConsecutiveTargets: n % 2 ? 0 : 3,
      instructions: {
        fa: `بخش ${n} از ۴. با همان قوانین ادامه دهید. تا حد امکان سریع و دقیق پاسخ دهید.`,
        en: `Part ${n} of 4. Same rules. Respond as quickly and accurately as you can.`,
      },
    })),
  ],
};
