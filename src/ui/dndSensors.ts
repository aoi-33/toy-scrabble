import {
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';

/** マウスはこの距離だけ動いて初めてドラッグ開始。閾値が無いとクリック配置がドラッグに化ける */
export const MOUSE_ACTIVATION = { distance: 8 } as const;

/**
 * タッチは長押し 150ms でドラッグ開始。これ未満のタップはブラウザが click を合成するので
 * タップ配置（onSelect）として通る。tolerance は待機中に許容する指のブレ（px）。
 * 実機で調整する場合はこの 2 値だけを変えればよい。
 */
export const TOUCH_ACTIVATION = { delay: 150, tolerance: 8 } as const;

/**
 * PointerSensor はマウスとタッチの両方を拾うため TouchSensor と併用すると二重に発火する。
 * マウスとタッチで別々のしきい値を持たせたいので MouseSensor + TouchSensor を使う。
 * sensors を明示するとデフォルトが置き換わるため KeyboardSensor も自分で足す。
 */
export function useDndSensors() {
  return useSensors(
    useSensor(MouseSensor, { activationConstraint: MOUSE_ACTIVATION }),
    useSensor(TouchSensor, { activationConstraint: TOUCH_ACTIVATION }),
    useSensor(KeyboardSensor),
  );
}
