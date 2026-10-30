/** Hard limits shared by the player (batch builder) and the API (FormRequest). */
export const EVENT_BATCH_LIMITS = {
  maxEvents: 500,
  /** Sessions are capped at 4h; timestamps beyond this are rejected. */
  maxTimestampMs: 4 * 60 * 60 * 1000,
  maxStringLength: 128,
} as const;
