/**
 * Raw event vocabulary recorded by the assessment engine and transported to
 * the API. Timestamps are milliseconds on the session's monotonic clock
 * (performance.now() re-based to the session origin), kept as doubles.
 */
export const EventType = {
  SessionStarted: 'session_started',
  SessionEnded: 'session_ended',
  BlockStarted: 'block_started',
  BlockEnded: 'block_ended',
  StimulusPresented: 'stimulus_presented',
  StimulusCleared: 'stimulus_cleared',
  Response: 'response',
  FocusLost: 'focus_lost',
  FocusGained: 'focus_gained',
  VisibilityHidden: 'visibility_hidden',
  VisibilityVisible: 'visibility_visible',
  FrameDrop: 'frame_drop',
  AudioError: 'audio_error',
  Marker: 'marker',
} as const;
export type EventType = (typeof EventType)[keyof typeof EventType];

export type Modality = 'visual' | 'auditory';
export type InputType = 'keyboard' | 'mouse';
export type PresentationStatus = 'on_time' | 'late' | 'dropped';
export type ResponseValidity = 'valid' | 'anticipatory' | 'late' | 'unmatched';

interface BaseEvent<T extends EventType> {
  /** 1-based, strictly increasing, gap-free within a session. */
  sequence: number;
  type: T;
  /**
   * Time the recorder logged the event (non-decreasing). Precise measurement
   * times live in dedicated fields (actual_time_ms, received_time_ms) because
   * an input event can be logged after a frame whose timestamp is later.
   */
  timestamp_ms: number;
}

export interface SessionStartedEvent extends BaseEvent<'session_started'> {
  engine_version: string;
  protocol_key: string;
  protocol_version: string;
  seed: number;
  wall_clock_iso: string;
}
export interface SessionEndedEvent extends BaseEvent<'session_ended'> {
  reason: 'completed' | 'aborted';
}
export interface BlockStartedEvent extends BaseEvent<'block_started'> {
  block_index: number;
  block_key: string;
}
export interface BlockEndedEvent extends BaseEvent<'block_ended'> {
  block_index: number;
}
export interface StimulusPresentedEvent extends BaseEvent<'stimulus_presented'> {
  trial_index: number;
  block_index: number;
  stimulus_id: string;
  modality: Modality;
  is_target: boolean;
  planned_time_ms: number;
  actual_time_ms: number;
  frame_number: number | null;
  presentation_status: PresentationStatus;
}
export interface StimulusClearedEvent extends BaseEvent<'stimulus_cleared'> {
  trial_index: number;
}
export interface ResponseEvent extends BaseEvent<'response'> {
  input: InputType;
  /** Precise input time (Event.timeStamp re-based to the session clock). */
  received_time_ms: number;
  /** KeyboardEvent.code or mouse button name. */
  key: string;
  /** Sequence number of the stimulus this response was attributed to. */
  stimulus_sequence: number | null;
  reaction_time_ms: number | null;
  validity: ResponseValidity;
}
export interface FocusEvent extends BaseEvent<'focus_lost' | 'focus_gained'> {}
export interface VisibilityEvent extends BaseEvent<'visibility_hidden' | 'visibility_visible'> {}
export interface FrameDropEvent extends BaseEvent<'frame_drop'> {
  expected_interval_ms: number;
  observed_interval_ms: number;
  dropped_frames: number;
}
export interface AudioErrorEvent extends BaseEvent<'audio_error'> {
  message: string;
}
export interface MarkerEvent extends BaseEvent<'marker'> {
  label: string;
}

export type SessionEvent =
  | SessionStartedEvent
  | SessionEndedEvent
  | BlockStartedEvent
  | BlockEndedEvent
  | StimulusPresentedEvent
  | StimulusClearedEvent
  | ResponseEvent
  | FocusEvent
  | VisibilityEvent
  | FrameDropEvent
  | AudioErrorEvent
  | MarkerEvent;

/** Distributive Omit so the discriminated union survives. */
export type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** An event before the recorder assigns its sequence number and log time. */
export type EventPayload = DistributiveOmit<SessionEvent, 'sequence' | 'timestamp_ms'>;

export interface EventBatch {
  session_id: string;
  batch_id: string;
  engine_version: string;
  events: SessionEvent[];
}

export interface EventBatchAck {
  batch_id: string;
  accepted: number;
  duplicate: boolean;
  last_sequence: number;
}
