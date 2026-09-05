import { useState } from 'react';

export function useSelectedTile() {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  return { selectedIndex, setSelectedIndex };
}
