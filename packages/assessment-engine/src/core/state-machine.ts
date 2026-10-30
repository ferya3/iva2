/**
 * Minimal typed finite-state machine. Illegal transitions throw, which turns
 * lifecycle bugs (e.g. starting twice) into loud failures instead of corrupt
 * sessions.
 */
export class StateMachine<S extends string> {
  private current: S;
  private readonly listeners = new Set<(to: S, from: S) => void>();

  constructor(
    initial: S,
    private readonly transitions: Readonly<Record<S, readonly S[]>>,
  ) {
    this.current = initial;
  }

  get state(): S {
    return this.current;
  }

  can(to: S): boolean {
    return this.transitions[this.current].includes(to);
  }

  transition(to: S): void {
    if (!this.can(to)) throw new Error(`Illegal transition ${this.current} → ${to}`);
    const from = this.current;
    this.current = to;
    for (const l of this.listeners) l(to, from);
  }

  onChange(listener: (to: S, from: S) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
