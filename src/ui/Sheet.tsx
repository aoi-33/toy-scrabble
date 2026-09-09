import type React from 'react';
import { useEffect, useRef } from 'react';

/**
 * モバイルはボトムシート（下寄せ・全幅）、PC(769px〜) は中央モーダルとして表示する共通ラッパ。
 * 背景タップと Escape で閉じる。開閉に合わせてフォーカスを移動する。
 */
export function Sheet({
  title,
  onDismiss,
  children,
}: {
  title: string;
  onDismiss: () => void;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Escape で閉じる。App 側の Escape ショートカット（RECALL ALL）は
  // シート表示中は無効化されるので、ここでの処理と競合しない。
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onDismiss();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onDismiss]);

  // 開いたらパネルへフォーカスし、閉じたら開く前の要素へ戻す
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    return () => previous?.focus();
  }, []);

  return (
    <div
      role="presentation"
      onClick={onDismiss}
      className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center z-50"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
        className="w-full md:w-auto max-h-[85vh] overflow-y-auto bg-stone-800 p-4 rounded-t-lg md:rounded-lg pb-[max(1rem,env(safe-area-inset-bottom))] md:pb-4 outline-none"
      >
        <h2 className="font-pixel text-sm mb-3">{title}</h2>
        {children}
      </div>
    </div>
  );
}
