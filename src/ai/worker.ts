import type { WorkerRequest, WorkerResponse } from './types';
import { createDictionaryFromText, type Dictionary } from '../game/dictionary';
import { searchAllMoves } from './search';
import { selectMove } from './difficulty';
import { seededRng } from '../game/bag';
import { LETTER_POINTS } from '../game/board';
import type { Letter, Move, PendingPlacement, Tile } from '../game/types';

// Minimal shape of DedicatedWorkerGlobalScope so this file compiles under
// tsconfig.app.json's DOM lib (which does not include webworker lib).
type WorkerCtx = {
  onmessage:
    // eslint-disable-next-line no-undef
    | ((evt: MessageEvent<WorkerRequest>) => void)
    | null;
  postMessage: (msg: WorkerResponse) => void;
};

let dict: Dictionary | null = null;

// eslint-disable-next-line no-undef
const ctx: WorkerCtx = self as unknown as WorkerCtx;

// eslint-disable-next-line no-undef
ctx.onmessage = async (evt: MessageEvent<WorkerRequest>) => {
  const msg = evt.data;
  try {
    if (msg.type === 'INIT') {
      // eslint-disable-next-line no-undef
      const res = await fetch(msg.dictUrl);
      const text = await res.text();
      dict = createDictionaryFromText(text);
      const ready: WorkerResponse = { type: 'READY' };
      ctx.postMessage(ready);
      return;
    }
    if (msg.type === 'REQUEST_MOVE') {
      if (!dict) throw new Error('dictionary not loaded');
      const deadlineMs = msg.difficulty === 'hard' ? 700 : 300;
      const candidates = searchAllMoves(msg.snapshot, dict, { deadlineMs });
      const chosen = selectMove(candidates, msg.difficulty, seededRng(Date.now()));

      let move: Move;
      if (!chosen) {
        if (msg.snapshot.bagRemaining >= 7 && msg.snapshot.rack.length > 0) {
          move = { kind: 'exchange', tileIndices: msg.snapshot.rack.map((_v, i) => i).slice(0, 1) };
        } else {
          move = { kind: 'pass' };
        }
      } else {
        const rackCopy = [...msg.snapshot.rack];
        const placements: PendingPlacement[] = chosen.placements.map(p => {
          let idx: number;
          if (p.fromBlank) {
            idx = rackCopy.indexOf('BLANK');
          } else {
            idx = rackCopy.indexOf(p.letter);
            if (idx === -1) idx = rackCopy.indexOf('BLANK');
          }
          if (idx === -1) throw new Error(`AI placement letter not in rack: ${p.letter}`);
          rackCopy.splice(idx, 1);
          const tile: Tile = p.fromBlank
            ? { kind: 'blank', assigned: p.letter as Letter, points: 0 }
            : { kind: 'letter', letter: p.letter as Letter, points: LETTER_POINTS[p.letter as Letter] };
          return { coord: { r: p.r, c: p.c }, tile, rackIndex: idx };
        });
        move = { kind: 'place', placements };
      }

      const resp: WorkerResponse = { type: 'MOVE_RESULT', move, requestId: msg.requestId };
      ctx.postMessage(resp);
    }
  } catch (err) {
    const errResp: WorkerResponse = {
      type: 'ERROR',
      message: err instanceof Error ? err.message : String(err),
      requestId: msg.type === 'REQUEST_MOVE' ? msg.requestId : undefined,
    };
    ctx.postMessage(errResp);
  }
};
