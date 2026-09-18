import type { ReactNode } from "react";

/**
 * Passages store readings inline as 漢字（かな）. These helpers turn that notation into
 * <ruby> markup (readings above the kanji; hidden when the learner turns furigana off via the
 * `furigana-off` class on <html>) or strip it for speech synthesis and plain text.
 */
const KANJI = "\\u3400-\\u4dbf\\u4e00-\\u9fff\\uf900-\\ufaff々〆ヶヵ";
const KANA = "\\u3040-\\u309f\\u30a0-\\u30ff";
const FURIGANA_RE = new RegExp(`([${KANJI}]+)[（(]([${KANA}ー]+)[)）]`, "g");

/** True when the text contains at least one 漢字（かな） reading. */
export function hasFurigana(text: string): boolean {
  FURIGANA_RE.lastIndex = 0;
  return FURIGANA_RE.test(text);
}

/** Remove inline readings: 中国（ちゅうごく） → 中国. Use for speech and character counts. */
export function stripFurigana(text: string): string {
  return text.replace(FURIGANA_RE, "$1");
}

/** Render text with 漢字（かな） readings as <ruby>漢字<rt>かな</rt></ruby>. Server-safe. */
export function renderFurigana(text: string): ReactNode {
  if (!hasFurigana(text)) return text;
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  FURIGANA_RE.lastIndex = 0;
  for (const m of text.matchAll(FURIGANA_RE)) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    out.push(
      <ruby key={key++}>
        {m[1]}
        <rp>（</rp>
        <rt>{m[2]}</rt>
        <rp>）</rp>
      </ruby>,
    );
    last = at + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
