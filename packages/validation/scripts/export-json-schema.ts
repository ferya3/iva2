/**
 * Writes the event-batch contract as JSON Schema into docs/api so that
 * non-TypeScript consumers (and reviewers) see the exact wire format.
 * Run: pnpm --filter @cognitest/validation schema:export
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { calibrationResultSchema, deviceProfileSchema, eventBatchSchema } from '../src';

const out = resolve(import.meta.dirname, '../../../docs/api/schemas');
const schemas = {
  'event-batch': eventBatchSchema,
  'calibration-result': calibrationResultSchema,
  'device-profile': deviceProfileSchema,
};
for (const [name, schema] of Object.entries(schemas)) {
  const json = z.toJSONSchema(schema, { unrepresentable: 'any' });
  writeFileSync(resolve(out, `${name}.schema.json`), JSON.stringify(json, null, 2) + '\n');
  console.log(`wrote ${name}.schema.json`);
}
