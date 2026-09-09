/** WordNet の品詞コード。n=名詞 v=動詞 a=形容詞 r=副詞 */
export type Pos = 'n' | 'v' | 'a' | 'r';

/** 英英定義 1 件。[品詞, 定義文] */
export type EnglishSense = [Pos, string];

/** バケット JSON の 1 エントリ（spec §5） */
export type Definition = {
  /** 原形。語自身が原形なら持たない */
  b?: string;
  /** 英英定義 */
  e?: EnglishSense[];
  /** 和訳。最大 3 件 */
  j?: string[];
};

/** 先頭文字ごとのバケット。キーは大文字の語 */
export type Bucket = Record<string, Definition>;

/**
 * fetch の最小インターフェース。テストでモックを差し込むために型を自前で持つ
 * （グローバルの Response 型に依存すると eslint の no-undef を踏む）
 */
export type FetchLike = (
  url: string,
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

/**
 * 引きの結果。spec §7.3 が not-found と error を別状態として扱うため、
 * spec §6 の擬似コードの `Definition | null` ではなく判別共用体にする。
 */
export type LookupResult =
  | {
      kind: 'found';
      word: string;
      /** 原形が語と異なる場合のみ入る */
      base: string | null;
      english: EnglishSense[];
      japanese: string[];
    }
  | { kind: 'not-found' }
  | { kind: 'error' };
