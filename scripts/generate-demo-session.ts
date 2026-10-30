/**
 * Generates a realistic raw event stream by running the real engine against
 * a virtual 60 Hz display and a simulated participant (RT ~ N(420, 60) ms,
 * 8% omissions, 12% commissions). Used by API tests and the demo seeder.
 *
 *   pnpm tsx scripts/generate-demo-session.ts > packages/scoring-engine/fixtures/demo-session.events.json
 */
import { DEMO_CPT_PROTOCOL } from '@cognitest/assessment-engine';
import { createRng } from '@cognitest/timing-core';
import { createHarness, runToEnd } from '../packages/assessment-engine/tests/helpers';

const rng = createRng(20261030);
const normal = () => {
  const u = 1 - rng();
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

const h = createHarness(DEMO_CPT_PROTOCOL, { seed: 4242 });
await runToEnd(h, (s) => {
  if (s.is_target) return rng() < 0.08 ? null : Math.max(160, 420 + 60 * normal());
  return rng() < 0.12 ? Math.max(150, 330 + 50 * normal()) : null;
});
process.stdout.write(JSON.stringify(h.sink.events) + '\n');
