import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { GROUP, classify, conjugate, type FormKey } from "./conjugate";

const MD = fs.readFileSync(path.resolve(__dirname, "../../../../study-materials/03-vocabulary/action-verbs.md"), "utf8");
const rows = (minCells: number) =>
  MD.split("\n")
    .map((l) => l.split("|").map((c) => c.trim()))
    .filter((c) => c.length >= minCells);
// "来ます (きます)" → "来ます"; "書きます *kakimasu*" → "書きます"
const bare = (cell: string) => cell.replace(/\s*\(.*\)$/, "").replace(/\s*\*.*\*$/, "");

describe("the 100 verbs in action-verbs.md", () => {
  const verbs = rows(13).filter((c) => /^\d+$/.test(c[1]));
  it("has them all", () => expect(verbs).toHaveLength(100));

  it.each(verbs.map((c) => [c[2], c]))("%s", (_, c) => {
    const [, , word, reading, , , group, , polite, te, nai, ta] = c;
    const cls = classify(word, reading);
    expect(String(GROUP[cls])).toBe(group.replace(/\\\*$/, "").replace(/\s.*$/, ""));
    const f = conjugate(word, cls);
    expect([f.polite, f.te, f.nai, f.ta]).toEqual([polite, te, nai, ta].map(bare));
  });
});

describe("the full conjugation chart in action-verbs.md", () => {
  const LABEL: Record<string, FormKey> = {
    Dictionary: "dictionary",
    Polite: "polite",
    "Polite negative": "politeNegative",
    "Polite past": "politePast",
    "Polite past negative": "politePastNegative",
    "Let's (polite)": "mashou",
    "Want to": "tai",
    "て-form": "te",
    Progressive: "progressive",
    "ない-form": "nai",
    "た-form": "ta",
    "Past negative": "nakatta",
    Potential: "potential",
    Volitional: "volitional",
    Imperative: "imperative",
    "Conditional ば": "ba",
    "Conditional たら": "tara",
    Passive: "passive",
    Causative: "causative",
  };
  // Section 12's cells carry italic romaji; section 10's rule tables reuse some of the labels.
  const chart = rows(8).filter((c) => c[1] in LABEL && / \*\w/.test(c[3]));
  it("covers every form", () => expect(chart).toHaveLength(Object.keys(LABEL).length));

  const models = [["書く", "かく"], ["食べる", "たべる"], ["する", "する"], ["来る", "くる"]] as const;
  it.each(chart.map((c) => [c[1], c]))("%s", (_, c) => {
    models.forEach(([word, reading], i) => {
      expect(conjugate(word, classify(word, reading))[LABEL[c[1]]]).toBe(bare(c[3 + i]));
    });
  });
});

describe("groups in the N5 vocabulary data", () => {
  const vocab: { word: string; reading: string; pos: string }[] = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../../content/n5/vocabulary.json"), "utf8"));
  const labelled = vocab.filter((v) => v.pos === "v (う)" || v.pos === "v (る)");
  it("has labelled verbs to check", () => expect(labelled.length).toBeGreaterThan(90));
  // classify() is given no pos here: the ending rule plus exceptions must reach the label on its own,
  // because N4 and above only say vt / vi.
  it.each(labelled.map((v) => [v.word, v]))("%s", (_, v) => {
    expect(classify(v.word, v.reading)).toBe(v.pos === "v (う)" ? "godan" : "ichidan");
  });
});

describe("special cases", () => {
  it("ある: negative is ない", () => {
    const f = conjugate("ある", "godan");
    expect([f.nai, f.nakatta, f.polite]).toEqual(["ない", "なかった", "あります"]);
  });
  it("honorific -aru verbs take い before ます and in the imperative", () => {
    const f = conjugate("いらっしゃる", "godan");
    expect([f.polite, f.imperative, f.tai, f.te]).toEqual(["いらっしゃいます", "いらっしゃい", "いらっしゃりたい", "いらっしゃって"]);
    expect(conjugate("くださる", "godan").polite).toBe("くださいます");
  });
  it("来る: kanji stays, the reading changes", () => {
    expect(conjugate("持って来る", "kuru").nai).toBe("持って来ない");
    expect(conjugate("もってくる", "kuru", "持って来る").nai).toBe("もってこない");
    expect(classify("持って来る", "もってくる")).toBe("kuru");
  });
  it("行く compounds keep the って exception", () => {
    expect(conjugate("出て行く", "godan").te).toBe("出て行って");
    expect(conjugate("でていく", "godan", "出て行く").ta).toBe("でていった");
  });
  it("noun + する", () => {
    const f = conjugate("勉強する", classify("勉強する", "べんきょうする"));
    expect([f.polite, f.potential, f.ba]).toEqual(["勉強します", "勉強できる", "勉強すれば"]);
  });
  it("要る and いる share a reading but not a group", () => {
    expect(classify("要る", "いる")).toBe("godan");
    expect(classify("いる", "いる")).toBe("ichidan");
  });
  it("参る is Group 1 although it ends in -iru (caught on the page: it showed 参ます)", () => {
    expect(conjugate("参る", classify("参る", "まいる", "vi")).polite).toBe("参ります");
  });
  it("a kana exception matches only the whole word", () => {
    expect(classify("ける", "ける")).toBe("godan");
    expect(classify("開ける", "あける")).toBe("ichidan");
  });
});
