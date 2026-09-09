import { useEffect, useRef, useState, useCallback } from 'react';
import type { AISnapshot, Difficulty, WorkerRequest, WorkerResponse } from './types';
import type { Move } from '../game/types';

type State = 'uninitialized' | 'ready' | 'thinking';

export function useAiWorker(dictUrl: string | null) {
  const workerRef = useRef<Worker | null>(null);
  const [state, setState] = useState<State>('uninitialized');
  const pendingRef = useRef<Map<number, (move: Move) => void>>(new Map());
  const nextIdRef = useRef(1);

  useEffect(() => {
    if (!dictUrl) return;
    const pending = pendingRef.current;
    const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = w;
    w.onmessage = (evt: MessageEvent<WorkerResponse>) => {
      const msg = evt.data;
      if (msg.type === 'READY') {
        setState('ready');
      } else if (msg.type === 'MOVE_RESULT') {
        setState('ready');
        const cb = pending.get(msg.requestId);
        if (cb) {
          pending.delete(msg.requestId);
          cb(msg.move);
        }
      } else if (msg.type === 'ERROR') {
        setState('ready');
        console.error('AI Worker error:', msg.message);
      }
    };
    const init: WorkerRequest = { type: 'INIT', dictUrl };
    w.postMessage(init);
    return () => {
      w.terminate();
      workerRef.current = null;
      pending.clear();
      setState('uninitialized');
    };
  }, [dictUrl]);

  const requestMove = useCallback(
    (snapshot: AISnapshot, difficulty: Difficulty): Promise<Move> => {
      return new Promise((resolve, reject) => {
        const w = workerRef.current;
        if (!w) return reject(new Error('worker not initialized'));
        const id = nextIdRef.current++;
        pendingRef.current.set(id, resolve);
        setState('thinking');
        const req: WorkerRequest = { type: 'REQUEST_MOVE', snapshot, difficulty, requestId: id };
        w.postMessage(req);
      });
    },
    [],
  );

  return { state, requestMove };
}
