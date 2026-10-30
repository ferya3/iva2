import { useEffect, useRef, useState } from 'react';
import type { BlockDefinition } from '@cognitest/assessment-engine';
import type { PlayerSession } from '../../electron/ipc-contract';
import { runSession, type RunHandle } from '../assessment/run-session';
import { bridge } from '../services/bridge';

interface Instruction {
  block: BlockDefinition;
  index: number;
  resolve: () => void;
}

/**
 * Full-screen test surface. React renders only the instruction overlays;
 * stimuli are toggled directly by the engine inside rAF callbacks, so no
 * React render can ever sit between a frame and its stimulus.
 */
export function RunScreen({
  session,
  seed,
  refreshRateHz,
  onFinished,
}: {
  session: PlayerSession;
  seed: number;
  refreshRateHz: number;
  onFinished: (lastSequence: number, aborted: boolean) => void;
}) {
  const surface = useRef<HTMLDivElement>(null);
  const [instruction, setInstruction] = useState<Instruction | null>(null);
  const handle = useRef<RunHandle | null>(null);

  useEffect(() => {
    if (!surface.current || handle.current) return;
    void bridge().setTestMode(true);
    const blocks = session.assessment.protocol.blocks.length;
    handle.current = runSession({
      protocol: session.assessment.protocol,
      seed,
      refreshRateHz,
      container: surface.current,
      record: (events) => bridge().record(events),
      beforeBlock: (block, index) =>
        new Promise<void>((resolve) => setInstruction({ block, index, resolve })).then(() =>
          setInstruction(null),
        ),
      onProgress: () => undefined,
    });
    // Clinician escape hatch: Ctrl+Shift+Q aborts the run (recorded as aborted).
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.code === 'KeyQ') handle.current?.abort('operator');
    };
    window.addEventListener('keydown', onKey);
    void handle.current.done
      .then(({ summary, lastSequence }) => onFinished(lastSequence, summary.state !== 'completed'))
      .finally(() => {
        window.removeEventListener('keydown', onKey);
        void bridge().setTestMode(false);
      });
    void blocks;
  }, [session, seed, refreshRateHz, onFinished]);

  useEffect(() => {
    if (!instruction) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        instruction.resolve();
      }
    };
    // Small delay so the key press that ended the previous block cannot skip the instructions.
    const t = setTimeout(() => window.addEventListener('keydown', onKey), 600);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
  }, [instruction]);

  const total = session.assessment.protocol.blocks.length;
  return (
    <>
      <div ref={surface} className="test-surface" />
      {instruction ? (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black p-12 text-white"
          style={{ cursor: 'default' }}
        >
          <div className="max-w-2xl text-center">
            <p className="mb-4 text-sm text-slate-400">
              بخش {(instruction.index + 1).toLocaleString('fa-IR')} از{' '}
              {total.toLocaleString('fa-IR')}
              {instruction.block.practice ? ' · تمرینی' : ''}
            </p>
            <p className="text-2xl leading-[2.2]">
              {instruction.block.instructions?.fa ?? 'برای شروع آماده شوید.'}
            </p>
            <p className="mt-10 text-slate-400">
              هر وقت آماده بودید کلید{' '}
              <span className="ltr rounded bg-white/10 px-2 py-0.5 font-mono">Space</span> را فشار
              دهید.
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
