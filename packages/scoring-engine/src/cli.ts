/**
 * Scoring entry point for the API worker:
 *   stdin  → {"events": SessionEvent[], "config": Partial<ScoringConfig>}
 *   stdout → ScoringResult JSON
 * Exit codes: 0 ok, 2 invalid input, 1 unexpected failure.
 */
import { z } from 'zod';
import { sessionEventSchema } from '@cognitest/validation';
import type { SessionEvent } from '@cognitest/shared-types';
import { scoreSession } from './score';

const inputSchema = z.object({
  events: z.array(sessionEventSchema),
  config: z.record(z.string(), z.unknown()).default({}),
});

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

async function main(): Promise<void> {
  let parsed: z.infer<typeof inputSchema>;
  try {
    parsed = inputSchema.parse(JSON.parse(await readStdin()));
  } catch (error) {
    process.stderr.write(
      `invalid input: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exit(2);
  }
  const result = scoreSession(parsed.events as SessionEvent[], parsed.config);
  process.stdout.write(JSON.stringify(result));
}

main().catch((error: unknown) => {
  process.stderr.write(`scoring failed: ${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
