/**
 * Writes the demo protocol definitions (source of truth:
 * packages/assessment-engine/src/protocols/demo-cpt.ts) as JSON for the API
 * catalogue seeder.
 *   pnpm tsx scripts/export-demo-protocol.ts
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DEMO_CPT_CHILD_PROTOCOL, DEMO_CPT_PROTOCOL } from '@cognitest/assessment-engine';

const dir = resolve(import.meta.dirname, '../apps/api/database/seeders/data');
for (const [file, protocol] of [
  ['demo-cpt.protocol.json', DEMO_CPT_PROTOCOL],
  ['demo-cpt-child.protocol.json', DEMO_CPT_CHILD_PROTOCOL],
] as const) {
  const out = resolve(dir, file);
  writeFileSync(out, JSON.stringify(protocol, null, 2) + '\n');
  console.log(`wrote ${out}`);
}
