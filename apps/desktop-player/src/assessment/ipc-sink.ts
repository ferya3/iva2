import type { EventSink } from '@cognitest/event-recorder';
import type { SessionEvent } from '@cognitest/shared-types';

/**
 * Forwards recorded events to the main process outbox. Events are
 * coalesced per microtask so the frame callback that recorded them never
 * pays for IPC serialisation; ordering is preserved by the single channel.
 */
export class IpcOutboxSink implements EventSink {
  private buffer: SessionEvent[] = [];
  private scheduled = false;

  constructor(private readonly send: (events: SessionEvent[]) => void) {}

  write(event: SessionEvent): void {
    this.buffer.push(event);
    if (!this.scheduled) {
      this.scheduled = true;
      queueMicrotask(() => this.flush());
    }
  }

  flush(): void {
    this.scheduled = false;
    if (this.buffer.length === 0) return;
    const batch = this.buffer;
    this.buffer = [];
    this.send(batch);
  }
}
