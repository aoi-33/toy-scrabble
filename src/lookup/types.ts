/**
 * 品詞コード。n=名詞 v=動詞 a=形容詞 r=副詞 は WordNet 由来。
 * WordNet はこの 4 つしか持たず IF / OF / AND のような機能語が丸ごと欠けるので、
 * Wiktionary から前置詞・接続詞・代名詞・限定詞・間投詞・数詞・接辞を足している。
 * x は上記のどれにも当てはまらない品詞（助詞など）の受け皿。
 */
export type Pos =
  | 'n'
  | 'v'
  | 'a'
  | 'r'
  | 'prep'
  | 'conj'
  | 'pron'
  | 'det'
  | 'intj'
  | 'num'
  | 'pre'
  | 'suf'
  | 'x';

/** 英英定義 1 件。[品詞, 定義文] */
export type EnglishSense = [Pos, string];

/** 発音のアクセント。x はタグの無い単一表記 */
export type Accent = 'uk' | 'us' | 'x';

/** 発音 1 件。[アクセント, IPA] */
export type Pronunciation = [Accent, string];

/** バケット JSON の 1 エントリ（spec §5） */
export type Definition = {
  /** 原形。語自身が原形なら持たない */
  b?: string;
  /** 英英定義 */
  e?: EnglishSense[];
  /** 和訳。最大 3 件 */
  j?: string[];
  /** 発音記号。UK/US 両方あれば 2 件、無ければ 1 件 */
  p?: Pronunciation[];
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
      pronunciation: Pronunciation[];
    }
  | { kind: 'not-found' }
  | { kind: 'error' };
