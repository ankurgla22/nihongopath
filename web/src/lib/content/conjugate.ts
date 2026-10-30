/**
 * Japanese verb conjugation by rule. Pure: no content access, so it is unit-tested against the
 * hand-checked table in study-materials/03-vocabulary/action-verbs.md.
 *
 * The same rules run on the written form (食べる) and the reading (たべる): endings are kana, so
 * only 来る needs the two handled apart (来ない is read こない).
 */

export type VerbClass = "godan" | "ichidan" | "suru" | "kuru";

/** Group 1 = godan (う-verbs), 2 = ichidan (る-verbs), 3 = する and 来る. */
export const GROUP: Record<VerbClass, 1 | 2 | 3> = { godan: 1, ichidan: 2, suru: 3, kuru: 3 };

/**
 * Godan verbs ending in -iru / -eru, which the ending rule would call ichidan. Matched on the end
 * of the written form, so compounds follow (持ち帰る). Written forms only: 要る and いる (to be)
 * share a reading but not a group.
 */
const GODAN_IRU_ERU = [
  "帰る", "入る", "切る", "走る", "知る", "要る", "参る", "限る", "減る", "喋る", "滑る", "握る", "練る", "混じる", "交じる",
  "散る", "焦る", "蹴る", "湿る", "茂る", "照る", "嘲る", "遮る", "覆る", "陥る", "翻る", "罵る", "捻る", "甦る",
  "蘇る", "競る", "耽る", "弄る", "抉る", "齧る", "毟る", "煎る", "せびる", "しゃべる", "いじる", "かじる",
  "ける", "ねじる", "すべる", "にぎる", "あせる", "てる", "ちる",
];
/** Kana-only words that must match whole, not as an ending: "ける" would otherwise catch 開ける. */
const KANA_WHOLE = new Set(["しゃべる", "いじる", "かじる", "ける", "ねじる", "すべる", "にぎる", "あせる", "てる", "ちる", "せびる"]);

/** Honorific godan verbs whose ます-stem and imperative end in い, not り. */
const HONORIFIC_ARU = ["いらっしゃる", "おっしゃる", "なさる", "くださる", "下さる", "ござる"];

const I_OR_E = new Set("いきしちにひみりぎじぢびぴえけせてねへめれげぜでべぺ");

/** Ends in -iru / -eru: Group 2 by its ending. A godan verb that does is one learners must memorise. */
export function looksIchidan(reading: string): boolean {
  return reading.endsWith("る") && I_OR_E.has(reading.at(-2) ?? "");
}

export function classify(word: string, reading: string, pos = ""): VerbClass {
  if (word.endsWith("する")) return "suru";
  if (word === "来る" || word.endsWith("て来る") || word === "くる" || word.endsWith("てくる")) return "kuru";
  if (/v\s*\(う\)|godan|v5/i.test(pos)) return "godan";
  if (/v\s*\(る\)|ichidan|v1/i.test(pos)) return "ichidan";
  if (!looksIchidan(reading)) return "godan";
  const exception = GODAN_IRU_ERU.some((w) => (KANA_WHOLE.has(w) ? word === w : word.endsWith(w)));
  return exception ? "godan" : "ichidan";
}

export type FormKey =
  | "dictionary"
  | "polite"
  | "politeNegative"
  | "politePast"
  | "politePastNegative"
  | "mashou"
  | "tai"
  | "te"
  | "progressive"
  | "nai"
  | "ta"
  | "nakatta"
  | "potential"
  | "volitional"
  | "imperative"
  | "ba"
  | "tara"
  | "passive"
  | "causative";

export type Forms = Record<FormKey, string>;

const ROW: Record<string, Record<"a" | "i" | "e" | "o", string>> = {
  う: { a: "わ", i: "い", e: "え", o: "お" },
  く: { a: "か", i: "き", e: "け", o: "こ" },
  ぐ: { a: "が", i: "ぎ", e: "げ", o: "ご" },
  す: { a: "さ", i: "し", e: "せ", o: "そ" },
  つ: { a: "た", i: "ち", e: "て", o: "と" },
  ぬ: { a: "な", i: "に", e: "ね", o: "の" },
  ぶ: { a: "ば", i: "び", e: "べ", o: "ぼ" },
  む: { a: "ま", i: "み", e: "め", o: "も" },
  る: { a: "ら", i: "り", e: "れ", o: "ろ" },
};
const TE: Record<string, string> = { う: "って", つ: "って", る: "って", む: "んで", ぶ: "んで", ぬ: "んで", く: "いて", ぐ: "いで", す: "して" };

/** Every form from the ます-stem, the て-form and the ない-stem; the classes differ only in those. */
function build(dict: string, masuStem: string, te: string, naiStem: string, e: { potential: string; volitional: string; imperative: string; ba: string; passive: string; causative: string }): Forms {
  const ta = te.replace(/て$/, "た").replace(/で$/, "だ");
  return {
    dictionary: dict,
    polite: `${masuStem}ます`,
    politeNegative: `${masuStem}ません`,
    politePast: `${masuStem}ました`,
    politePastNegative: `${masuStem}ませんでした`,
    mashou: `${masuStem}ましょう`,
    tai: `${masuStem}たい`,
    te,
    progressive: `${te}います`,
    nai: `${naiStem}ない`,
    ta,
    nakatta: `${naiStem}なかった`,
    tara: `${ta}ら`,
    ...e,
  };
}

/**
 * Conjugates one string — pass the written form and the reading separately. `word` is the written
 * form in both calls: it decides the special cases (行く, ある, honorifics), which a reading alone
 * cannot (いく could be 生く; ある could be part of a longer word).
 */
export function conjugate(s: string, cls: VerbClass, word: string = s): Forms {
  if (cls === "suru") {
    const p = s.slice(0, -2);
    return build(s, `${p}し`, `${p}して`, `${p}し`, {
      potential: `${p}できる`,
      volitional: `${p}しよう`,
      imperative: `${p}しろ`,
      ba: `${p}すれば`,
      passive: `${p}される`,
      causative: `${p}させる`,
    });
  }
  if (cls === "kuru") {
    const p = s.slice(0, -2);
    const kanji = s.endsWith("来る");
    const k = (v: "i" | "o" | "u") => (kanji ? "来" : { i: "き", o: "こ", u: "く" }[v]);
    return build(s, `${p}${k("i")}`, `${p}${k("i")}て`, `${p}${k("o")}`, {
      potential: `${p}${k("o")}られる`,
      volitional: `${p}${k("o")}よう`,
      imperative: `${p}${k("o")}い`,
      ba: `${p}${k("u")}れば`,
      passive: `${p}${k("o")}られる`,
      causative: `${p}${k("o")}させる`,
    });
  }
  if (cls === "ichidan") {
    const st = s.slice(0, -1);
    return build(s, st, `${st}て`, st, {
      potential: `${st}られる`,
      volitional: `${st}よう`,
      imperative: `${st}ろ`,
      ba: `${st}れば`,
      passive: `${st}られる`,
      causative: `${st}させる`,
    });
  }
  const st = s.slice(0, -1);
  const row = ROW[s.at(-1)!];
  if (!row) throw new Error(`Not a verb ending: ${s}`);
  const iku = word.endsWith("行く") || word === "いく";
  const honorific = HONORIFIC_ARU.some((h) => word.endsWith(h));
  const forms = build(s, `${st}${honorific ? "い" : row.i}`, iku ? `${st}って` : `${st}${TE[s.at(-1)!]}`, `${st}${row.a}`, {
    potential: `${st}${row.e}る`,
    volitional: `${st}${row.o}う`,
    imperative: `${st}${honorific ? "い" : row.e}`,
    ba: `${st}${row.e}ば`,
    passive: `${st}${row.a}れる`,
    causative: `${st}${row.a}せる`,
  });
  // Only the ます forms take い (いらっしゃいます); たい keeps り (いらっしゃりたい).
  if (honorific) forms.tai = `${st}${row.i}たい`;
  // ある has no あらない: its negative is plain ない.
  if (word === "ある" || word === "有る" || word === "在る") {
    const p = s.slice(0, -2);
    Object.assign(forms, { nai: `${p}ない`, nakatta: `${p}なかった` });
  }
  return forms;
}
