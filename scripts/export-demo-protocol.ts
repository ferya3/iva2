/**
 * Writes the demo protocol definition (source of truth:
 * packages/assessment-engine/src/protocols/demo-cpt.ts) as JSON for the API
 * catalogue seeder.
 *   pnpm tsx scripts/export-demo-protocol.ts
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DEMO_CPT_PROTOCOL } from '@cognitest/assessment-engine';

const out = resolve(import.meta.dirname, '../apps/api/database/seeders/data/demo-cpt.protocol.json');
writeFileSync(out, JSON.stringify(DEMO_CPT_PROTOCOL, null, 2) + '\n');
console.log(`wrote ${out}`);
