import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';

// GameProvider が対局中の状態を localStorage に書くため、
// 掃除しないと次のテストが前のテストのセーブを読んでしまう
afterEach(() => {
  localStorage.clear();
});
