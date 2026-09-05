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
