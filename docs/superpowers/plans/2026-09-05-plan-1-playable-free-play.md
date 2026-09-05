# Plan 1: Playable Free Play Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a locally playable single-player free-play Scrabble game — one player (P1) places tiles on the 15×15 board, forms words validated against TWL06, sees scores calculated by full Scrabble rules, and can Play / Recall / Exchange / Pass / Shuffle until the game ends.

**Architecture:** Vite + React + TypeScript SPA. Pure functional core (`src/game/`) with `useReducer` state machine. UI layer (`src/ui/`) uses `@dnd-kit/core` for touch-friendly drag & drop plus click-to-place fallback. Tailwind CSS for retro/pixel-art styling. No AI, no Web Worker, no lazy-loaded definitions, no responsive polish — those are Plans 2–4.

**Tech Stack:**
- Node.js 22 (via mise)
- Vite 5 + React 18 + TypeScript 5
- Tailwind CSS 3
- `@dnd-kit/core`, `@dnd-kit/utilities`
- Vitest + `@testing-library/react` + jsdom
- ESLint (flat config)

**Reference:** `/home/setup/12_tiny_pj/scrabble/docs/design.md` — full design specification.

---

## Milestones

- **M1** Scaffolding & tooling
- **M2** Core game types + board + bag + TWL06 dictionary loader (TDD)
- **M3** Rules — validation & scoring (TDD)
- **M4** Reducer — state machine (TDD)
- **M5** UI shell — Board / Tile / Rack / ScorePanel rendering
- **M6** Tile placement — drag & drop + click, Recall, Play with validation
- **M7** ActionBar — Shuffle / Pass / Exchange, blank-tile modal, game end
- **M8** README + polish

Commit after every completed task. Use conventional commits (`feat:`, `test:`, `chore:`, `docs:`).

---

# M1: Scaffolding & Tooling

## Task 1.1: Initialize mise + package.json

**Files:**
- Create: `scrabble/.mise.toml`
- Create: `scrabble/.gitignore`
- Create: `scrabble/package.json`

- [ ] **Step 1: Create `.mise.toml`**

```toml
[tools]
node = "22"
```

- [ ] **Step 2: Create `.gitignore`**

```
node_modules/
dist/
.DS_Store
*.log
.env
.env.local

# Generated dictionary assets (built via `npm run build:dict`, Plan 3)
public/dict/
```

- [ ] **Step 3: Install Node via mise**

Run: `cd /home/setup/12_tiny_pj/scrabble && mise install`
Expected: node 22 installed, `node --version` prints `v22.x.x`

- [ ] **Step 4: Create `package.json`**

```json
{
  "name": "toy-scrabble",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint ."
  },
  "dependencies": {
    "@dnd-kit/core": "^6.1.0",
    "@dnd-kit/utilities": "^3.2.2",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.5",
    "@testing-library/react": "^16.0.0",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@typescript-eslint/eslint-plugin": "^8.0.0",
    "@typescript-eslint/parser": "^8.0.0",
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.19",
    "eslint": "^9.9.0",
    "eslint-plugin-react-hooks": "^5.1.0",
    "eslint-plugin-react-refresh": "^0.4.9",
    "jsdom": "^24.1.1",
    "postcss": "^8.4.40",
    "tailwindcss": "^3.4.7",
    "typescript": "^5.5.3",
    "vite": "^5.4.0",
    "vitest": "^2.0.5"
  }
}
```

- [ ] **Step 5: Install dependencies**

Run: `cd /home/setup/12_tiny_pj/scrabble && npm install`
Expected: `node_modules/` populated, no errors

- [ ] **Step 6: Commit**

```bash
cd /home/setup/12_tiny_pj/scrabble
git init  # if not yet a repo
git add .mise.toml .gitignore package.json package-lock.json
git commit -m "chore: initialize package with dependencies"
```

## Task 1.2: TypeScript config

**Files:**
- Create: `scrabble/tsconfig.json`
- Create: `scrabble/tsconfig.app.json`
- Create: `scrabble/tsconfig.node.json`

- [ ] **Step 1: Create `tsconfig.json`**

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

- [ ] **Step 2: Create `tsconfig.app.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["vite/client"]
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 3: Create `tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "noEmit": true
  },
  "include": ["vite.config.ts", "vitest.config.ts"]
}
```

- [ ] **Step 4: Commit**

```bash
git add tsconfig*.json
git commit -m "chore: add TypeScript configuration"
```

## Task 1.3: Vite + Vitest config

**Files:**
- Create: `scrabble/vite.config.ts`
- Create: `scrabble/vitest.config.ts`
- Create: `scrabble/tests/setup.ts`

- [ ] **Step 1: Create `vite.config.ts`**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/toy-scrabble/',
});
```

- [ ] **Step 2: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
  },
});
```

- [ ] **Step 3: Create `tests/setup.ts`**

```typescript
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 4: Commit**

```bash
git add vite.config.ts vitest.config.ts tests/setup.ts
git commit -m "chore: add Vite and Vitest configuration"
```

## Task 1.4: Tailwind CSS setup

**Files:**
- Create: `scrabble/tailwind.config.js`
- Create: `scrabble/postcss.config.js`
- Create: `scrabble/src/index.css`

- [ ] **Step 1: Create `tailwind.config.js`**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'board-bg': '#2a5934',
        'cell-bg': '#d9c9a3',
        'tile-wood': '#e8c07d',
        'premium-dl': '#7ec8e3',
        'premium-tl': '#3b82f6',
        'premium-dw': '#f9a8b8',
        'premium-tw': '#e63946',
      },
      fontFamily: {
        pixel: ['"Press Start 2P"', 'monospace'],
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 2: Create `postcss.config.js`**

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 3: Create `src/index.css`**

```css
@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  margin: 0;
  font-family: system-ui, sans-serif;
  background: #1a3d24;
  color: #f5e9ce;
}
```

- [ ] **Step 4: Commit**

```bash
git add tailwind.config.js postcss.config.js src/index.css
git commit -m "chore: configure Tailwind CSS with retro palette"
```

## Task 1.5: ESLint flat config

**Files:**
- Create: `scrabble/eslint.config.js`

- [ ] **Step 1: Create `eslint.config.js`**

```javascript
import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default [
  { ignores: ['dist', 'node_modules'] },
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parser: tsparser,
    },
    plugins: {
      '@typescript-eslint': tseslint,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': 'warn',
    },
  },
];
```

- [ ] **Step 2: Verify lint runs**

Run: `npm run lint`
Expected: exits 0 (no files to lint yet or no errors)

- [ ] **Step 3: Commit**

```bash
git add eslint.config.js
git commit -m "chore: add ESLint flat config"
```

## Task 1.6: Entry HTML + minimal App

**Files:**
- Create: `scrabble/index.html`
- Create: `scrabble/src/main.tsx`
- Create: `scrabble/src/App.tsx`

- [ ] **Step 1: Create `index.html`**

```html
<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Toy Scrabble</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Create `src/main.tsx`**

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

- [ ] **Step 3: Create `src/App.tsx`**

```tsx
export default function App() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <h1 className="font-pixel text-2xl">Toy Scrabble</h1>
    </main>
  );
}
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: builds successfully, `dist/` produced

- [ ] **Step 5: Verify dev server**

Run: `npm run dev` (in background), then `curl -s http://localhost:5173/toy-scrabble/ | head -20`
Expected: HTML shell served. Kill dev server after check.

- [ ] **Step 6: Commit**

```bash
git add index.html src/main.tsx src/App.tsx
git commit -m "feat: scaffold minimal React entry point"
```

---

# M2: Core Types, Board, Bag, Dictionary

## Task 2.1: Core types

**Files:**
- Create: `scrabble/src/game/types.ts`

- [ ] **Step 1: Create `src/game/types.ts`**

```typescript
export type Letter =
  | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L' | 'M'
  | 'N' | 'O' | 'P' | 'Q' | 'R' | 'S' | 'T' | 'U' | 'V' | 'W' | 'X' | 'Y' | 'Z';

export type Tile =
  | { kind: 'letter'; letter: Letter; points: number }
  | { kind: 'blank'; assigned: Letter | null; points: 0 };

export type Coord = { r: number; c: number };
export type Direction = 'H' | 'V';

export type PremiumSquare = 'DL' | 'TL' | 'DW' | 'TW' | 'STAR' | null;

export type PlacedTile = { tile: Tile; placedTurn: number };
export type Board = (PlacedTile | null)[][]; // 15x15

export type Rack = Tile[]; // max 7

export type PendingPlacement = { coord: Coord; tile: Tile; rackIndex: number };

export type Move =
  | { kind: 'place'; placements: PendingPlacement[] }
  | { kind: 'exchange'; tileIndices: number[] }
  | { kind: 'pass' };

export type PlayerId = 'P1' | 'COM';
export type Player = { id: PlayerId; name: string; score: number; rack: Rack };

export type GameStatus = 'setup' | 'playing' | 'ended';
export type GameMode = 'free' | 'com-easy' | 'com-medium' | 'com-hard';

export type FormedWord = {
  word: string;
  tiles: { coord: Coord; tile: Tile; fromPending: boolean }[];
  wordMultiplier: number;
  finalScore: number;
};

export type MoveRecord = {
  player: PlayerId;
  move: Move;
  wordsFormed: string[];
  score: number;
};

export type GameState = {
  mode: GameMode;
  status: GameStatus;
  board: Board;
  bag: Tile[];
  players: [Player, Player];
  currentPlayerIndex: 0 | 1;
  turn: number;
  pending: PendingPlacement[];
  history: MoveRecord[];
  lastFormedWords: FormedWord[];
  consecutivePasses: number;
  lastError: string | null;
};
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc -b`
Expected: exits 0

- [ ] **Step 3: Commit**

```bash
git add src/game/types.ts
git commit -m "feat(game): add core type definitions"
```

## Task 2.2: Premium board layout + tile distribution constants

**Files:**
- Create: `scrabble/src/game/board.ts`
- Create: `scrabble/tests/board.test.ts`

- [ ] **Step 1: Write failing test `tests/board.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { PREMIUM_BOARD, createEmptyBoard, LETTER_POINTS, LETTER_COUNTS } from '../src/game/board';

describe('PREMIUM_BOARD', () => {
  it('is 15x15', () => {
    expect(PREMIUM_BOARD).toHaveLength(15);
    PREMIUM_BOARD.forEach(row => expect(row).toHaveLength(15));
  });

  it('has STAR at center (7,7)', () => {
    expect(PREMIUM_BOARD[7][7]).toBe('STAR');
  });

  it('has TW at all four corners', () => {
    expect(PREMIUM_BOARD[0][0]).toBe('TW');
    expect(PREMIUM_BOARD[0][14]).toBe('TW');
    expect(PREMIUM_BOARD[14][0]).toBe('TW');
    expect(PREMIUM_BOARD[14][14]).toBe('TW');
  });

  it('has TW at row/column midpoints on edges', () => {
    expect(PREMIUM_BOARD[0][7]).toBe('TW');
    expect(PREMIUM_BOARD[7][0]).toBe('TW');
    expect(PREMIUM_BOARD[7][14]).toBe('TW');
    expect(PREMIUM_BOARD[14][7]).toBe('TW');
  });
});

describe('createEmptyBoard', () => {
  it('creates a 15x15 board of nulls', () => {
    const b = createEmptyBoard();
    expect(b).toHaveLength(15);
    b.forEach(row => {
      expect(row).toHaveLength(15);
      row.forEach(cell => expect(cell).toBeNull());
    });
  });
});

describe('LETTER_POINTS', () => {
  it('assigns 1 point to A, E, I, L, N, O, R, S, T, U', () => {
    ['A', 'E', 'I', 'L', 'N', 'O', 'R', 'S', 'T', 'U'].forEach(l =>
      expect(LETTER_POINTS[l as keyof typeof LETTER_POINTS]).toBe(1),
    );
  });
  it('assigns 10 points to Q and Z', () => {
    expect(LETTER_POINTS.Q).toBe(10);
    expect(LETTER_POINTS.Z).toBe(10);
  });
});

describe('LETTER_COUNTS', () => {
  it('totals 100 tiles including 2 blanks', () => {
    const total = Object.values(LETTER_COUNTS).reduce((a, b) => a + b, 0);
    expect(total).toBe(100);
  });
  it('assigns 12 Es and 9 As and 2 blanks', () => {
    expect(LETTER_COUNTS.E).toBe(12);
    expect(LETTER_COUNTS.A).toBe(9);
    expect(LETTER_COUNTS.BLANK).toBe(2);
  });
});
```

- [ ] **Step 2: Verify test fails**

Run: `npx vitest run tests/board.test.ts`
Expected: FAIL — module `../src/game/board` not found

- [ ] **Step 3: Create `src/game/board.ts`**

```typescript
import type { Board, PremiumSquare, Letter } from './types';

// prettier-ignore
export const PREMIUM_BOARD: PremiumSquare[][] = [
  ['TW', null, null, 'DL', null, null, null, 'TW', null, null, null, 'DL', null, null, 'TW'],
  [null, 'DW', null, null, null, 'TL', null, null, null, 'TL', null, null, null, 'DW', null],
  [null, null, 'DW', null, null, null, 'DL', null, 'DL', null, null, null, 'DW', null, null],
  ['DL', null, null, 'DW', null, null, null, 'DL', null, null, null, 'DW', null, null, 'DL'],
  [null, null, null, null, 'DW', null, null, null, null, null, 'DW', null, null, null, null],
  [null, 'TL', null, null, null, 'TL', null, null, null, 'TL', null, null, null, 'TL', null],
  [null, null, 'DL', null, null, null, 'DL', null, 'DL', null, null, null, 'DL', null, null],
  ['TW', null, null, 'DL', null, null, null, 'STAR', null, null, null, 'DL', null, null, 'TW'],
  [null, null, 'DL', null, null, null, 'DL', null, 'DL', null, null, null, 'DL', null, null],
  [null, 'TL', null, null, null, 'TL', null, null, null, 'TL', null, null, null, 'TL', null],
  [null, null, null, null, 'DW', null, null, null, null, null, 'DW', null, null, null, null],
  ['DL', null, null, 'DW', null, null, null, 'DL', null, null, null, 'DW', null, null, 'DL'],
  [null, null, 'DW', null, null, null, 'DL', null, 'DL', null, null, null, 'DW', null, null],
  [null, 'DW', null, null, null, 'TL', null, null, null, 'TL', null, null, null, 'DW', null],
  ['TW', null, null, 'DL', null, null, null, 'TW', null, null, null, 'DL', null, null, 'TW'],
];

export function createEmptyBoard(): Board {
  return Array.from({ length: 15 }, () => Array(15).fill(null));
}

export const LETTER_POINTS: Record<Letter, number> = {
  A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8, K: 5, L: 1, M: 3,
  N: 1, O: 1, P: 3, Q: 10, R: 1, S: 1, T: 1, U: 1, V: 4, W: 4, X: 8, Y: 4, Z: 10,
};

export const LETTER_COUNTS: Record<Letter | 'BLANK', number> = {
  A: 9, B: 2, C: 2, D: 4, E: 12, F: 2, G: 3, H: 2, I: 9, J: 1, K: 1, L: 4, M: 2,
  N: 6, O: 8, P: 2, Q: 1, R: 6, S: 4, T: 6, U: 4, V: 2, W: 2, X: 1, Y: 2, Z: 1,
  BLANK: 2,
};
```

- [ ] **Step 4: Verify test passes**

Run: `npx vitest run tests/board.test.ts`
Expected: PASS (all)

- [ ] **Step 5: Commit**

```bash
git add src/game/board.ts tests/board.test.ts
git commit -m "feat(game): add premium board layout and letter constants"
```

## Task 2.3: Tile bag with seedable shuffle

**Files:**
- Create: `scrabble/src/game/bag.ts`
- Create: `scrabble/tests/bag.test.ts`

- [ ] **Step 1: Write failing test `tests/bag.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { createBag, drawTiles, seededRng } from '../src/game/bag';

describe('createBag', () => {
  it('produces 100 tiles', () => {
    const bag = createBag(seededRng(42));
    expect(bag).toHaveLength(100);
  });

  it('includes 2 blanks', () => {
    const bag = createBag(seededRng(42));
    expect(bag.filter(t => t.kind === 'blank')).toHaveLength(2);
  });

  it('includes 12 Es', () => {
    const bag = createBag(seededRng(42));
    const es = bag.filter(t => t.kind === 'letter' && t.letter === 'E');
    expect(es).toHaveLength(12);
  });

  it('shuffles deterministically for same seed', () => {
    const a = createBag(seededRng(42));
    const b = createBag(seededRng(42));
    expect(a).toEqual(b);
  });

  it('shuffles differently for different seed', () => {
    const a = createBag(seededRng(42));
    const b = createBag(seededRng(43));
    expect(a).not.toEqual(b);
  });
});

describe('drawTiles', () => {
  it('draws N tiles from the top and returns remaining bag', () => {
    const bag = createBag(seededRng(42));
    const [drawn, rest] = drawTiles(bag, 7);
    expect(drawn).toHaveLength(7);
    expect(rest).toHaveLength(93);
    expect([...drawn, ...rest]).toEqual(bag);
  });

  it('returns fewer tiles if bag runs short', () => {
    const bag = createBag(seededRng(42)).slice(0, 3);
    const [drawn, rest] = drawTiles(bag, 7);
    expect(drawn).toHaveLength(3);
    expect(rest).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Verify test fails**

Run: `npx vitest run tests/bag.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create `src/game/bag.ts`**

```typescript
import type { Tile, Letter } from './types';
import { LETTER_POINTS, LETTER_COUNTS } from './board';

export type Rng = () => number; // returns [0, 1)

// Mulberry32 seeded PRNG
export function seededRng(seed: number): Rng {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createBag(rng: Rng): Tile[] {
  const tiles: Tile[] = [];
  for (const [key, count] of Object.entries(LETTER_COUNTS)) {
    for (let i = 0; i < count; i++) {
      if (key === 'BLANK') {
        tiles.push({ kind: 'blank', assigned: null, points: 0 });
      } else {
        const letter = key as Letter;
        tiles.push({ kind: 'letter', letter, points: LETTER_POINTS[letter] });
      }
    }
  }
  // Fisher–Yates
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }
  return tiles;
}

export function drawTiles(bag: Tile[], n: number): [Tile[], Tile[]] {
  const drawn = bag.slice(0, n);
  const rest = bag.slice(drawn.length);
  return [drawn, rest];
}
```

- [ ] **Step 4: Verify test passes**

Run: `npx vitest run tests/bag.test.ts`
Expected: PASS (all)

- [ ] **Step 5: Commit**

```bash
git add src/game/bag.ts tests/bag.test.ts
git commit -m "feat(game): add tile bag with seedable shuffle"
```

## Task 2.4: TWL06 dictionary loader

**Files:**
- Create: `scrabble/src/game/dictionary.ts`
- Create: `scrabble/tests/dictionary.test.ts`
- Create: `scrabble/public/dict/twl06.sample.txt` (small fixture for tests + local dev)

- [ ] **Step 1: Create sample dictionary fixture**

Create `scrabble/public/dict/twl06.sample.txt` with representative words (real TWL06 will be generated in Plan 3):

```
AA
AAH
ABLE
CAB
CAT
CATS
DOG
HELLO
QI
QUIZ
SCRABBLE
WORD
XI
ZA
ZEBRA
```

- [ ] **Step 2: Write failing test `tests/dictionary.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { createDictionaryFromText, isValidWord, hasPrefix } from '../src/game/dictionary';

const SAMPLE = `AA
AAH
ABLE
CAT
CATS
QI
ZEBRA
`;

describe('createDictionaryFromText', () => {
  it('parses newline-separated words into a Set', () => {
    const dict = createDictionaryFromText(SAMPLE);
    expect(dict.words.size).toBe(7);
    expect(dict.words.has('CAT')).toBe(true);
  });

  it('uppercases and trims entries', () => {
    const dict = createDictionaryFromText('cat\n  dog  \n');
    expect(dict.words.has('CAT')).toBe(true);
    expect(dict.words.has('DOG')).toBe(true);
  });

  it('builds a prefix set including empty and each proper prefix', () => {
    const dict = createDictionaryFromText('CAT\n');
    expect(dict.prefixes.has('')).toBe(true);
    expect(dict.prefixes.has('C')).toBe(true);
    expect(dict.prefixes.has('CA')).toBe(true);
    // Full words are also valid prefixes (of themselves)
    expect(dict.prefixes.has('CAT')).toBe(true);
  });
});

describe('isValidWord', () => {
  it('returns true for known words (case-insensitive)', () => {
    const dict = createDictionaryFromText(SAMPLE);
    expect(isValidWord(dict, 'cat')).toBe(true);
    expect(isValidWord(dict, 'CAT')).toBe(true);
  });
  it('returns false for unknown words', () => {
    const dict = createDictionaryFromText(SAMPLE);
    expect(isValidWord(dict, 'xyz')).toBe(false);
  });
});

describe('hasPrefix', () => {
  it('returns true for known prefixes', () => {
    const dict = createDictionaryFromText('CAT\n');
    expect(hasPrefix(dict, 'CA')).toBe(true);
  });
  it('returns false for unknown prefixes', () => {
    const dict = createDictionaryFromText('CAT\n');
    expect(hasPrefix(dict, 'XY')).toBe(false);
  });
});
```

- [ ] **Step 3: Verify test fails**

Run: `npx vitest run tests/dictionary.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Create `src/game/dictionary.ts`**

```typescript
export type Dictionary = {
  words: Set<string>;
  prefixes: Set<string>;
};

export function createDictionaryFromText(text: string): Dictionary {
  const words = new Set<string>();
  const prefixes = new Set<string>(['']);
  for (const raw of text.split(/\r?\n/)) {
    const w = raw.trim().toUpperCase();
    if (!w) continue;
    words.add(w);
    for (let i = 1; i <= w.length; i++) {
      prefixes.add(w.slice(0, i));
    }
  }
  return { words, prefixes };
}

export function isValidWord(dict: Dictionary, word: string): boolean {
  return dict.words.has(word.toUpperCase());
}

export function hasPrefix(dict: Dictionary, prefix: string): boolean {
  return dict.prefixes.has(prefix.toUpperCase());
}

export async function loadDictionaryFromUrl(url: string): Promise<Dictionary> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`dictionary fetch failed: ${res.status}`);
  const text = await res.text();
  return createDictionaryFromText(text);
}
```

- [ ] **Step 5: Verify test passes**

Run: `npx vitest run tests/dictionary.test.ts`
Expected: PASS (all)

- [ ] **Step 6: Commit**

```bash
git add src/game/dictionary.ts tests/dictionary.test.ts public/dict/twl06.sample.txt
git commit -m "feat(game): add TWL06 dictionary loader with prefix set"
```

---

# M3: Rules — Validation & Scoring

## Task 3.1: Placement direction & straight-line detection

**Files:**
- Create: `scrabble/src/game/rules.ts` (start)
- Create: `scrabble/tests/rules.test.ts`

- [ ] **Step 1: Write failing test for `detectDirection`**

Add to `tests/rules.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { detectDirection } from '../src/game/rules';
import type { PendingPlacement, Tile } from '../src/game/types';

const T = (letter: string): Tile =>
  ({ kind: 'letter', letter: letter as any, points: 1 });

const P = (r: number, c: number, l: string): PendingPlacement =>
  ({ coord: { r, c }, tile: T(l), rackIndex: 0 });

describe('detectDirection', () => {
  it('returns H for placements all in same row', () => {
    const ps = [P(7, 5, 'C'), P(7, 6, 'A'), P(7, 7, 'T')];
    expect(detectDirection(ps)).toBe('H');
  });
  it('returns V for placements all in same column', () => {
    const ps = [P(5, 7, 'C'), P(6, 7, 'A'), P(7, 7, 'T')];
    expect(detectDirection(ps)).toBe('V');
  });
  it('returns H for single placement (conventional)', () => {
    const ps = [P(7, 7, 'A')];
    expect(detectDirection(ps)).toBe('H');
  });
  it('returns null for placements not on a single line', () => {
    const ps = [P(7, 5, 'C'), P(8, 6, 'A')];
    expect(detectDirection(ps)).toBeNull();
  });
});
```

- [ ] **Step 2: Verify test fails**

Run: `npx vitest run tests/rules.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create `src/game/rules.ts` with `detectDirection`**

```typescript
import type { Board, Coord, Direction, PendingPlacement, Tile, FormedWord } from './types';
import { PREMIUM_BOARD } from './board';
import type { Dictionary } from './dictionary';
import { isValidWord } from './dictionary';

export function detectDirection(placements: PendingPlacement[]): Direction | null {
  if (placements.length === 0) return null;
  if (placements.length === 1) return 'H';
  const rows = new Set(placements.map(p => p.coord.r));
  const cols = new Set(placements.map(p => p.coord.c));
  if (rows.size === 1) return 'H';
  if (cols.size === 1) return 'V';
  return null;
}
```

- [ ] **Step 4: Verify test passes**

Run: `npx vitest run tests/rules.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/game/rules.ts tests/rules.test.ts
git commit -m "feat(rules): add placement direction detection"
```

## Task 3.2: `validatePlacement` — geometry checks

**Files:**
- Modify: `scrabble/src/game/rules.ts`
- Modify: `scrabble/tests/rules.test.ts`

Six geometry sub-rules, one test each. Grouped in one task; validation logic added incrementally.

- [ ] **Step 1: Add failing geometry tests**

Append to `tests/rules.test.ts`:

```typescript
import { validatePlacement } from '../src/game/rules';
import { createEmptyBoard } from '../src/game/board';
import { createDictionaryFromText } from '../src/game/dictionary';
import type { Board, PlacedTile } from '../src/game/types';

const dict = createDictionaryFromText('CAT\nCATS\nAT\nBAT\nCAB\nCABS\nAB\n');

function place(board: Board, r: number, c: number, letter: string, turn = 1): Board {
  const b = board.map(row => [...row]);
  b[r][c] = { tile: { kind: 'letter', letter: letter as any, points: 1 }, placedTurn: turn };
  return b;
}

describe('validatePlacement — geometry', () => {
  it('fails on empty placements', () => {
    const res = validatePlacement(createEmptyBoard(), [], dict, true);
    expect(res.ok).toBe(false);
  });

  it('fails when placements not on a straight line', () => {
    const ps = [P(7, 7, 'C'), P(8, 8, 'A')];
    const res = validatePlacement(createEmptyBoard(), ps, dict, true);
    expect(res.ok).toBe(false);
  });

  it('fails on first move when placements do not cover center', () => {
    const ps = [P(0, 0, 'C'), P(0, 1, 'A'), P(0, 2, 'T')];
    const res = validatePlacement(createEmptyBoard(), ps, dict, true);
    expect(res.ok).toBe(false);
  });

  it('succeeds on first move through center forming a valid word', () => {
    const ps = [P(7, 6, 'C'), P(7, 7, 'A'), P(7, 8, 'T')];
    const res = validatePlacement(createEmptyBoard(), ps, dict, true);
    expect(res.ok).toBe(true);
  });

  it('fails when placements have gaps not filled by existing tiles', () => {
    const ps = [P(7, 6, 'C'), P(7, 8, 'T')];
    const res = validatePlacement(createEmptyBoard(), ps, dict, true);
    expect(res.ok).toBe(false);
  });

  it('fails on second move when new tiles are not adjacent to any existing tile', () => {
    let b = createEmptyBoard();
    b = place(b, 7, 7, 'A');
    const ps = [P(0, 0, 'C'), P(0, 1, 'A'), P(0, 2, 'T')];
    const res = validatePlacement(b, ps, dict, false);
    expect(res.ok).toBe(false);
  });

  it('fails when a formed word is not in the dictionary', () => {
    const ps = [P(7, 6, 'X'), P(7, 7, 'Y'), P(7, 8, 'Z')];
    const res = validatePlacement(createEmptyBoard(), ps, dict, true);
    expect(res.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Verify tests fail**

Run: `npx vitest run tests/rules.test.ts`
Expected: FAIL (`validatePlacement` not exported)

- [ ] **Step 3: Implement `validatePlacement` in `src/game/rules.ts`**

Append to `src/game/rules.ts`:

```typescript
export type ValidationResult =
  | { ok: true; formedWords: FormedWord[]; score: number }
  | { ok: false; reason: string };

const CENTER: Coord = { r: 7, c: 7 };

export function validatePlacement(
  board: Board,
  placements: PendingPlacement[],
  dict: Dictionary,
  isFirstMove: boolean,
): ValidationResult {
  if (placements.length === 0) return { ok: false, reason: '配置がありません' };

  const direction = detectDirection(placements);
  if (direction === null) return { ok: false, reason: '配置は一直線に並べてください' };

  // Every placement must land on an empty cell
  for (const p of placements) {
    if (board[p.coord.r]?.[p.coord.c] !== null) {
      return { ok: false, reason: '既存タイルの上には置けません' };
    }
  }

  // Sort along the direction axis
  const sorted = [...placements].sort((a, b) =>
    direction === 'H' ? a.coord.c - b.coord.c : a.coord.r - b.coord.r,
  );
  const fixed = direction === 'H' ? sorted[0].coord.r : sorted[0].coord.c;

  // All in same row/col
  if (
    direction === 'H'
      ? sorted.some(p => p.coord.r !== fixed)
      : sorted.some(p => p.coord.c !== fixed)
  ) {
    return { ok: false, reason: '配置は一直線に並べてください' };
  }

  // Gap check — every position between first and last must be filled by pending or existing
  const first = direction === 'H' ? sorted[0].coord.c : sorted[0].coord.r;
  const last = direction === 'H' ? sorted[sorted.length - 1].coord.c : sorted[sorted.length - 1].coord.r;
  const pendingIndex = new Set(sorted.map(p => (direction === 'H' ? p.coord.c : p.coord.r)));
  for (let i = first; i <= last; i++) {
    const cell = direction === 'H' ? board[fixed][i] : board[i][fixed];
    if (!pendingIndex.has(i) && cell === null) {
      return { ok: false, reason: '配置に隙間があります' };
    }
  }

  if (isFirstMove) {
    const coversCenter = sorted.some(p => p.coord.r === CENTER.r && p.coord.c === CENTER.c);
    if (!coversCenter) return { ok: false, reason: '初手はセンター (中央マス) を通ってください' };
  } else {
    // At least one new tile must touch an existing tile (orthogonal neighbor)
    const touches = sorted.some(p => {
      const { r, c } = p.coord;
      const nb = [
        [r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1],
      ];
      return nb.some(([nr, nc]) => board[nr]?.[nc] != null);
    });
    if (!touches) return { ok: false, reason: '既存タイルに隣接して配置してください' };
  }

  // Extract all formed words and validate them against the dictionary
  const formedWords = extractAllFormedWords(board, sorted, direction);
  for (const fw of formedWords) {
    if (!isValidWord(dict, fw.word)) {
      return { ok: false, reason: `'${fw.word}' は辞書にありません` };
    }
  }

  const score = formedWords.reduce((sum, w) => sum + w.finalScore, 0)
    + (placements.length === 7 ? 50 : 0); // Bingo

  return { ok: true, formedWords, score };
}

// Placeholder — implemented in Task 3.3
export function extractAllFormedWords(
  _board: Board,
  _placements: PendingPlacement[],
  _direction: Direction,
): FormedWord[] {
  return [];
}
```

- [ ] **Step 4: Verify all geometry tests pass except word-validation ones (which need Task 3.3)**

Run: `npx vitest run tests/rules.test.ts`
Expected: all 7 geometry tests pass except "succeeds on first move through center forming a valid word" and "fails when a formed word is not in the dictionary" which depend on `extractAllFormedWords`. These will pass after Task 3.3.

Mark this task complete anyway — Task 3.3 fills the gap immediately.

- [ ] **Step 5: Commit**

```bash
git add src/game/rules.ts tests/rules.test.ts
git commit -m "feat(rules): validate placement geometry (line, gap, adjacency, center)"
```

## Task 3.3: `extractAllFormedWords` — main + cross words

**Files:**
- Modify: `scrabble/src/game/rules.ts`
- Modify: `scrabble/tests/rules.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `tests/rules.test.ts`:

```typescript
import { extractAllFormedWords } from '../src/game/rules';

describe('extractAllFormedWords', () => {
  it('extracts single main horizontal word', () => {
    const ps = [P(7, 6, 'C'), P(7, 7, 'A'), P(7, 8, 'T')];
    const words = extractAllFormedWords(createEmptyBoard(), ps, 'H');
    expect(words.map(w => w.word)).toEqual(['CAT']);
  });

  it('extracts main + cross word when placement extends existing tile', () => {
    let b = createEmptyBoard();
    b = place(b, 7, 7, 'A');
    // Place T under A (V direction), forming both "AT" (V) and no cross
    const ps = [P(8, 7, 'T')];
    const words = extractAllFormedWords(b, ps, 'V');
    expect(words.map(w => w.word).sort()).toEqual(['AT']);
  });

  it('extracts main word with existing tile inside', () => {
    let b = createEmptyBoard();
    b = place(b, 7, 7, 'A');
    // Place C to the left and T to the right, using existing A
    const ps = [P(7, 6, 'C'), P(7, 8, 'T')];
    const words = extractAllFormedWords(b, ps, 'H');
    expect(words.map(w => w.word)).toEqual(['CAT']);
  });

  it('extracts perpendicular cross words for each placement that creates one', () => {
    let b = createEmptyBoard();
    // Existing horizontal word: "CAT" at row 7 cols 6-8
    b = place(b, 7, 6, 'C');
    b = place(b, 7, 7, 'A');
    b = place(b, 7, 8, 'T');
    // Place "AB" vertically starting at (7,7) — but (7,7) already has A
    // Instead, place "BAT" vertically at col 7: B at (6,7), then use existing A at (7,7), T at (8,7)
    const ps = [P(6, 7, 'B'), P(8, 7, 'T')];
    // Wait — this direction placements aren't contiguous in board through (7,7)? They are: 6, 7, 8 all in col 7.
    const words = extractAllFormedWords(b, ps, 'V');
    // Main: BAT. Cross words at B(6,7) and T(8,7) each single letter → not counted.
    expect(words.map(w => w.word).sort()).toEqual(['BAT']);
  });

  it('ignores 1-letter cross fragments', () => {
    let b = createEmptyBoard();
    b = place(b, 7, 7, 'A');
    const ps = [P(7, 8, 'T')];
    const words = extractAllFormedWords(b, ps, 'H');
    // Main word: AT. Cross at (7,8) is only "T" — not a word.
    expect(words.map(w => w.word)).toEqual(['AT']);
  });
});
```

- [ ] **Step 2: Verify tests fail**

Run: `npx vitest run tests/rules.test.ts`
Expected: FAIL (extractAllFormedWords returns [])

- [ ] **Step 3: Replace placeholder with real implementation**

Replace the placeholder `extractAllFormedWords` in `src/game/rules.ts`:

```typescript
import { LETTER_POINTS } from './board';

function tileLetter(tile: Tile): string {
  return tile.kind === 'letter' ? tile.letter : (tile.assigned ?? '?');
}

function tileScore(tile: Tile): number {
  return tile.kind === 'letter' ? tile.points : 0;
}

function scanWord(
  board: Board,
  pendingMap: Map<string, PendingPlacement>,
  start: Coord,
  direction: Direction,
): { tiles: { coord: Coord; tile: Tile; fromPending: boolean }[]; startCoord: Coord } {
  // Walk backwards to find the true start
  const step = direction === 'H' ? { r: 0, c: -1 } : { r: -1, c: 0 };
  let cur: Coord = { ...start };
  while (true) {
    const prev: Coord = { r: cur.r + step.r, c: cur.c + step.c };
    if (prev.r < 0 || prev.r > 14 || prev.c < 0 || prev.c > 14) break;
    const key = `${prev.r},${prev.c}`;
    const existing = board[prev.r][prev.c];
    const pending = pendingMap.get(key);
    if (existing === null && !pending) break;
    cur = prev;
  }
  const startCoord = { ...cur };

  // Walk forward collecting tiles
  const forward = direction === 'H' ? { r: 0, c: 1 } : { r: 1, c: 0 };
  const tiles: { coord: Coord; tile: Tile; fromPending: boolean }[] = [];
  while (cur.r >= 0 && cur.r <= 14 && cur.c >= 0 && cur.c <= 14) {
    const key = `${cur.r},${cur.c}`;
    const pending = pendingMap.get(key);
    const existing = board[cur.r][cur.c];
    if (pending) {
      tiles.push({ coord: { ...cur }, tile: pending.tile, fromPending: true });
    } else if (existing) {
      tiles.push({ coord: { ...cur }, tile: existing.tile, fromPending: false });
    } else {
      break;
    }
    cur = { r: cur.r + forward.r, c: cur.c + forward.c };
  }
  return { tiles, startCoord };
}

function scoreWordTiles(tiles: { coord: Coord; tile: Tile; fromPending: boolean }[]): {
  wordMultiplier: number;
  finalScore: number;
} {
  let sum = 0;
  let wordMultiplier = 1;
  for (const { coord, tile, fromPending } of tiles) {
    let letterScore = tileScore(tile);
    if (fromPending) {
      const premium = PREMIUM_BOARD[coord.r][coord.c];
      if (premium === 'DL') letterScore *= 2;
      else if (premium === 'TL') letterScore *= 3;
      else if (premium === 'DW' || premium === 'STAR') wordMultiplier *= 2;
      else if (premium === 'TW') wordMultiplier *= 3;
    }
    sum += letterScore;
  }
  return { wordMultiplier, finalScore: sum * wordMultiplier };
}

export function extractAllFormedWords(
  board: Board,
  placements: PendingPlacement[],
  direction: Direction,
): FormedWord[] {
  if (placements.length === 0) return [];
  const pendingMap = new Map<string, PendingPlacement>();
  for (const p of placements) pendingMap.set(`${p.coord.r},${p.coord.c}`, p);

  const words: FormedWord[] = [];

  // Main word (only if it has length >= 2)
  const main = scanWord(board, pendingMap, placements[0].coord, direction);
  if (main.tiles.length >= 2) {
    const word = main.tiles.map(t => tileLetter(t.tile)).join('');
    const { wordMultiplier, finalScore } = scoreWordTiles(main.tiles);
    words.push({ word, tiles: main.tiles, wordMultiplier, finalScore });
  }

  // Cross words at each placement
  const perpendicular: Direction = direction === 'H' ? 'V' : 'H';
  for (const p of placements) {
    const cross = scanWord(board, pendingMap, p.coord, perpendicular);
    if (cross.tiles.length >= 2) {
      const word = cross.tiles.map(t => tileLetter(t.tile)).join('');
      const { wordMultiplier, finalScore } = scoreWordTiles(cross.tiles);
      words.push({ word, tiles: cross.tiles, wordMultiplier, finalScore });
    }
  }

  return words;
}
```

- [ ] **Step 4: Verify all rules tests pass**

Run: `npx vitest run tests/rules.test.ts`
Expected: PASS (all tests including geometry + extraction)

- [ ] **Step 5: Commit**

```bash
git add src/game/rules.ts tests/rules.test.ts
git commit -m "feat(rules): extract main and cross words with scoring"
```

## Task 3.4: Scoring — premium squares, blanks, Bingo

**Files:**
- Modify: `scrabble/tests/rules.test.ts`

- [ ] **Step 1: Add scoring tests**

Append to `tests/rules.test.ts`:

```typescript
describe('validatePlacement — scoring', () => {
  const scoringDict = createDictionaryFromText('CAT\nCATS\nBAT\nBATH\nQI\nQUIZ\n');

  it('applies DL to a new tile', () => {
    // Center is STAR (DW), (7,3) is DL. Place "CAB" at row 3 col 0..2 — actually first move must go through center.
    // Simplify: first move CAT at row 7 cols 6..8, C on DL(7,3)? No — 7,3 is DL, but center is 7,7.
    // Use first move CAT at row 7 cols 6-8 covering STAR. Then in a follow-up test we can verify subsequent placement premium effects.
    const ps = [P(7, 6, 'C'), P(7, 7, 'A'), P(7, 8, 'T')];
    const res = validatePlacement(createEmptyBoard(), ps, scoringDict, true);
    // Points: C=3, A=1, T=1. sum=5. STAR at (7,7) → wordMult *= 2. finalScore = 5*2 = 10.
    expect(res).toMatchObject({ ok: true, score: 10 });
  });

  it('applies DL on a new tile in a simple case', () => {
    // (3,0) is DL. Set up: existing tile at (2,0) = 'A', place new tiles "T","S" at (3,0),(4,0) forming "ATS" vertically.
    let b = createEmptyBoard();
    b = place(b, 2, 0, 'A');
    const ps = [P(3, 0, 'T'), P(4, 0, 'S')];
    const dictLocal = createDictionaryFromText('ATS\nAT\nAS\n');
    const res = validatePlacement(b, ps, dictLocal, false);
    // Word: ATS. A=1(existing, no premium), T=1 on DL(3,0)*2=2, S=1(no premium). sum=4. No word mult. Score=4.
    expect(res).toMatchObject({ ok: true, score: 4 });
  });

  it('adds 50 bonus for Bingo (7-tile play)', () => {
    // Construct any legal 7-tile first move through center. Simplest: 7 tiles at row 7 cols 4..10.
    // Word "SCRABBLE" is 8 letters; use a 7-letter word. Use dictionary word "QUIZZES" — not in TWL for this test.
    // Use "CATBATS"? Not a word. For the sake of the test, add "AEIOUST" to dictionary as a made-up 7-letter word.
    const dictLocal = createDictionaryFromText('AEIOUST\n');
    const ps = [
      P(7, 4, 'A'), P(7, 5, 'E'), P(7, 6, 'I'), P(7, 7, 'O'),
      P(7, 8, 'U'), P(7, 9, 'S'), P(7, 10, 'T'),
    ];
    const res = validatePlacement(createEmptyBoard(), ps, dictLocal, true);
    // Word "AEIOUST": A=1,E=1,I=1,O=1,U=1,S=1,T=1 = 7. STAR at (7,7) → mult*=2 → 14. Bingo +50 → 64.
    expect(res).toMatchObject({ ok: true, score: 64 });
  });

  it('scores blank tile as 0 points', () => {
    const dictLocal = createDictionaryFromText('CAT\n');
    const blankA: Tile = { kind: 'blank', assigned: 'A', points: 0 };
    const ps: PendingPlacement[] = [
      { coord: { r: 7, c: 6 }, tile: T('C'), rackIndex: 0 },
      { coord: { r: 7, c: 7 }, tile: blankA, rackIndex: 1 },
      { coord: { r: 7, c: 8 }, tile: T('T'), rackIndex: 2 },
    ];
    const res = validatePlacement(createEmptyBoard(), ps, dictLocal, true);
    // C=3, A=0 (blank), T=1. STAR → *2. = 8.
    expect(res).toMatchObject({ ok: true, score: 8 });
  });
});
```

- [ ] **Step 2: Run and iterate until all scoring tests pass**

Run: `npx vitest run tests/rules.test.ts`
Expected: PASS (all). If failures, debug the scoring path in `scoreWordTiles` — likely edge cases around blanks or premium application on existing tiles.

- [ ] **Step 3: Commit**

```bash
git add tests/rules.test.ts
git commit -m "test(rules): verify DL, Bingo, and blank tile scoring"
```

---

# M4: Reducer — State Machine

## Task 4.1: `createInitialState` + `START_GAME`

**Files:**
- Create: `scrabble/src/game/reducer.ts`
- Create: `scrabble/tests/reducer.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/reducer.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { reducer, createInitialState } from '../src/game/reducer';
import { createDictionaryFromText } from '../src/game/dictionary';

const dict = createDictionaryFromText('CAT\nCATS\nAT\nBAT\nCAB\nCABS\nAB\n');

describe('createInitialState', () => {
  it('has status "setup" before START_GAME', () => {
    const s = createInitialState({ seed: 1, dict });
    expect(s.status).toBe('setup');
    expect(s.board.flat().every(c => c === null)).toBe(true);
    expect(s.bag).toHaveLength(100);
    expect(s.players[0].rack).toHaveLength(0);
  });
});

describe('reducer / START_GAME', () => {
  it('deals 7 tiles to each player, sets status playing, currentPlayerIndex=0', () => {
    const initial = createInitialState({ seed: 1, dict });
    const next = reducer(initial, { type: 'START_GAME', mode: 'free' });
    expect(next.status).toBe('playing');
    expect(next.mode).toBe('free');
    expect(next.players[0].rack).toHaveLength(7);
    expect(next.players[1].rack).toHaveLength(7);
    expect(next.bag).toHaveLength(100 - 14);
    expect(next.currentPlayerIndex).toBe(0);
    expect(next.turn).toBe(1);
  });
});
```

- [ ] **Step 2: Verify test fails**

Run: `npx vitest run tests/reducer.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create `src/game/reducer.ts`**

```typescript
import type { GameState, GameMode, Player, PendingPlacement, Move, MoveRecord } from './types';
import { createEmptyBoard } from './board';
import { createBag, drawTiles, seededRng, type Rng } from './bag';
import { validatePlacement, extractAllFormedWords, detectDirection } from './rules';
import type { Dictionary } from './dictionary';

export type Deps = { dict: Dictionary; rng: Rng };

export function createInitialState(opts: { seed: number; dict: Dictionary }): GameState {
  const rng = seededRng(opts.seed);
  return {
    mode: 'free',
    status: 'setup',
    board: createEmptyBoard(),
    bag: createBag(rng),
    players: [
      { id: 'P1', name: 'Player 1', score: 0, rack: [] },
      { id: 'COM', name: 'COM', score: 0, rack: [] },
    ],
    currentPlayerIndex: 0,
    turn: 0,
    pending: [],
    history: [],
    lastFormedWords: [],
    consecutivePasses: 0,
    lastError: null,
  };
}

export type Action =
  | { type: 'START_GAME'; mode: GameMode }
  | { type: 'PLACE_PENDING'; placement: PendingPlacement }
  | { type: 'RECALL_PENDING'; coord: { r: number; c: number } }
  | { type: 'RECALL_ALL' }
  | { type: 'COMMIT_PLAY'; dict: Dictionary }
  | { type: 'EXCHANGE'; indices: number[]; rng: Rng }
  | { type: 'PASS' }
  | { type: 'SHUFFLE_RACK'; rng: Rng }
  | { type: 'CLEAR_ERROR' };

export function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'START_GAME': {
      const [p1Rack, afterP1] = drawTiles(state.bag, 7);
      const [comRack, afterCom] = drawTiles(afterP1, 7);
      return {
        ...state,
        mode: action.mode,
        status: 'playing',
        bag: afterCom,
        players: [
          { ...state.players[0], rack: p1Rack, score: 0 },
          { ...state.players[1], rack: comRack, score: 0 },
        ],
        currentPlayerIndex: 0,
        turn: 1,
        pending: [],
        history: [],
        lastFormedWords: [],
        consecutivePasses: 0,
        lastError: null,
      };
    }
    default:
      return state;
  }
}
```

- [ ] **Step 4: Verify test passes**

Run: `npx vitest run tests/reducer.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/game/reducer.ts tests/reducer.test.ts
git commit -m "feat(reducer): initial state and START_GAME action"
```

## Task 4.2: `PLACE_PENDING`, `RECALL_PENDING`, `RECALL_ALL`, `SHUFFLE_RACK`

**Files:**
- Modify: `scrabble/src/game/reducer.ts`
- Modify: `scrabble/tests/reducer.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `tests/reducer.test.ts`:

```typescript
import { seededRng } from '../src/game/bag';

describe('reducer / PLACE_PENDING & RECALL', () => {
  const initial = reducer(createInitialState({ seed: 1, dict }), { type: 'START_GAME', mode: 'free' });

  it('PLACE_PENDING adds to pending and removes from rack', () => {
    const tile = initial.players[0].rack[0];
    const next = reducer(initial, {
      type: 'PLACE_PENDING',
      placement: { coord: { r: 7, c: 7 }, tile, rackIndex: 0 },
    });
    expect(next.pending).toHaveLength(1);
    expect(next.players[0].rack).toHaveLength(6);
  });

  it('RECALL_ALL restores all pending tiles to rack', () => {
    const tile = initial.players[0].rack[0];
    const placed = reducer(initial, {
      type: 'PLACE_PENDING',
      placement: { coord: { r: 7, c: 7 }, tile, rackIndex: 0 },
    });
    const recalled = reducer(placed, { type: 'RECALL_ALL' });
    expect(recalled.pending).toHaveLength(0);
    expect(recalled.players[0].rack).toHaveLength(7);
  });

  it('RECALL_PENDING restores a single tile by coord', () => {
    const t0 = initial.players[0].rack[0];
    const t1 = initial.players[0].rack[1];
    let s = reducer(initial, {
      type: 'PLACE_PENDING',
      placement: { coord: { r: 7, c: 7 }, tile: t0, rackIndex: 0 },
    });
    s = reducer(s, {
      type: 'PLACE_PENDING',
      placement: { coord: { r: 7, c: 8 }, tile: t1, rackIndex: 1 },
    });
    const recalled = reducer(s, { type: 'RECALL_PENDING', coord: { r: 7, c: 7 } });
    expect(recalled.pending).toHaveLength(1);
    expect(recalled.players[0].rack).toHaveLength(6);
  });
});

describe('reducer / SHUFFLE_RACK', () => {
  it('reorders rack deterministically with same rng seed', () => {
    const s0 = reducer(createInitialState({ seed: 1, dict }), { type: 'START_GAME', mode: 'free' });
    const s1 = reducer(s0, { type: 'SHUFFLE_RACK', rng: seededRng(999) });
    const s2 = reducer(s0, { type: 'SHUFFLE_RACK', rng: seededRng(999) });
    expect(s1.players[0].rack).toEqual(s2.players[0].rack);
    expect(s1.players[0].rack).toHaveLength(7);
  });
});
```

- [ ] **Step 2: Verify tests fail**

Run: `npx vitest run tests/reducer.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement in reducer**

Add cases inside the `switch` in `src/game/reducer.ts`:

```typescript
    case 'PLACE_PENDING': {
      const p = state.players[state.currentPlayerIndex];
      const newRack = [...p.rack];
      newRack.splice(action.placement.rackIndex, 1);
      // Renumber remaining rackIndex references in pending is not needed because
      // we always reference the tile identity, not the index, on recall.
      const newPending = [...state.pending, action.placement];
      const newPlayers = [...state.players] as GameState['players'];
      newPlayers[state.currentPlayerIndex] = { ...p, rack: newRack };
      return { ...state, players: newPlayers, pending: newPending, lastError: null };
    }
    case 'RECALL_PENDING': {
      const { r, c } = action.coord;
      const removed = state.pending.find(p => p.coord.r === r && p.coord.c === c);
      if (!removed) return state;
      const p = state.players[state.currentPlayerIndex];
      const newRack = [...p.rack, removed.tile];
      const newPending = state.pending.filter(p2 => !(p2.coord.r === r && p2.coord.c === c));
      const newPlayers = [...state.players] as GameState['players'];
      newPlayers[state.currentPlayerIndex] = { ...p, rack: newRack };
      return { ...state, players: newPlayers, pending: newPending };
    }
    case 'RECALL_ALL': {
      if (state.pending.length === 0) return state;
      const p = state.players[state.currentPlayerIndex];
      const newRack = [...p.rack, ...state.pending.map(x => x.tile)];
      const newPlayers = [...state.players] as GameState['players'];
      newPlayers[state.currentPlayerIndex] = { ...p, rack: newRack };
      return { ...state, players: newPlayers, pending: [] };
    }
    case 'SHUFFLE_RACK': {
      const p = state.players[state.currentPlayerIndex];
      const rack = [...p.rack];
      for (let i = rack.length - 1; i > 0; i--) {
        const j = Math.floor(action.rng() * (i + 1));
        [rack[i], rack[j]] = [rack[j], rack[i]];
      }
      const newPlayers = [...state.players] as GameState['players'];
      newPlayers[state.currentPlayerIndex] = { ...p, rack };
      return { ...state, players: newPlayers };
    }
    case 'CLEAR_ERROR':
      return { ...state, lastError: null };
```

- [ ] **Step 4: Verify tests pass**

Run: `npx vitest run tests/reducer.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/game/reducer.ts tests/reducer.test.ts
git commit -m "feat(reducer): pending placement, recall, and rack shuffle"
```

## Task 4.3: `COMMIT_PLAY`

**Files:**
- Modify: `scrabble/src/game/reducer.ts`
- Modify: `scrabble/tests/reducer.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `tests/reducer.test.ts`:

```typescript
import type { Tile } from '../src/game/types';

// Utility to force a specific rack for deterministic COMMIT tests
function withRack(state: any, playerIndex: 0 | 1, letters: string[]) {
  const rack: Tile[] = letters.map(l => ({ kind: 'letter', letter: l as any, points: 1 }));
  const newPlayers = [...state.players];
  newPlayers[playerIndex] = { ...newPlayers[playerIndex], rack };
  return { ...state, players: newPlayers };
}

describe('reducer / COMMIT_PLAY', () => {
  it('places pending tiles on board, awards score, switches turn, redraws to 7', () => {
    let s = reducer(createInitialState({ seed: 1, dict }), { type: 'START_GAME', mode: 'free' });
    s = withRack(s, 0, ['C', 'A', 'T', 'X', 'Y', 'Z', 'Q']);
    s = reducer(s, { type: 'PLACE_PENDING', placement: { coord: { r: 7, c: 6 }, tile: s.players[0].rack[0], rackIndex: 0 } });
    s = reducer(s, { type: 'PLACE_PENDING', placement: { coord: { r: 7, c: 7 }, tile: s.players[0].rack[0], rackIndex: 0 } });
    s = reducer(s, { type: 'PLACE_PENDING', placement: { coord: { r: 7, c: 8 }, tile: s.players[0].rack[0], rackIndex: 0 } });

    const committed = reducer(s, { type: 'COMMIT_PLAY', dict });
    expect(committed.pending).toHaveLength(0);
    expect(committed.board[7][6]?.tile).toMatchObject({ letter: 'C' });
    expect(committed.board[7][7]?.tile).toMatchObject({ letter: 'A' });
    expect(committed.board[7][8]?.tile).toMatchObject({ letter: 'T' });
    expect(committed.players[0].score).toBeGreaterThan(0);
    expect(committed.players[0].rack).toHaveLength(7); // redrawn
    expect(committed.currentPlayerIndex).toBe(1);
    expect(committed.turn).toBe(2);
    expect(committed.history).toHaveLength(1);
    expect(committed.consecutivePasses).toBe(0);
    expect(committed.lastFormedWords.map(w => w.word)).toContain('CAT');
  });

  it('sets lastError and does not change board on invalid word', () => {
    let s = reducer(createInitialState({ seed: 1, dict }), { type: 'START_GAME', mode: 'free' });
    s = withRack(s, 0, ['X', 'Y', 'Z', 'A', 'B', 'C', 'D']);
    s = reducer(s, { type: 'PLACE_PENDING', placement: { coord: { r: 7, c: 6 }, tile: s.players[0].rack[0], rackIndex: 0 } });
    s = reducer(s, { type: 'PLACE_PENDING', placement: { coord: { r: 7, c: 7 }, tile: s.players[0].rack[0], rackIndex: 0 } });
    s = reducer(s, { type: 'PLACE_PENDING', placement: { coord: { r: 7, c: 8 }, tile: s.players[0].rack[0], rackIndex: 0 } });

    const bad = reducer(s, { type: 'COMMIT_PLAY', dict });
    expect(bad.lastError).toBeTruthy();
    expect(bad.board.flat().every(c => c === null)).toBe(true);
    expect(bad.pending).toHaveLength(3); // pending preserved for user to fix
    expect(bad.currentPlayerIndex).toBe(0); // no turn change
  });
});
```

- [ ] **Step 2: Verify tests fail**

Run: `npx vitest run tests/reducer.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `COMMIT_PLAY`**

Add case inside the switch:

```typescript
    case 'COMMIT_PLAY': {
      const p = state.players[state.currentPlayerIndex];
      const isFirstMove = state.board.flat().every(c => c === null);
      const result = validatePlacement(state.board, state.pending, action.dict, isFirstMove);
      if (!result.ok) {
        return { ...state, lastError: result.reason };
      }

      // Apply placements to board
      const newBoard = state.board.map(row => [...row]);
      for (const pl of state.pending) {
        newBoard[pl.coord.r][pl.coord.c] = { tile: pl.tile, placedTurn: state.turn };
      }

      // Redraw to 7
      const drawCount = 7 - p.rack.length;
      const [drawn, newBag] = drawTiles(state.bag, drawCount);
      const newRack = [...p.rack, ...drawn];

      // Update player score
      const newPlayers = [...state.players] as GameState['players'];
      newPlayers[state.currentPlayerIndex] = {
        ...p,
        rack: newRack,
        score: p.score + result.score,
      };

      const record: MoveRecord = {
        player: p.id,
        move: { kind: 'place', placements: state.pending },
        wordsFormed: result.formedWords.map(w => w.word),
        score: result.score,
      };

      const nextIndex = (state.currentPlayerIndex === 0 ? 1 : 0) as 0 | 1;

      return {
        ...state,
        board: newBoard,
        bag: newBag,
        players: newPlayers,
        pending: [],
        currentPlayerIndex: nextIndex,
        turn: state.turn + 1,
        history: [...state.history, record],
        lastFormedWords: result.formedWords,
        consecutivePasses: 0,
        lastError: null,
      };
    }
```

- [ ] **Step 4: Verify tests pass**

Run: `npx vitest run tests/reducer.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/game/reducer.ts tests/reducer.test.ts
git commit -m "feat(reducer): commit play with scoring, redraw, and turn switch"
```

## Task 4.4: `EXCHANGE`, `PASS`, game end

**Files:**
- Modify: `scrabble/src/game/reducer.ts`
- Modify: `scrabble/tests/reducer.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `tests/reducer.test.ts`:

```typescript
describe('reducer / EXCHANGE', () => {
  it('swaps selected rack tiles with new draws when bag has >= 7 tiles', () => {
    let s = reducer(createInitialState({ seed: 1, dict }), { type: 'START_GAME', mode: 'free' });
    const originalRack = [...s.players[0].rack];
    const beforeBag = s.bag.length;
    s = reducer(s, { type: 'EXCHANGE', indices: [0, 1, 2], rng: seededRng(7) });
    expect(s.players[0].rack).toHaveLength(7);
    expect(s.bag.length).toBe(beforeBag); // 3 out, 3 in
    // Original rack indices 3..6 should be preserved
    expect(s.players[0].rack.slice(0, 4)).toEqual(originalRack.slice(3));
    expect(s.currentPlayerIndex).toBe(1);
    expect(s.consecutivePasses).toBe(0);
  });

  it('rejects EXCHANGE when bag has < 7 tiles remaining', () => {
    let s = createInitialState({ seed: 1, dict });
    s = reducer(s, { type: 'START_GAME', mode: 'free' });
    // Manually shrink bag to 6
    s = { ...s, bag: s.bag.slice(0, 6) };
    const next = reducer(s, { type: 'EXCHANGE', indices: [0], rng: seededRng(1) });
    expect(next.lastError).toBeTruthy();
    expect(next.players[0].rack).toHaveLength(7); // unchanged
    expect(next.currentPlayerIndex).toBe(0);
  });
});

describe('reducer / PASS', () => {
  it('increments consecutivePasses and switches turn', () => {
    let s = reducer(createInitialState({ seed: 1, dict }), { type: 'START_GAME', mode: 'free' });
    s = reducer(s, { type: 'PASS' });
    expect(s.consecutivePasses).toBe(1);
    expect(s.currentPlayerIndex).toBe(1);
    s = reducer(s, { type: 'PASS' });
    expect(s.consecutivePasses).toBe(2);
  });

  it('ends game after 6 consecutive passes', () => {
    let s = reducer(createInitialState({ seed: 1, dict }), { type: 'START_GAME', mode: 'free' });
    for (let i = 0; i < 6; i++) s = reducer(s, { type: 'PASS' });
    expect(s.status).toBe('ended');
  });

  it('ends game when a player empties rack and bag is empty', () => {
    let s = reducer(createInitialState({ seed: 1, dict }), { type: 'START_GAME', mode: 'free' });
    // Force bag empty and P1 rack empty via manual state mutation (test-only)
    s = { ...s, bag: [], players: [{ ...s.players[0], rack: [] }, s.players[1]] };
    s = reducer(s, { type: 'PASS' });
    expect(s.status).toBe('ended');
  });
});
```

- [ ] **Step 2: Verify tests fail**

Run: `npx vitest run tests/reducer.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement EXCHANGE and PASS with end-game check**

Add these cases and a helper:

```typescript
function nextPlayerAndCheckEnd(state: GameState, nextIndex: 0 | 1, consecutivePasses: number): Partial<GameState> {
  const anyEmptyRack = state.players.some(p => p.rack.length === 0);
  const bagEmpty = state.bag.length === 0;
  const endedByPasses = consecutivePasses >= 6;
  const endedByEmpty = anyEmptyRack && bagEmpty;
  if (endedByPasses || endedByEmpty) {
    // Adjust final scores: each remaining tile subtracted from that player
    const adjusted = state.players.map(p => {
      const remainingPoints = p.rack.reduce((sum, t) => sum + (t.kind === 'letter' ? t.points : 0), 0);
      return { ...p, score: p.score - remainingPoints };
    }) as GameState['players'];
    // If ended by empty rack, winner gets all opponents' remaining tile points added
    if (endedByEmpty) {
      const emptyIdx = state.players.findIndex(p => p.rack.length === 0);
      const otherIdx = emptyIdx === 0 ? 1 : 0;
      const otherRemaining = state.players[otherIdx].rack.reduce((s, t) => s + (t.kind === 'letter' ? t.points : 0), 0);
      adjusted[emptyIdx] = { ...adjusted[emptyIdx], score: adjusted[emptyIdx].score + otherRemaining };
    }
    return { status: 'ended', players: adjusted, currentPlayerIndex: nextIndex, consecutivePasses };
  }
  return { currentPlayerIndex: nextIndex, consecutivePasses };
}
```

```typescript
    case 'EXCHANGE': {
      if (state.bag.length < 7) return { ...state, lastError: '袋の残りが 7 枚未満のため交換できません' };
      const p = state.players[state.currentPlayerIndex];
      const keep = p.rack.filter((_, i) => !action.indices.includes(i));
      const removed = p.rack.filter((_, i) => action.indices.includes(i));
      // Add removed tiles back to the bag, shuffle, then redraw
      const newBag = [...state.bag, ...removed];
      for (let i = newBag.length - 1; i > 0; i--) {
        const j = Math.floor(action.rng() * (i + 1));
        [newBag[i], newBag[j]] = [newBag[j], newBag[i]];
      }
      const [drawn, afterDraw] = drawTiles(newBag, action.indices.length);
      const newRack = [...keep, ...drawn];
      const newPlayers = [...state.players] as GameState['players'];
      newPlayers[state.currentPlayerIndex] = { ...p, rack: newRack };

      const nextIndex = (state.currentPlayerIndex === 0 ? 1 : 0) as 0 | 1;
      const endInfo = nextPlayerAndCheckEnd({ ...state, players: newPlayers, bag: afterDraw }, nextIndex, 0);
      return {
        ...state,
        players: newPlayers,
        bag: afterDraw,
        pending: [],
        turn: state.turn + 1,
        history: [...state.history, { player: p.id, move: { kind: 'exchange', tileIndices: action.indices }, wordsFormed: [], score: 0 }],
        lastError: null,
        ...endInfo,
      };
    }
    case 'PASS': {
      const p = state.players[state.currentPlayerIndex];
      const nextIndex = (state.currentPlayerIndex === 0 ? 1 : 0) as 0 | 1;
      const newConsecutive = state.consecutivePasses + 1;
      const endInfo = nextPlayerAndCheckEnd(state, nextIndex, newConsecutive);
      return {
        ...state,
        turn: state.turn + 1,
        history: [...state.history, { player: p.id, move: { kind: 'pass' }, wordsFormed: [], score: 0 }],
        lastError: null,
        ...endInfo,
      };
    }
```

- [ ] **Step 4: Verify tests pass**

Run: `npx vitest run tests/reducer.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/game/reducer.ts tests/reducer.test.ts
git commit -m "feat(reducer): exchange, pass, and end-game score adjustment"
```

---

# M5: UI Shell — Board / Tile / Rack / ScorePanel

## Task 5.1: Static `<Tile>` component

**Files:**
- Create: `scrabble/src/ui/Tile.tsx`
- Create: `scrabble/tests/ui/Tile.test.tsx`

- [ ] **Step 1: Write failing test**

Create `tests/ui/Tile.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Tile } from '../../src/ui/Tile';

describe('<Tile>', () => {
  it('renders letter and points for a letter tile', () => {
    render(<Tile tile={{ kind: 'letter', letter: 'A', points: 1 }} variant="in-rack" />);
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('renders assigned letter of a blank tile without points', () => {
    render(<Tile tile={{ kind: 'blank', assigned: 'B', points: 0 }} variant="on-board-confirmed" />);
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('renders "?" for an unassigned blank tile', () => {
    render(<Tile tile={{ kind: 'blank', assigned: null, points: 0 }} variant="in-rack" />);
    expect(screen.getByText('?')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Verify test fails**

Run: `npx vitest run tests/ui/Tile.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Create `src/ui/Tile.tsx`**

```tsx
import type { Tile as TileType } from '../game/types';

export type TileVariant =
  | 'in-rack'
  | 'in-rack-selected'
  | 'on-board-confirmed'
  | 'on-board-pending';

const VARIANT_CLASSES: Record<TileVariant, string> = {
  'in-rack': 'bg-tile-wood text-stone-900 shadow-[2px_2px_0_rgba(0,0,0,0.4)]',
  'in-rack-selected': 'bg-tile-wood text-stone-900 ring-4 ring-yellow-300 shadow-[2px_2px_0_rgba(0,0,0,0.4)]',
  'on-board-confirmed': 'bg-tile-wood text-stone-900 shadow-[1px_1px_0_rgba(0,0,0,0.4)]',
  'on-board-pending': 'bg-yellow-100 text-stone-900 ring-2 ring-yellow-500',
};

export function Tile({ tile, variant }: { tile: TileType; variant: TileVariant }) {
  const displayLetter =
    tile.kind === 'letter' ? tile.letter : (tile.assigned ?? '?');
  const showPoints = tile.kind === 'letter';
  return (
    <div
      className={`relative w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center font-bold text-lg select-none ${VARIANT_CLASSES[variant]}`}
    >
      <span>{displayLetter}</span>
      {showPoints && (
        <span className="absolute bottom-0 right-0.5 text-[8px] font-normal">
          {tile.points}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Verify test passes**

Run: `npx vitest run tests/ui/Tile.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ui/Tile.tsx tests/ui/Tile.test.tsx
git commit -m "feat(ui): add Tile component with 4 variants"
```

## Task 5.2: `<Board>` grid rendering

**Files:**
- Create: `scrabble/src/ui/Board.tsx`
- Create: `scrabble/tests/ui/Board.test.tsx`

- [ ] **Step 1: Write failing test**

Create `tests/ui/Board.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Board } from '../../src/ui/Board';
import { createEmptyBoard } from '../../src/game/board';

describe('<Board>', () => {
  it('renders 225 cells (15x15)', () => {
    render(<Board board={createEmptyBoard()} pending={[]} onCellClick={() => {}} />);
    const cells = screen.getAllByRole('gridcell');
    expect(cells).toHaveLength(225);
  });

  it('marks the center cell with a star', () => {
    render(<Board board={createEmptyBoard()} pending={[]} onCellClick={() => {}} />);
    expect(screen.getByLabelText('center-star')).toBeInTheDocument();
  });

  it('renders a placed tile', () => {
    const b = createEmptyBoard();
    b[7][7] = { tile: { kind: 'letter', letter: 'A', points: 1 }, placedTurn: 1 };
    render(<Board board={b} pending={[]} onCellClick={() => {}} />);
    expect(screen.getByText('A')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Verify test fails**

Run: `npx vitest run tests/ui/Board.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Create `src/ui/Board.tsx`**

```tsx
import type { Board as BoardType, PendingPlacement } from '../game/types';
import { PREMIUM_BOARD } from '../game/board';
import { Tile } from './Tile';

const PREMIUM_LABEL: Record<string, { label: string; className: string }> = {
  DL: { label: 'DL', className: 'bg-premium-dl' },
  TL: { label: 'TL', className: 'bg-premium-tl text-white' },
  DW: { label: 'DW', className: 'bg-premium-dw' },
  TW: { label: 'TW', className: 'bg-premium-tw text-white' },
  STAR: { label: '★', className: 'bg-premium-dw' },
};

export function Board({
  board,
  pending,
  onCellClick,
}: {
  board: BoardType;
  pending: PendingPlacement[];
  onCellClick: (r: number, c: number) => void;
}) {
  const pendingMap = new Map<string, PendingPlacement>();
  for (const p of pending) pendingMap.set(`${p.coord.r},${p.coord.c}`, p);

  return (
    <div
      role="grid"
      className="inline-grid gap-px bg-board-bg p-1"
      style={{ gridTemplateColumns: 'repeat(15, minmax(0, 1fr))' }}
    >
      {board.flatMap((row, r) =>
        row.map((cell, c) => {
          const premium = PREMIUM_BOARD[r][c];
          const premiumInfo = premium ? PREMIUM_LABEL[premium] : null;
          const pendingHere = pendingMap.get(`${r},${c}`);
          return (
            <button
              key={`${r},${c}`}
              role="gridcell"
              aria-label={`cell-${r}-${c}`}
              className={`w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-[8px] font-pixel ${
                cell || pendingHere ? '' : premiumInfo?.className ?? 'bg-cell-bg'
              }`}
              onClick={() => onCellClick(r, c)}
            >
              {cell ? (
                <Tile tile={cell.tile} variant="on-board-confirmed" />
              ) : pendingHere ? (
                <Tile tile={pendingHere.tile} variant="on-board-pending" />
              ) : premium === 'STAR' ? (
                <span aria-label="center-star">★</span>
              ) : (
                <span>{premiumInfo?.label ?? ''}</span>
              )}
            </button>
          );
        }),
      )}
    </div>
  );
}
```

- [ ] **Step 4: Verify test passes**

Run: `npx vitest run tests/ui/Board.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ui/Board.tsx tests/ui/Board.test.tsx
git commit -m "feat(ui): add Board grid with premium squares"
```

## Task 5.3: `<Rack>` and `<ScorePanel>`

**Files:**
- Create: `scrabble/src/ui/Rack.tsx`
- Create: `scrabble/src/ui/ScorePanel.tsx`
- Create: `scrabble/tests/ui/Rack.test.tsx`
- Create: `scrabble/tests/ui/ScorePanel.test.tsx`

- [ ] **Step 1: Write failing tests**

`tests/ui/Rack.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Rack } from '../../src/ui/Rack';
import type { Tile } from '../../src/game/types';

const rack: Tile[] = [
  { kind: 'letter', letter: 'A', points: 1 },
  { kind: 'letter', letter: 'B', points: 3 },
  { kind: 'blank', assigned: null, points: 0 },
];

describe('<Rack>', () => {
  it('renders one tile per rack entry', () => {
    render(<Rack rack={rack} selectedIndex={null} onSelect={() => {}} />);
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });

  it('calls onSelect with the tile index on click', () => {
    const onSelect = vi.fn();
    render(<Rack rack={rack} selectedIndex={null} onSelect={onSelect} />);
    fireEvent.click(screen.getAllByRole('button')[1]);
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it('highlights the selected tile', () => {
    render(<Rack rack={rack} selectedIndex={0} onSelect={() => {}} />);
    const btn = screen.getAllByRole('button')[0];
    expect(btn.className).toMatch(/ring/);
  });
});
```

`tests/ui/ScorePanel.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScorePanel } from '../../src/ui/ScorePanel';

describe('<ScorePanel>', () => {
  it('renders both scores and bag remaining', () => {
    render(<ScorePanel p1Score={12} comScore={34} bagRemaining={56} currentPlayerId="P1" />);
    expect(screen.getByText(/P1/)).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('34')).toBeInTheDocument();
    expect(screen.getByText(/56/)).toBeInTheDocument();
  });

  it('marks the current player', () => {
    render(<ScorePanel p1Score={0} comScore={0} bagRemaining={100} currentPlayerId="COM" />);
    expect(screen.getByLabelText('current-player-COM')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Verify tests fail**

Run: `npx vitest run tests/ui/`
Expected: FAIL — modules not found

- [ ] **Step 3: Create `src/ui/Rack.tsx`**

```tsx
import type { Tile as TileType } from '../game/types';
import { Tile } from './Tile';

export function Rack({
  rack,
  selectedIndex,
  onSelect,
}: {
  rack: TileType[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="inline-flex gap-1 p-2 bg-stone-800 rounded">
      {rack.map((tile, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onSelect(i)}
          className={i === selectedIndex ? 'ring-4 ring-yellow-300' : ''}
          aria-label={`rack-${i}`}
        >
          <Tile tile={tile} variant={i === selectedIndex ? 'in-rack-selected' : 'in-rack'} />
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Create `src/ui/ScorePanel.tsx`**

```tsx
import type { PlayerId } from '../game/types';

export function ScorePanel({
  p1Score,
  comScore,
  bagRemaining,
  currentPlayerId,
}: {
  p1Score: number;
  comScore: number;
  bagRemaining: number;
  currentPlayerId: PlayerId;
}) {
  return (
    <div className="flex justify-between items-center gap-4 font-pixel text-xs p-2 bg-stone-800">
      <div aria-label={currentPlayerId === 'P1' ? 'current-player-P1' : undefined}>
        P1: <span className="text-yellow-300">{p1Score}</span>
      </div>
      <div>🎒 {bagRemaining}</div>
      <div aria-label={currentPlayerId === 'COM' ? 'current-player-COM' : undefined}>
        COM: <span className="text-yellow-300">{comScore}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verify tests pass**

Run: `npx vitest run tests/ui/`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/ui/Rack.tsx src/ui/ScorePanel.tsx tests/ui/Rack.test.tsx tests/ui/ScorePanel.test.tsx
git commit -m "feat(ui): add Rack and ScorePanel components"
```

## Task 5.4: `GameContext` + minimal `App` wiring

**Files:**
- Create: `scrabble/src/state/GameContext.tsx`
- Modify: `scrabble/src/App.tsx`

- [ ] **Step 1: Create `src/state/GameContext.tsx`**

```tsx
import { createContext, useContext, useReducer, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { GameState } from '../game/types';
import { reducer, createInitialState, type Action } from '../game/reducer';
import { createDictionaryFromText, type Dictionary } from '../game/dictionary';

type GameContextValue = {
  state: GameState;
  dispatch: (a: Action) => void;
  dict: Dictionary | null;
};

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [dict, setDict] = useState<Dictionary | null>(null);
  const initial = useMemo(() => createInitialState({
    seed: Date.now(),
    dict: { words: new Set(), prefixes: new Set([''])}, // placeholder until loaded
  }), []);
  const [state, dispatch] = useReducer(reducer, initial);

  useEffect(() => {
    (async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}dict/twl06.sample.txt`);
      const text = await res.text();
      setDict(createDictionaryFromText(text));
    })();
  }, []);

  return <GameContext.Provider value={{ state, dispatch, dict }}>{children}</GameContext.Provider>;
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
```

- [ ] **Step 2: Update `src/App.tsx` to show the shell**

```tsx
import { GameProvider, useGame } from './state/GameContext';
import { Board } from './ui/Board';
import { Rack } from './ui/Rack';
import { ScorePanel } from './ui/ScorePanel';

function GameShell() {
  const { state, dispatch, dict } = useGame();

  if (!dict) return <p className="p-6">辞書を読み込み中…</p>;

  if (state.status === 'setup') {
    return (
      <div className="p-6 text-center">
        <h1 className="font-pixel text-2xl mb-4">Toy Scrabble</h1>
        <button
          className="font-pixel bg-yellow-300 text-stone-900 px-4 py-2"
          onClick={() => dispatch({ type: 'START_GAME', mode: 'free' })}
        >
          NEW GAME
        </button>
      </div>
    );
  }

  const current = state.players[state.currentPlayerIndex];
  return (
    <div className="p-4 flex flex-col items-center gap-3">
      <h1 className="font-pixel text-xl">Toy Scrabble</h1>
      <ScorePanel
        p1Score={state.players[0].score}
        comScore={state.players[1].score}
        bagRemaining={state.bag.length}
        currentPlayerId={current.id}
      />
      <Board board={state.board} pending={state.pending} onCellClick={() => {}} />
      <Rack rack={current.rack} selectedIndex={null} onSelect={() => {}} />
    </div>
  );
}

export default function App() {
  return (
    <GameProvider>
      <GameShell />
    </GameProvider>
  );
}
```

- [ ] **Step 3: Verify dev server renders**

Run: `npm run dev` in background. Fetch `http://localhost:5173/toy-scrabble/`. Expect HTML shell + JS loads without console errors (verify via `curl` or leave for manual browser check).

- [ ] **Step 4: Commit**

```bash
git add src/state/GameContext.tsx src/App.tsx
git commit -m "feat(ui): wire GameContext and render shell"
```

---

# M6: Interactive Placement — Drag & Click, Play, Recall

## Task 6.1: Click-to-place workflow

**Files:**
- Modify: `scrabble/src/App.tsx`
- Create: `scrabble/src/state/uiState.ts` (small local UI state hook)

- [ ] **Step 1: Create `src/state/uiState.ts`**

```typescript
import { useState } from 'react';

export function useSelectedTile() {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  return { selectedIndex, setSelectedIndex };
}
```

- [ ] **Step 2: Wire click-to-place in `App.tsx`**

Replace the `GameShell` component body:

```tsx
function GameShell() {
  const { state, dispatch, dict } = useGame();
  const { selectedIndex, setSelectedIndex } = useSelectedTile();

  if (!dict) return <p className="p-6">辞書を読み込み中…</p>;

  if (state.status === 'setup') {
    return (
      <div className="p-6 text-center">
        <h1 className="font-pixel text-2xl mb-4">Toy Scrabble</h1>
        <button
          className="font-pixel bg-yellow-300 text-stone-900 px-4 py-2"
          onClick={() => dispatch({ type: 'START_GAME', mode: 'free' })}
        >
          NEW GAME
        </button>
      </div>
    );
  }

  const current = state.players[state.currentPlayerIndex];

  function handleCellClick(r: number, c: number) {
    // If a pending tile is at (r,c), recall it
    if (state.pending.some(p => p.coord.r === r && p.coord.c === c)) {
      dispatch({ type: 'RECALL_PENDING', coord: { r, c } });
      return;
    }
    // Otherwise if a rack tile is selected and cell is empty, place it
    if (selectedIndex !== null && state.board[r][c] === null) {
      const tile = current.rack[selectedIndex];
      dispatch({
        type: 'PLACE_PENDING',
        placement: { coord: { r, c }, tile, rackIndex: selectedIndex },
      });
      setSelectedIndex(null);
    }
  }

  return (
    <div className="p-4 flex flex-col items-center gap-3">
      <h1 className="font-pixel text-xl">Toy Scrabble</h1>
      <ScorePanel
        p1Score={state.players[0].score}
        comScore={state.players[1].score}
        bagRemaining={state.bag.length}
        currentPlayerId={current.id}
      />
      <Board board={state.board} pending={state.pending} onCellClick={handleCellClick} />
      <Rack
        rack={current.rack}
        selectedIndex={selectedIndex}
        onSelect={i => setSelectedIndex(i === selectedIndex ? null : i)}
      />
    </div>
  );
}
```

Add these imports at the top of `App.tsx`:
```tsx
import { useSelectedTile } from './state/uiState';
```

- [ ] **Step 3: Manual smoke test**

Run: `npm run dev`. Open browser, click a rack tile then an empty cell — tile should appear as pending. Click pending tile again to recall.

- [ ] **Step 4: Commit**

```bash
git add src/state/uiState.ts src/App.tsx
git commit -m "feat(ui): click-to-place workflow with recall on pending tile click"
```

## Task 6.2: Drag & drop via `@dnd-kit`

**Files:**
- Modify: `scrabble/src/App.tsx`
- Modify: `scrabble/src/ui/Board.tsx`
- Modify: `scrabble/src/ui/Rack.tsx`

Drag adds an alternative to click. Uses `@dnd-kit` which handles pointer/touch/keyboard uniformly.

- [ ] **Step 1: Update `Rack.tsx` to make tiles draggable**

Replace the button wrapping with `useDraggable`:

```tsx
import { useDraggable } from '@dnd-kit/core';
import type { Tile as TileType } from '../game/types';
import { Tile } from './Tile';

function DraggableRackTile({
  tile,
  index,
  selected,
  onSelect,
}: {
  tile: TileType;
  index: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `rack-${index}`,
    data: { source: 'rack', index },
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;
  return (
    <button
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onSelect}
      className={`${selected ? 'ring-4 ring-yellow-300' : ''} ${isDragging ? 'opacity-50' : ''}`}
      aria-label={`rack-${index}`}
      type="button"
    >
      <Tile tile={tile} variant={selected ? 'in-rack-selected' : 'in-rack'} />
    </button>
  );
}

export function Rack({
  rack,
  selectedIndex,
  onSelect,
}: {
  rack: TileType[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="inline-flex gap-1 p-2 bg-stone-800 rounded">
      {rack.map((tile, i) => (
        <DraggableRackTile
          key={i}
          tile={tile}
          index={i}
          selected={i === selectedIndex}
          onSelect={() => onSelect(i)}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Update `Board.tsx` to make empty cells droppable**

Wrap cells in `useDroppable`:

```tsx
import { useDroppable } from '@dnd-kit/core';

function DroppableCell({
  r,
  c,
  isEmpty,
  premiumInfo,
  children,
  onClick,
}: {
  r: number;
  c: number;
  isEmpty: boolean;
  premiumInfo: { className: string } | null;
  children: React.ReactNode;
  onClick: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `cell-${r}-${c}`,
    data: { r, c },
    disabled: !isEmpty,
  });
  return (
    <button
      ref={setNodeRef}
      role="gridcell"
      aria-label={`cell-${r}-${c}`}
      className={`w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-[8px] font-pixel ${
        isEmpty ? premiumInfo?.className ?? 'bg-cell-bg' : ''
      } ${isOver ? 'ring-2 ring-yellow-400' : ''}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
```

Then use `DroppableCell` inside the `Board` component in place of the plain `<button role="gridcell">`.

- [ ] **Step 3: Wrap `App` in `DndContext` and handle drop**

Update `src/App.tsx`:

```tsx
import { DndContext, type DragEndEvent } from '@dnd-kit/core';

// inside GameShell function body:
function handleDragEnd(evt: DragEndEvent) {
  const source = evt.active.data.current;
  const target = evt.over?.data.current;
  if (source?.source === 'rack' && target && typeof target.r === 'number') {
    const index = source.index as number;
    const { r, c } = target as { r: number; c: number };
    if (state.board[r][c] !== null) return; // shouldn't happen (disabled droppable)
    const tile = current.rack[index];
    dispatch({
      type: 'PLACE_PENDING',
      placement: { coord: { r, c }, tile, rackIndex: index },
    });
    setSelectedIndex(null);
  }
}

// wrap return content in <DndContext onDragEnd={handleDragEnd}>...</DndContext>
```

- [ ] **Step 4: Manual smoke test**

Run: `npm run dev`. Drag a rack tile onto an empty cell — appears as pending. Click still works.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/ui/Board.tsx src/ui/Rack.tsx
git commit -m "feat(ui): add drag & drop via @dnd-kit alongside click placement"
```

## Task 6.3: Play button + error banner

**Files:**
- Create: `scrabble/src/ui/ActionBar.tsx`
- Modify: `scrabble/src/App.tsx`

- [ ] **Step 1: Create `src/ui/ActionBar.tsx`**

```tsx
export function ActionBar({
  canPlay,
  canRecall,
  onPlay,
  onRecall,
  onShuffle,
  onPass,
  onExchange,
}: {
  canPlay: boolean;
  canRecall: boolean;
  onPlay: () => void;
  onRecall: () => void;
  onShuffle: () => void;
  onPass: () => void;
  onExchange: () => void;
}) {
  return (
    <div className="flex gap-2 flex-wrap justify-center">
      <button
        onClick={onPlay}
        disabled={!canPlay}
        className="font-pixel text-xs bg-green-500 text-white px-3 py-2 disabled:opacity-40"
      >
        PLAY
      </button>
      <button
        onClick={onRecall}
        disabled={!canRecall}
        className="font-pixel text-xs bg-stone-500 text-white px-3 py-2 disabled:opacity-40"
      >
        RECALL
      </button>
      <button onClick={onExchange} className="font-pixel text-xs bg-stone-600 text-white px-3 py-2">
        EXCHANGE
      </button>
      <button onClick={onShuffle} className="font-pixel text-xs bg-stone-600 text-white px-3 py-2">
        SHUFFLE
      </button>
      <button onClick={onPass} className="font-pixel text-xs bg-red-500 text-white px-3 py-2">
        PASS
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Wire ActionBar and error banner into `App.tsx`**

Add to `GameShell`:

```tsx
import { ActionBar } from './ui/ActionBar';
import { seededRng } from './game/bag';

// Below Rack in the JSX:
<ActionBar
  canPlay={state.pending.length > 0}
  canRecall={state.pending.length > 0}
  onPlay={() => dispatch({ type: 'COMMIT_PLAY', dict })}
  onRecall={() => dispatch({ type: 'RECALL_ALL' })}
  onShuffle={() => dispatch({ type: 'SHUFFLE_RACK', rng: seededRng(Date.now()) })}
  onPass={() => {
    if (confirm('本当に PASS しますか？')) dispatch({ type: 'PASS' });
  }}
  onExchange={() => alert('EXCHANGE は Task 7.2 で実装します')}
/>

{state.lastError && (
  <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded font-pixel text-xs">
    {state.lastError}
    <button
      className="ml-2 underline"
      onClick={() => dispatch({ type: 'CLEAR_ERROR' })}
    >
      ✕
    </button>
  </div>
)}
```

- [ ] **Step 3: Manual smoke test**

Run: `npm run dev`. Place valid word through center → Play → score updates, turn switches (COM turn: no action yet, so P1 needs a way to keep playing). For free-play mode both players are the same human — that's acceptable for Plan 1.

- [ ] **Step 4: Commit**

```bash
git add src/ui/ActionBar.tsx src/App.tsx
git commit -m "feat(ui): add ActionBar with Play/Recall/Pass and error banner"
```

## Task 6.4: `<BlankLetterModal>` — assign blank tile

**Files:**
- Create: `scrabble/src/ui/BlankLetterModal.tsx`
- Create: `scrabble/tests/ui/BlankLetterModal.test.tsx`
- Modify: `scrabble/src/App.tsx`

- [ ] **Step 1: Write failing test**

`tests/ui/BlankLetterModal.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BlankLetterModal } from '../../src/ui/BlankLetterModal';

describe('<BlankLetterModal>', () => {
  it('renders 26 letters', () => {
    render(<BlankLetterModal onSelect={() => {}} onCancel={() => {}} />);
    expect(screen.getAllByRole('button').length).toBeGreaterThanOrEqual(26);
  });
  it('calls onSelect with the picked letter', () => {
    const onSelect = vi.fn();
    render(<BlankLetterModal onSelect={onSelect} onCancel={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'letter-M' }));
    expect(onSelect).toHaveBeenCalledWith('M');
  });
});
```

- [ ] **Step 2: Verify test fails**

Run: `npx vitest run tests/ui/BlankLetterModal.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Create `src/ui/BlankLetterModal.tsx`**

```tsx
import type { Letter } from '../game/types';

const LETTERS: Letter[] = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('') as Letter[];

export function BlankLetterModal({
  onSelect,
  onCancel,
}: {
  onSelect: (letter: Letter) => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-stone-800 p-4 rounded">
        <h2 className="font-pixel text-sm mb-3">Blank タイルの文字を選択</h2>
        <div className="grid grid-cols-6 gap-1">
          {LETTERS.map(l => (
            <button
              key={l}
              type="button"
              onClick={() => onSelect(l)}
              aria-label={`letter-${l}`}
              className="w-8 h-8 bg-tile-wood text-stone-900 font-bold"
            >
              {l}
            </button>
          ))}
        </div>
        <button onClick={onCancel} className="mt-3 text-xs text-stone-300 underline">
          キャンセル
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Wire modal into placement flow**

In `App.tsx`, when a placed tile is a blank without an assigned letter, show the modal and either update the pending placement with the chosen letter or recall it on cancel.

Modify `handleCellClick` and drag-end handler to detect blank placement and set local state:

```tsx
const [pendingBlank, setPendingBlank] = useState<{ r: number; c: number } | null>(null);

// After every PLACE_PENDING, check if that tile was a blank and open modal:
function afterPlace(tile: TileType, r: number, c: number) {
  if (tile.kind === 'blank' && tile.assigned === null) {
    setPendingBlank({ r, c });
  }
}
```

Add a reducer action `ASSIGN_BLANK`:

In `src/game/reducer.ts`:

```typescript
    case 'ASSIGN_BLANK': {
      const { r, c, letter } = action;
      const newPending = state.pending.map(p =>
        p.coord.r === r && p.coord.c === c && p.tile.kind === 'blank'
          ? { ...p, tile: { ...p.tile, assigned: letter } as Tile }
          : p,
      );
      return { ...state, pending: newPending };
    }
```

Extend the Action union:
```typescript
  | { type: 'ASSIGN_BLANK'; r: number; c: number; letter: Letter }
```

Render the modal:

```tsx
{pendingBlank && (
  <BlankLetterModal
    onSelect={l => {
      dispatch({ type: 'ASSIGN_BLANK', r: pendingBlank.r, c: pendingBlank.c, letter: l });
      setPendingBlank(null);
    }}
    onCancel={() => {
      dispatch({ type: 'RECALL_PENDING', coord: pendingBlank });
      setPendingBlank(null);
    }}
  />
)}
```

Add a reducer test to `tests/reducer.test.ts`:

```typescript
describe('reducer / ASSIGN_BLANK', () => {
  it('assigns a letter to a pending blank tile', () => {
    let s = reducer(createInitialState({ seed: 1, dict }), { type: 'START_GAME', mode: 'free' });
    const blank: Tile = { kind: 'blank', assigned: null, points: 0 };
    s = { ...s, players: [{ ...s.players[0], rack: [blank] }, s.players[1]] };
    s = reducer(s, { type: 'PLACE_PENDING', placement: { coord: { r: 7, c: 7 }, tile: blank, rackIndex: 0 } });
    s = reducer(s, { type: 'ASSIGN_BLANK', r: 7, c: 7, letter: 'A' });
    expect(s.pending[0].tile).toMatchObject({ kind: 'blank', assigned: 'A' });
  });
});
```

- [ ] **Step 5: Run all tests**

Run: `npm run test`
Expected: PASS (all)

- [ ] **Step 6: Commit**

```bash
git add src/ui/BlankLetterModal.tsx tests/ui/BlankLetterModal.test.tsx src/App.tsx src/game/reducer.ts tests/reducer.test.ts
git commit -m "feat(ui): blank tile letter selection modal"
```

---

# M7: Exchange Modal + Game End Screen

## Task 7.1: `<ExchangeModal>`

**Files:**
- Create: `scrabble/src/ui/ExchangeModal.tsx`
- Modify: `scrabble/src/App.tsx`

- [ ] **Step 1: Create `src/ui/ExchangeModal.tsx`**

```tsx
import { useState } from 'react';
import type { Tile as TileType } from '../game/types';
import { Tile } from './Tile';

export function ExchangeModal({
  rack,
  onConfirm,
  onCancel,
}: {
  rack: TileType[];
  onConfirm: (indices: number[]) => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set());

  function toggle(i: number) {
    const s = new Set(selected);
    if (s.has(i)) s.delete(i);
    else s.add(i);
    setSelected(s);
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-stone-800 p-4 rounded">
        <h2 className="font-pixel text-sm mb-3">交換するタイルを選択</h2>
        <div className="flex gap-1">
          {rack.map((tile, i) => (
            <button
              key={i}
              type="button"
              onClick={() => toggle(i)}
              className={selected.has(i) ? 'ring-4 ring-red-400' : ''}
              aria-label={`exchange-tile-${i}`}
            >
              <Tile tile={tile} variant={selected.has(i) ? 'in-rack-selected' : 'in-rack'} />
            </button>
          ))}
        </div>
        <div className="flex gap-3 mt-3 justify-end">
          <button onClick={onCancel} className="text-xs text-stone-300 underline">
            キャンセル
          </button>
          <button
            onClick={() => onConfirm([...selected])}
            disabled={selected.size === 0}
            className="font-pixel text-xs bg-yellow-300 text-stone-900 px-3 py-1 disabled:opacity-40"
          >
            OK ({selected.size})
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire into `App.tsx`**

Add state and modal:

```tsx
const [showExchange, setShowExchange] = useState(false);

// In ActionBar onExchange:
onExchange={() => setShowExchange(true)}

// Render:
{showExchange && (
  <ExchangeModal
    rack={current.rack}
    onConfirm={indices => {
      dispatch({ type: 'EXCHANGE', indices, rng: seededRng(Date.now()) });
      setShowExchange(false);
    }}
    onCancel={() => setShowExchange(false)}
  />
)}
```

- [ ] **Step 3: Manual smoke test**

Run `npm run dev`, verify exchange flow works.

- [ ] **Step 4: Commit**

```bash
git add src/ui/ExchangeModal.tsx src/App.tsx
git commit -m "feat(ui): exchange modal for swapping rack tiles"
```

## Task 7.2: Game-end screen

**Files:**
- Modify: `scrabble/src/App.tsx`

- [ ] **Step 1: Add end-screen branch to `GameShell`**

```tsx
if (state.status === 'ended') {
  const [p1, com] = state.players;
  const winner = p1.score > com.score ? 'P1' : com.score > p1.score ? 'COM' : 'DRAW';
  return (
    <div className="p-6 text-center flex flex-col items-center gap-4">
      <h1 className="font-pixel text-2xl">GAME OVER</h1>
      <div className="font-pixel">
        {winner === 'DRAW' ? 'DRAW' : `${winner} WINS!`}
      </div>
      <div className="font-pixel">
        P1: {p1.score}　COM: {com.score}
      </div>
      <button
        onClick={() => dispatch({ type: 'START_GAME', mode: state.mode })}
        className="font-pixel bg-yellow-300 text-stone-900 px-4 py-2"
      >
        NEW GAME
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/App.tsx
git commit -m "feat(ui): game over screen with winner and new game action"
```

## Task 7.3: Last-formed-words display

**Files:**
- Modify: `scrabble/src/App.tsx`

- [ ] **Step 1: Add a simple last-words strip**

Add inside `GameShell`, above `ActionBar`:

```tsx
{state.lastFormedWords.length > 0 && (
  <div className="font-pixel text-xs text-stone-300">
    直前手: {state.lastFormedWords.map(w => w.word).join(' + ')}
    （+{state.history[state.history.length - 1]?.score ?? 0}）
  </div>
)}
```

(Definition popups are Plan 3; here we just show the words.)

- [ ] **Step 2: Commit**

```bash
git add src/App.tsx
git commit -m "feat(ui): show last formed words after a play"
```

---

# M8: README + Final Verification

## Task 8.1: `README.md`

**Files:**
- Create: `scrabble/README.md`

- [ ] **Step 1: Create `README.md`**

```markdown
# Toy Scrabble

日本人英語学習者向けの Scrabble（英単語クロスワードボードゲーム）静的サイト。
現時点（Plan 1）ではローカル 2 人フリープレイのみに対応します。
COM 対戦（Plan 2）、英英・英和辞書表示（Plan 3）、モバイル対応と GitHub Pages デプロイ（Plan 4）は後続計画で実装します。

## 遊び方（Plan 1 時点）

1. `NEW GAME` を押すとゲームが始まります（フリープレイ = P1 と COM の枠を人間 2 人で交互に操作）
2. 手札のタイルをクリック → 空マスをクリック、または手札をドラッグしてマスに置く
3. すべてのタイルを置いたら `PLAY` を押す（辞書 = TWL06 サンプルで検証）
4. `RECALL` で全ての pending タイルを手札に戻す
5. `EXCHANGE` で手札の一部を袋のタイルと入れ替える（袋残 7 枚以上のとき）
6. `PASS` でターンをスキップ（6 連続で終了）
7. どちらかがタイルを使い切って袋が空、または 6 連続 Pass でゲーム終了

## ローカル起動

Node.js のバージョンは [mise](https://mise.jdx.dev/) で管理しています。

```bash
mise install       # node 22 をインストール
npm install        # 依存インストール
npm run dev        # http://localhost:5173/toy-scrabble/
```

## テスト

```bash
npm run test       # unit + component (Vitest)
```

## Plan 1 の制限事項

- 辞書は `public/dict/twl06.sample.txt`（サンプル数十語）のみ。フル TWL06（18 万語）は Plan 3 で導入
- COM AI は未実装。両プレイヤーとも人間が操作
- 単語の意味表示は未実装
- モバイル最適化・GitHub Pages 自動デプロイは未実装

## リポジトリ

- GitHub: `aoi-33/toy-scrabble`
- デプロイ URL（Plan 4 完了後）: `https://aoi-33.github.io/toy-scrabble/`

## ライセンス

MIT
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README for Plan 1 usage and roadmap"
```

## Task 8.2: Final verification

- [ ] **Step 1: Run full test suite**

Run: `npm run test`
Expected: all tests pass, no warnings

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: exits 0

- [ ] **Step 3: Run production build**

Run: `npm run build`
Expected: `dist/` produced, no TypeScript errors

- [ ] **Step 4: Preview production build**

Run: `npm run preview` in background. Manual browser check at `http://localhost:4173/toy-scrabble/`:
- Play through: place `CAT` at center → Play → score = 10 (CAT × DW center)
- Recall works
- Blank tile → modal appears → letter selected → placed
- Exchange modal works
- Pass twice per side to trigger end (would need 6 total)

- [ ] **Step 5: Commit final polish if needed, then tag**

```bash
git tag plan-1-complete
```

---

## Plan 1 Completion Checklist

- [ ] All Vitest tests pass (`npm run test`)
- [ ] ESLint clean (`npm run lint`)
- [ ] Production build succeeds (`npm run build`)
- [ ] Local free-play from NEW GAME → play → PASS-to-end works end to end
- [ ] Blank tile modal + exchange modal functional
- [ ] README documents Plan 1 scope and limitations
- [ ] Repository tagged `plan-1-complete`

**Next:** Plan 2 (COM Opponent) will introduce the Web Worker AI, ModeSelect UI, and single-human vs. COM turn separation.
