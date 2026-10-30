import { describe, expect, it } from 'vitest';
import { IpcOutboxSink } from '../src/assessment/ipc-sink';
import { marker } from '@cognitest/event-recorder/testing';

describe('IpcOutboxSink', () => {
  it('coalesces synchronous writes into one ordered message', async () => {
    const sent: number[][] = [];
    const sink = new IpcOutboxSink((events) => sent.push(events.map((e) => e.sequence)));
    sink.write(marker(1));
    sink.write(marker(2));
    expect(sent).toEqual([]);
    await Promise.resolve();
    sink.write(marker(3));
    await Promise.resolve();
    expect(sent).toEqual([[1, 2], [3]]);
  });
});
