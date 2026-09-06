import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { KeyboardSensor, MouseSensor, PointerSensor, TouchSensor } from '@dnd-kit/core';
import { MOUSE_ACTIVATION, TOUCH_ACTIVATION, useDndSensors } from '../../src/ui/dndSensors';

describe('dnd センサー設定', () => {
  it('マウスは移動距離でドラッグ開始する', () => {
    expect(MOUSE_ACTIVATION).toEqual({ distance: 8 });
  });

  it('タッチは長押しでドラッグ開始にする', () => {
    expect(TOUCH_ACTIVATION).toEqual({ delay: 150, tolerance: 8 });
  });

  it('Mouse / Touch / Keyboard の 3 センサーを使う', () => {
    const { result } = renderHook(() => useDndSensors());
    const sensors = result.current.map(d => d.sensor);
    expect(sensors).toContain(MouseSensor);
    expect(sensors).toContain(TouchSensor);
    // sensors prop を明示するとデフォルトが置き換わるので、失うと
    // キーボードでのドラッグができなくなる
    expect(sensors).toContain(KeyboardSensor);
  });

  it('PointerSensor は使わない（TouchSensor と二重発火するため）', () => {
    const { result } = renderHook(() => useDndSensors());
    expect(result.current.map(d => d.sensor)).not.toContain(PointerSensor);
  });
});
