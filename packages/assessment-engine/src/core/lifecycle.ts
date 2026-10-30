import { StateMachine } from './state-machine';

export type EngineState =
  'idle' | 'preparing' | 'ready' | 'running' | 'completed' | 'aborted' | 'failed';

export const ENGINE_TRANSITIONS: Readonly<Record<EngineState, readonly EngineState[]>> = {
  idle: ['preparing'],
  preparing: ['ready', 'failed'],
  ready: ['running', 'aborted'],
  running: ['completed', 'aborted', 'failed'],
  completed: [],
  aborted: [],
  failed: [],
};

export const createLifecycle = () => new StateMachine<EngineState>('idle', ENGINE_TRANSITIONS);
