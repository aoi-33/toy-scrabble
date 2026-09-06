import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';

// 実際の tailwind.config.js と src/index.css を通して CSS を生成する。
// content 走査は index.html と src/**/*.{ts,tsx} を対象にするので、
// 生成 CSS はコンポーネントが実際に使っているクラスを反映する。
async function buildCss(): Promise<string> {
  // vitest の cwd はプロジェクトルート。import.meta.url からの new URL() は
  // jsdom 環境では "The URL must be of scheme file" で落ちるので使わない。
  const src = readFileSync('src/index.css', 'utf8');
  const result = await postcss([tailwindcss('./tailwind.config.js')]).process(src, {
    from: undefined,
  });
  return result.css;
}

let css = '';
beforeAll(async () => {
  css = await buildCss();
}, 60_000);

describe('Tailwind ブレークポイント', () => {
  it('sm: が design.md の 481px で出力される', () => {
    expect(css).toContain('@media (min-width: 481px)');
  });

  it('Tailwind デフォルトの 640px ブレークポイントを使わない', () => {
    expect(css).not.toContain('@media (min-width: 640px)');
  });
});
