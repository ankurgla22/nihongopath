/**
 * Generates the Foundation level content:
 *   content/foundation/foundation-<n>.json   (8 lessons, FoundationLessonSchema)
 *   content/questions/kana-questions.json    (kana + numbers/dates/greetings questions)
 * Source: study-materials/01-foundation/*.md (converted by hand into the data below).
 * Run: node scripts/generate-foundation.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_LESSONS = path.join(ROOT, "content", "foundation");
const OUT_QUESTIONS = path.join(ROOT, "content", "questions", "kana-questions.json");

/* ---------------- deterministic RNG ---------------- */
let seed = 20260917;
function rand() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function pick(arr, n) {
  return shuffle(arr).slice(0, n);
}

/* ---------------- kana data ---------------- */
const V = ["a", "i", "u", "e", "o"];
// [rowKey, rowLabel, cells] where cells = [kana, romaji] | null
const H_BASIC = [
  ["vowel", "—", [["あ", "a"], ["い", "i"], ["う", "u"], ["え", "e"], ["お", "o"]]],
  ["ka", "K", [["か", "ka"], ["き", "ki"], ["く", "ku"], ["け", "ke"], ["こ", "ko"]]],
  ["sa", "S", [["さ", "sa"], ["し", "shi"], ["す", "su"], ["せ", "se"], ["そ", "so"]]],
  ["ta", "T", [["た", "ta"], ["ち", "chi"], ["つ", "tsu"], ["て", "te"], ["と", "to"]]],
  ["na", "N", [["な", "na"], ["に", "ni"], ["ぬ", "nu"], ["ね", "ne"], ["の", "no"]]],
  ["ha", "H", [["は", "ha"], ["ひ", "hi"], ["ふ", "fu"], ["へ", "he"], ["ほ", "ho"]]],
  ["ma", "M", [["ま", "ma"], ["み", "mi"], ["む", "mu"], ["め", "me"], ["も", "mo"]]],
  ["ya", "Y", [["や", "ya"], null, ["ゆ", "yu"], null, ["よ", "yo"]]],
  ["ra", "R", [["ら", "ra"], ["り", "ri"], ["る", "ru"], ["れ", "re"], ["ろ", "ro"]]],
  ["wa", "W", [["わ", "wa"], null, null, null, ["を", "wo"]]],
  ["n", "N", [["ん", "n"], null, null, null, null]],
];
const H_DAKUTEN = [
  ["ga", "K → G", [["が", "ga"], ["ぎ", "gi"], ["ぐ", "gu"], ["げ", "ge"], ["ご", "go"]]],
  ["za", "S → Z", [["ざ", "za"], ["じ", "ji"], ["ず", "zu"], ["ぜ", "ze"], ["ぞ", "zo"]]],
  ["da", "T → D", [["だ", "da"], ["ぢ", "ji"], ["づ", "zu"], ["で", "de"], ["ど", "do"]]],
  ["ba", "H → B", [["ば", "ba"], ["び", "bi"], ["ぶ", "bu"], ["べ", "be"], ["ぼ", "bo"]]],
  ["pa", "H → P", [["ぱ", "pa"], ["ぴ", "pi"], ["ぷ", "pu"], ["ぺ", "pe"], ["ぽ", "po"]]],
];
const YOON_BASES = [
  ["き", "ky"], ["し", "sh"], ["ち", "ch"], ["に", "ny"], ["ひ", "hy"], ["み", "my"], ["り", "ry"],
  ["ぎ", "gy"], ["じ", "j"], ["ぢ", "j"], ["び", "by"], ["ぴ", "py"],
];
const H_YOON = YOON_BASES.map(([base, c]) => [
  `yoon-${toKatakanaSafeKey(base)}`,
  base,
  [["ゃ", "a"], ["ゅ", "u"], ["ょ", "o"]].map(([s, v]) => [base + s, c + v]),
]);
function toKatakanaSafeKey(k) {
  const m = { き: "ki", し: "shi", ち: "chi", に: "ni", ひ: "hi", み: "mi", り: "ri", ぎ: "gi", じ: "ji", ぢ: "di", び: "bi", ぴ: "pi" };
  return m[k];
}
function kata(s) {
  return [...s].map((ch) => {
    const c = ch.codePointAt(0);
    return c >= 0x3041 && c <= 0x3096 ? String.fromCodePoint(c + 0x60) : ch;
  }).join("");
}
function toKata(rows) {
  return rows.map(([key, label, cells]) => [key, kata(label), cells.map((c) => (c ? [kata(c[0]), c[1]] : null))]);
}
const K_BASIC = toKata(H_BASIC);
const K_DAKUTEN = toKata(H_DAKUTEN);
const K_YOON = toKata(H_YOON);

const H_CONFUSABLE = [["さ", "き"], ["ぬ", "め"], ["わ", "ね", "れ"], ["は", "ほ"], ["る", "ろ"], ["あ", "お"], ["い", "り"], ["こ", "に"], ["ち", "ら"], ["す", "む"], ["ゆ", "よ"], ["け", "は"], ["う", "ら"]];
const K_CONFUSABLE = [["シ", "ツ"], ["ン", "ソ"], ["ク", "ケ", "タ"], ["ワ", "ウ", "フ"], ["ア", "マ"], ["ナ", "メ"], ["チ", "テ"], ["コ", "ユ", "ヨ"], ["ル", "レ"], ["ス", "ヌ", "ヲ"]];

function chart(title, rows, rowLabels = true) {
  return {
    kind: "kana-chart",
    title,
    rows: rows.map(([, , cells]) => cells.map((c) => (c ? { kana: c[0], romaji: c[1] } : null))),
    ...(rowLabels ? { rowLabels: rows.map(([, label]) => label) } : {}),
  };
}
const text = (...paragraphs) => ({ kind: "text", paragraphs });
const table = (title, columns, rows) => ({ kind: "table", title, columns, rows });
const list = (title, items) => ({ kind: "list", title, items });
const words = (title, items) => ({ kind: "words", title, items: items.map(([ja, reading, en]) => ({ ja, reading, en })) });
const callout = (title, t, tone = "info") => ({ kind: "callout", title, text: t, tone });

/* ---------------- questions ---------------- */
const questions = [];
let qn = 0;
function addQ({ prompt, options, answerIndex, explanation, dx, topic, foundationId, difficulty = 1 }) {
  qn++;
  questions.push({
    id: `q-kana-${qn}`,
    type: "mc",
    level: "foundation",
    difficulty,
    skill: "kana",
    topic,
    tags: { grammarIds: [], vocabIds: [], kanjiIds: [], foundationId },
    prompt,
    options,
    answerIndex,
    explanation,
    distractorExplanations: dx,
  });
  return `q-kana-${qn}`;
}

/** Build kana questions for one script. Returns { byGroup: {basic:[ids], dakuten:[ids], yoon:[ids]} }. */
function kanaQuestions(script, basic, dakuten, yoon, confusable, lessonBasic, lessonCombo) {
  const label = script === "hiragana" ? "hiragana" : "katakana";
  const all = [...basic, ...dakuten, ...yoon];
  // lookup helpers
  const cells = all.flatMap(([key, , cs]) => cs.filter(Boolean).map((c) => ({ kana: c[0], romaji: c[1], row: key })));
  const romajiToKana = new Map();
  for (const c of cells) if (!romajiToKana.has(c.romaji)) romajiToKana.set(c.romaji, c.kana);
  const kanaToRomaji = new Map(cells.map((c) => [c.kana, c.romaji]));
  const colOf = (kana) => {
    for (const [, , cs] of all) {
      const i = cs.findIndex((c) => c && c[0] === kana);
      if (i >= 0) return i;
    }
    return -1;
  };
  const sameRow = (kana, row) => cells.filter((c) => c.row === row && c.kana !== kana);
  const sameCol = (kana, group) => {
    const col = colOf(kana);
    return group.flatMap(([, , cs]) => (cs[col] ? [{ kana: cs[col][0], romaji: cs[col][1] }] : [])).filter((c) => c.kana !== kana);
  };
  const confusableOf = (kana) => (confusable.find((set) => set.includes(kana)) ?? []).filter((k) => k !== kana).map((k) => ({ kana: k, romaji: kanaToRomaji.get(k) }));

  const ids = { basic: [], dakuten: [], yoon: [] };
  const groups = [
    ["basic", basic, lessonBasic],
    ["dakuten", dakuten, lessonCombo],
    ["yoon", yoon, lessonCombo],
  ];
  for (const [gname, group, lessonId] of groups) {
    for (const [rowKey, , cs] of group) {
      for (const c of cs) {
        if (!c) continue;
        const [kana, romaji] = c;
        const rare = kana === "ぢ" || kana === "づ" || kana === "ヂ" || kana === "ヅ" || kana.startsWith("ぢ") || kana.startsWith("ヂ");
        // ---- kana -> romaji ----
        const pool = [];
        const push = (c2) => {
          if (c2.romaji !== romaji && !pool.some((p) => p.romaji === c2.romaji)) pool.push(c2);
        };
        confusableOf(kana).forEach(push);
        shuffle(sameRow(kana, rowKey)).forEach(push);
        shuffle(sameCol(kana, group)).forEach(push);
        shuffle(cells).forEach(push);
        const dis = [...pool.slice(0, Math.min(2, confusableOf(kana).length)), ...pool.slice(Math.min(2, confusableOf(kana).length))].slice(0, 3);
        const opts = shuffle([{ kana, romaji }, ...dis]);
        const ai = opts.findIndex((o) => o.romaji === romaji);
        const topic = `${label}-${gname === "basic" ? "" : gname + "-"}${rowKey.replace(/^yoon-/, "")}${gname === "basic" ? "-row" : ""}`;
        const q1 = addQ({
          prompt: `How is ${kana} read?`,
          options: opts.map((o) => o.romaji),
          answerIndex: ai,
          explanation: rare
            ? `${kana} is read "${romaji}", the same sound as ${romajiToKana.get(romaji)}. It is rare and appears mainly in compound words or after a doubled ち/つ sound.`
            : `${kana} is the ${label} for "${romaji}"${romaji === "wo" ? ' (as the object particle it is pronounced "o")' : ""}.`,
          dx: opts.map((o) => (o.romaji === romaji ? "(correct answer)" : `"${o.romaji}" is ${o.kana}, not ${kana}.`)),
          topic,
          foundationId: lessonId,
          difficulty: gname === "basic" ? 1 : 2,
        });
        ids[gname].push(q1);
        // ---- romaji -> kana (basic: all; combos: sample) ----
        const wantReverse = gname === "basic" || (gname === "yoon" && !rare && rand() < 0.35) || (gname === "dakuten" && !rare && rand() < 0.3);
        if (wantReverse) {
          const kpool = [];
          const kpush = (c2) => {
            if (c2.kana !== kana && c2.romaji !== romaji && !kpool.some((p) => p.kana === c2.kana)) kpool.push(c2);
          };
          confusableOf(kana).forEach(kpush);
          shuffle(sameRow(kana, rowKey)).forEach(kpush);
          shuffle(sameCol(kana, group)).forEach(kpush);
          shuffle(cells.filter((x) => x.row.startsWith(gname === "yoon" ? "yoon" : "") )).forEach(kpush);
          shuffle(cells).forEach(kpush);
          const kdis = kpool.slice(0, 3);
          const kopts = shuffle([{ kana, romaji }, ...kdis]);
          const kai = kopts.findIndex((o) => o.kana === kana);
          const q2 = addQ({
            prompt: `Which ${label} is "${romaji}"?`,
            options: kopts.map((o) => o.kana),
            answerIndex: kai,
            explanation: `"${romaji}" is written ${kana} in ${label}.`,
            dx: kopts.map((o) => (o.kana === kana ? "(correct answer)" : `${o.kana} is read "${o.romaji}".`)),
            topic,
            foundationId: lessonId,
            difficulty: gname === "basic" ? 1 : 2,
          });
          ids[gname].push(q2);
        }
      }
    }
  }
  return ids;
}

const hIds = kanaQuestions("hiragana", H_BASIC, H_DAKUTEN, H_YOON, H_CONFUSABLE, "foundation-1", "foundation-2");
const kIds = kanaQuestions("katakana", K_BASIC, K_DAKUTEN, K_YOON, K_CONFUSABLE, "foundation-3", "foundation-4");

/** Hand-written questions: [prompt, options, answerIndex, explanation, distractorExplanations, topic] */
function manual(foundationId, difficulty, items) {
  return items.map(([prompt, options, answerIndex, explanation, dx, topic]) =>
    addQ({ prompt, options, answerIndex, explanation, dx, topic, foundationId, difficulty })
  );
}

const PRON_Q = manual("foundation-5", 2, [
  ["How many beats (morae) does とうきょう have?", ["4", "3", "5", "2"], 0, "と-う-きょ-う = 4 beats. きょ is one beat; the long vowels add one beat each.", ["(correct answer)", "Counts きょう as one beat; the う adds a beat.", "Counts きょ as two beats; the small ょ does not add a beat.", "Every kana except small ゃゅょ is a beat."], "mora-timing"],
  ["How many beats does きって have?", ["3", "2", "4", "1"], 0, "き-っ-て = 3 beats. The small っ is a full beat of silence.", ["(correct answer)", "Ignores the small っ, which is a full beat.", "Too many; each kana is exactly one beat.", "Far too few."], "mora-timing"],
  ["Which word means \"hospital\"?", ["びょういん", "びよういん", "びょいん", "びよいん"], 0, "びょういん (byōin) = hospital, 4 beats. びよういん (biyōin) with big よ is \"beauty salon\".", ["(correct answer)", "びよういん = beauty salon (big よ, 5 beats).", "Missing the long vowel う.", "Wrong size of よ and missing the long vowel."], "yoon-size"],
  ["Which word means \"grandmother\"?", ["おばあさん", "おばさん", "おじいさん", "おじさん"], 0, "おばあさん (5 beats) = grandmother. Without the long vowel, おばさん = aunt.", ["(correct answer)", "おばさん = aunt (4 beats).", "おじいさん = grandfather.", "おじさん = uncle."], "long-vowels"],
  ["How is \"school\" (gakkō) written in hiragana?", ["がっこう", "がっこお", "がこう", "がっこ"], 0, "Long ō is usually written with う: がっこう. The small っ doubles the k.", ["(correct answer)", "ō is written with う here, not お.", "Missing the small っ (double consonant).", "Missing the long vowel."], "long-vowels"],
  ["Which word spells its long ō with お rather than う?", ["おおきい", "おとうさん", "がっこう", "きょう"], 0, "おおきい (big) belongs to the small fixed set spelled with お: おおきい, とおい, とお, こおり, おおい, とおる.", ["(correct answer)", "おとうさん uses う.", "がっこう uses う.", "きょう uses う."], "long-vowels"],
  ["Which word means \"stamp\"?", ["きって", "きて", "きっで", "きてい"], 0, "きって (kit-te, 3 beats) = stamp. きて (2 beats) is the て-form of \"come\".", ["(correct answer)", "きて = come (て-form), 2 beats.", "Not a word; て is not voiced here.", "Not a word."], "double-consonants"],
  ["あめ said with a HIGH-LOW pitch (H-L) means…", ["rain", "candy", "sea", "flower"], 0, "あ↓め (H-L, atamadaka) = rain 雨. あめ L-H = candy 飴.", ["(correct answer)", "Candy is あめ with L-H pitch.", "Sea is うみ.", "Flower is はな."], "pitch-accent"],
  ["はし said with a HIGH-LOW pitch (H-L) means…", ["chopsticks", "bridge", "edge", "corner"], 0, "は↓し (H-L) = chopsticks 箸. Bridge 橋 is L-H with a low particle; edge 端 is L-H with a high particle.", ["(correct answer)", "Bridge is L-H (particle low).", "Edge is L-H (particle high).", "Corner is かど."], "pitch-accent"],
  ["What changes between morae in Japanese words?", ["pitch", "volume", "vowel length", "stress"], 0, "Japanese uses pitch (high / low), not stress. Volume stays flat and every mora has the same length.", ["(correct answer)", "Volume stays flat.", "Length is fixed at one beat per mora.", "Japanese does not stress syllables as English does."], "pitch-accent"],
  ["Which word means \"ice\"?", ["こおり", "こうり", "こり", "こおうり"], 0, "こおり (ice) is one of the few words that spell long ō with お.", ["(correct answer)", "Wrong spelling; こおり uses お.", "Missing the long vowel.", "Not a word."], "long-vowels"],
  ["Which word means \"husband\"?", ["おっと", "おと", "おっど", "おうと"], 0, "おっと (ot-to) = husband. おと (2 beats) = sound.", ["(correct answer)", "おと = sound.", "Not a word; と is not voiced.", "Not a word."], "double-consonants"],
  ["How many beats does しんかんせん (bullet train) have?", ["6", "5", "4", "7"], 0, "し-ん-か-ん-せ-ん = 6 beats. Each ん is its own beat.", ["(correct answer)", "Forgets one ん.", "Forgets both ん.", "Too many."], "mora-timing"],
  ["In native Japanese words, small っ never appears before…", ["a vowel", "k", "t", "p"], 0, "Small っ doubles k, s, t, p (and sh, ch, ts). It never comes before a vowel, n, m, r, y or w in native words.", ["(correct answer)", "がっこう: っ before k is normal.", "きって: っ before t is normal.", "きっぷ: っ before p is normal."], "double-consonants"],
  ["ゆうき means…", ["courage", "snow", "winter", "evening"], 0, "ゆうき (yūki, 3 beats) = courage. ゆき (2 beats) = snow.", ["(correct answer)", "Snow is ゆき without the long vowel.", "Winter is ふゆ.", "Evening is ゆうがた."], "long-vowels"],
  ["ビール means…", ["beer", "building", "bill", "bell"], 0, "ビール (bīru) = beer. ビル (biru, no long vowel) = building.", ["(correct answer)", "Building is ビル.", "Not this word.", "Not this word."], "long-vowels"],
  ["Which is the correct hiragana spelling of \"teacher\" (sensei)?", ["せんせい", "せんせえ", "せんせ", "せんせー"], 0, "Long ē is usually written with い: せんせい, えいご, とけい. Only a few words use え (おねえさん, ええ).", ["(correct answer)", "え is used only in a few words such as おねえさん.", "Missing the long vowel.", "ー is used in katakana, not hiragana."], "long-vowels"],
  ["こうこう means…", ["high school", "here", "airport", "coffee"], 0, "こうこう (kōkō, 4 beats) = high school. ここ (2 beats) = here.", ["(correct answer)", "Here is ここ.", "Airport is くうこう.", "Coffee is コーヒー."], "long-vowels"],
  ["Which word means \"went\"?", ["いった", "いた", "いっだ", "いいた"], 0, "いった (it-ta) = went. いた (2 beats) = was / existed.", ["(correct answer)", "いた = was.", "Not a word; た is not voiced.", "Not a word."], "double-consonants"],
  ["Which word has the flat (heiban) pitch pattern L-H-H?", ["さかな (fish)", "あめ (rain)", "こころ (heart)", "はし (chopsticks)"], 0, "さかな is heiban: it starts low, rises and stays high, and a following particle stays high too.", ["(correct answer)", "あめ (rain) is H-L (atamadaka).", "こころ is L-H-L (nakadaka).", "はし (chopsticks) is H-L."], "pitch-accent"],
]);

const NUM_Q = manual("foundation-6", 2, [
  ["How do you read 三本?", ["さんぼん", "さんほん", "さんぽん", "みぼん"], 0, "With 本, 3 voices to さんぼん. The h-counters change at 1, 3, 6, 8, 10.", ["(correct answer)", "ほん does not stay unvoiced after さん.", "ぽん appears after いっ, ろっ, はっ, じゅっ, not after さん.", "Sino-Japanese さん is used with 本, not native み."], "counters-hon"],
  ["How do you read 一本?", ["いっぽん", "いちほん", "いっぼん", "ひとほん"], 0, "1 + 本 = いっぽん: いち shortens to いっ and h becomes p.", ["(correct answer)", "いち contracts to いっ before 本.", "The sound change is to p, not b.", "Native ひと is not used with 本."], "counters-hon"],
  ["How do you read 300?", ["さんびゃく", "さんひゃく", "さんぴゃく", "みひゃく"], 0, "300 = さんびゃく (sound change). 600 = ろっぴゃく, 800 = はっぴゃく.", ["(correct answer)", "ひゃく voices to びゃく after さん.", "ぴゃく is used for 600 and 800.", "Native み is not used here."], "numbers-hundreds"],
  ["How do you read 600?", ["ろっぴゃく", "ろくひゃく", "ろっびゃく", "ろくぴゃく"], 0, "600 = ろっぴゃく: ろく contracts to ろっ and h becomes p.", ["(correct answer)", "ろく contracts and ひゃく changes.", "The change is to p, not b.", "ろく must contract to ろっ."], "numbers-hundreds"],
  ["How do you read 3,000?", ["さんぜん", "さんせん", "さんぜい", "みせん"], 0, "3,000 = さんぜん (sound change). 8,000 = はっせん.", ["(correct answer)", "せん voices to ぜん after さん.", "Not a reading.", "Native み is not used here."], "numbers-thousands"],
  ["How do you read 8,000?", ["はっせん", "はちせん", "はっぜん", "やせん"], 0, "8,000 = はっせん: はち contracts to はっ.", ["(correct answer)", "はち contracts to はっ before せん.", "せん does not voice after はっ.", "Native や is not used here."], "numbers-thousands"],
  ["How do you read 10,000?", ["いちまん", "まん", "じゅうせん", "いっまん"], 0, "10,000 = いちまん. Unlike 百 and 千, 万 needs いち in front.", ["(correct answer)", "万 always takes いち in front.", "Japanese groups by 10,000, not 1,000.", "Not a reading."], "numbers-thousands"],
  ["How do you read 一人 (one person)?", ["ひとり", "いちにん", "いちり", "ひとにん"], 0, "1 and 2 people are irregular: ひとり, ふたり. From 3, use 〜にん.", ["(correct answer)", "Not used for one person.", "Not a reading.", "Not a reading."], "counters-nin"],
  ["How do you read 二人 (two people)?", ["ふたり", "ににん", "ふたにん", "にり"], 0, "2 people = ふたり (irregular).", ["(correct answer)", "Not used for two people.", "Not a reading.", "Not a reading."], "counters-nin"],
  ["How do you read 四人 (four people)?", ["よにん", "よんにん", "しにん", "よったり"], 0, "4 people = よにん, not よんにん.", ["(correct answer)", "よん drops its ん before にん.", "し is avoided here.", "Not a reading."], "counters-nin"],
  ["How do you read 三匹 (three small animals)?", ["さんびき", "さんひき", "さんぴき", "みびき"], 0, "匹 follows the h-pattern: いっぴき, さんびき, ろっぴき, はっぴき, じゅっぴき.", ["(correct answer)", "ひき voices after さん.", "ぴき is used after いっ, ろっ, はっ, じゅっ.", "Native み is not used here."], "counters-hiki"],
  ["How do you read 三階 (third floor)?", ["さんがい", "さんかい", "さんばい", "みかい"], 0, "3rd floor = さんがい (voiced). \"Which floor?\" = なんがい.", ["(correct answer)", "かい voices to がい after さん for floors.", "Not a reading.", "Native み is not used here."], "counters-kai-floor"],
  ["How do you say \"20 years old\"?", ["はたち", "にじゅっさい", "にじゅうさい", "にじゅさい"], 0, "20 years old is the special word はたち (二十歳).", ["(correct answer)", "Regular pattern, but 20 is irregular.", "Not a reading.", "Not a reading."], "counters-sai"],
  ["How do you read 四円 (4 yen)?", ["よえん", "よんえん", "しえん", "よっえん"], 0, "4 yen = よえん, not よんえん.", ["(correct answer)", "よん drops its ん before えん.", "し is avoided here.", "Not a reading."], "counters-en"],
  ["How do you say \"three (things)\" with the general counter 〜つ?", ["みっつ", "さんつ", "みつ", "みっこ"], 0, "〜つ uses native numbers: ひとつ, ふたつ, みっつ, よっつ, いつつ…", ["(correct answer)", "〜つ never takes Sino-Japanese numbers.", "Missing the small っ.", "個 is a different counter (さんこ)."], "counters-tsu"],
  ["How do you read 十冊 (ten books)?", ["じゅっさつ", "じゅうさつ", "じゅっざつ", "とおさつ"], 0, "10 + 冊 = じゅっさつ (also じっさつ).", ["(correct answer)", "じゅう contracts to じゅっ before さつ.", "さつ does not voice.", "Native とお is not used here."], "counters-satsu"],
  ["How do you read 八回 (eight times)?", ["はっかい", "はちかい", "はっがい", "やかい"], 0, "8 times = はっかい: はち contracts before かい.", ["(correct answer)", "はち contracts to はっ.", "回 does not voice.", "Native や is not used here."], "counters-kai-times"],
  ["How do you read 六個 (six pieces)?", ["ろっこ", "ろくこ", "ろっご", "むこ"], 0, "6 + 個 = ろっこ. Also いっこ, はっこ, じゅっこ.", ["(correct answer)", "ろく contracts to ろっ.", "こ does not voice.", "Native む is not used here."], "counters-ko"],
  ["How do you read 40?", ["よんじゅう", "しじゅう", "よじゅう", "よんじゅ"], 0, "40 = よんじゅう (never しじゅう in modern counting).", ["(correct answer)", "し is not used for 40.", "よん keeps its ん here.", "Missing the long vowel."], "numbers-tens"],
  ["How do you read 100?", ["ひゃく", "いちひゃく", "いっぴゃく", "ひゃっ"], 0, "100 = ひゃく with no いち in front. Likewise 1,000 = せん.", ["(correct answer)", "百 does not take いち.", "Not a reading for 100.", "Not a reading."], "numbers-hundreds"],
]);

const DATE_Q = manual("foundation-7", 2, [
  ["How do you read 四月 (April)?", ["しがつ", "よんがつ", "しつき", "よがつ"], 0, "April = しがつ. April, July and September use し, しち, く.", ["(correct answer)", "よん is not used for April.", "Months use がつ.", "Not a reading."], "months"],
  ["How do you read 七月 (July)?", ["しちがつ", "なながつ", "しちつき", "なつがつ"], 0, "July = しちがつ.", ["(correct answer)", "なな is not used for July.", "Months use がつ.", "Not a reading."], "months"],
  ["How do you read 九月 (September)?", ["くがつ", "きゅうがつ", "くつき", "きゅがつ"], 0, "September = くがつ.", ["(correct answer)", "きゅう is not used for September.", "Months use がつ.", "Not a reading."], "months"],
  ["How do you read 四時 (4 o'clock)?", ["よじ", "よんじ", "しじ", "よっじ"], 0, "4 o'clock = よじ.", ["(correct answer)", "よん drops its ん before じ.", "し is not used for 4 o'clock.", "Not a reading."], "clock-time"],
  ["How do you read 七時 (7 o'clock)?", ["しちじ", "ななじ", "しっじ", "なのじ"], 0, "7 o'clock = しちじ.", ["(correct answer)", "なな is not used with 時.", "Not a reading.", "Not a reading."], "clock-time"],
  ["How do you read 九時 (9 o'clock)?", ["くじ", "きゅうじ", "ここのじ", "くっじ"], 0, "9 o'clock = くじ.", ["(correct answer)", "きゅう is not used with 時.", "Native numbers are not used with 時.", "Not a reading."], "clock-time"],
  ["How do you read 1日 (the 1st of the month)?", ["ついたち", "いちにち", "ひとか", "いっか"], 0, "The 1st = ついたち. いちにち means \"one day\" (duration).", ["(correct answer)", "いちにち = one day (duration), not the date.", "Not a reading.", "Not a reading."], "dates"],
  ["How do you read 8日 (the 8th)?", ["ようか", "よっか", "はちにち", "やか"], 0, "The 8th = ようか. Do not confuse with よっか (4th).", ["(correct answer)", "よっか = the 4th.", "Days 1–10 use native readings.", "Not a reading."], "dates"],
  ["How do you read 4日 (the 4th)?", ["よっか", "ようか", "よんにち", "しにち"], 0, "The 4th = よっか. ようか is the 8th.", ["(correct answer)", "ようか = the 8th.", "Days 1–10 use native readings.", "Not a reading."], "dates"],
  ["How do you read 20日 (the 20th)?", ["はつか", "はたち", "にじゅうにち", "にじゅっか"], 0, "The 20th = はつか. はたち is 20 years old.", ["(correct answer)", "はたち = 20 years old.", "The 20th is irregular.", "Not a reading."], "dates"],
  ["How do you read 14日 (the 14th)?", ["じゅうよっか", "じゅうよんにち", "じゅうしにち", "じゅうようか"], 0, "The 14th = じゅうよっか; the 24th = にじゅうよっか.", ["(correct answer)", "14 keeps the irregular よっか.", "Not a reading.", "ようか is 8, not 4."], "dates"],
  ["How do you read 一分 (1 minute)?", ["いっぷん", "いちふん", "いっふん", "いちぷん"], 0, "1 minute = いっぷん. 分 follows the h/p pattern.", ["(correct answer)", "いち contracts and ふ becomes ぷ.", "ふん becomes ぷん after いっ.", "いち must contract."], "minutes"],
  ["How do you read 三分 (3 minutes)?", ["さんぷん", "さんふん", "さんぶん", "みふん"], 0, "3 minutes = さんぷん.", ["(correct answer)", "ふん changes after さん.", "It becomes ぷん, not ぶん.", "Native み is not used here."], "minutes"],
  ["How do you read 十分 (10 minutes)?", ["じゅっぷん", "じゅうふん", "じゅうぷん", "とおふん"], 0, "10 minutes = じゅっぷん (also じっぷん).", ["(correct answer)", "じゅう contracts before ぷん.", "じゅう must contract to じゅっ.", "Native とお is not used here."], "minutes"],
  ["How do you say 7:30?", ["しちじはん", "ななじはん", "しちじさんじゅう", "しちはん"], 0, "7:30 = しちじはん (はん = half past). さんじゅっぷん is also possible.", ["(correct answer)", "7 o'clock is しちじ.", "Minutes need ぷん: さんじゅっぷん.", "Missing じ."], "clock-time"],
  ["How do you read 水曜日 (Wednesday)?", ["すいようび", "みずようび", "もくようび", "かようび"], 0, "Wednesday = すいようび (水 water).", ["(correct answer)", "水 is read すい in 水曜日.", "もくようび = Thursday.", "かようび = Tuesday."], "days-of-week"],
  ["How do you read 木曜日 (Thursday)?", ["もくようび", "きようび", "すいようび", "どようび"], 0, "Thursday = もくようび (木 tree).", ["(correct answer)", "木 is read もく here.", "すいようび = Wednesday.", "どようび = Saturday."], "days-of-week"],
  ["Which means \"next week\"?", ["らいしゅう", "せんしゅう", "こんしゅう", "さらいしゅう"], 0, "らいしゅう = next week. せん = last, こん = this, さらい = the one after next.", ["(correct answer)", "せんしゅう = last week.", "こんしゅう = this week.", "さらいしゅう = the week after next."], "relative-time"],
  ["Which means \"the day after tomorrow\"?", ["あさって", "おととい", "あした", "きのう"], 0, "あさって = the day after tomorrow.", ["(correct answer)", "おととい = the day before yesterday.", "あした = tomorrow.", "きのう = yesterday."], "relative-time"],
  ["How do you say \"9 a.m.\"?", ["ごぜんくじ", "ごごくじ", "くじごぜん", "ごぜんきゅうじ"], 0, "ごぜん (a.m.) goes before the time: ごぜんくじ.", ["(correct answer)", "ごご = p.m.", "ごぜん comes before the time, not after.", "9 o'clock is くじ."], "clock-time"],
]);

const GREET_Q = manual("foundation-8", 1, [
  ["What do you say before eating?", ["いただきます", "ごちそうさまでした", "いってきます", "ただいま"], 0, "いただきます is said before a meal.", ["(correct answer)", "Said after eating.", "Said when leaving home.", "Said when arriving home."], "greetings-meals"],
  ["What do you say after eating?", ["ごちそうさまでした", "いただきます", "おつかれさまでした", "おかえりなさい"], 0, "ごちそうさまでした thanks for the meal after eating.", ["(correct answer)", "Said before eating.", "Thanks for hard work.", "Welcome home."], "greetings-meals"],
  ["What do you say when leaving home?", ["いってきます", "いってらっしゃい", "ただいま", "おかえりなさい"], 0, "いってきます = I'm off. The reply is いってらっしゃい.", ["(correct answer)", "The reply, said by the person staying.", "Said when you come home.", "Said to someone coming home."], "greetings-home"],
  ["What is the reply to いってきます?", ["いってらっしゃい", "いってきます", "おかえりなさい", "ただいま"], 0, "いってらっしゃい = take care / see you.", ["(correct answer)", "That is what the leaving person says.", "Reply to ただいま.", "Said when arriving home."], "greetings-home"],
  ["What do you say when you get home?", ["ただいま", "おかえりなさい", "いってきます", "こんにちは"], 0, "ただいま = I'm home.", ["(correct answer)", "The reply, said by the person at home.", "Said when leaving.", "General daytime greeting."], "greetings-home"],
  ["What do you say to someone who has just come home?", ["おかえりなさい", "ただいま", "いってらっしゃい", "おやすみなさい"], 0, "おかえりなさい = welcome home.", ["(correct answer)", "Said by the person arriving.", "Said to someone leaving.", "Good night."], "greetings-home"],
  ["Which means \"good evening\"?", ["こんばんは", "こんにちは", "おはようございます", "おやすみなさい"], 0, "こんばんは = good evening (は read wa).", ["(correct answer)", "Hello / good afternoon.", "Good morning.", "Good night (before sleeping)."], "greetings-daily"],
  ["Which means \"good night\"?", ["おやすみなさい", "こんばんは", "さようなら", "おつかれさまでした"], 0, "おやすみなさい is said before sleeping or when parting at night.", ["(correct answer)", "Good evening (a greeting, not a farewell).", "Goodbye.", "Thanks for your hard work."], "greetings-daily"],
  ["Which means \"you're welcome\"?", ["どういたしまして", "ありがとうございます", "すみません", "ごめんなさい"], 0, "どういたしまして answers a thank-you.", ["(correct answer)", "Thank you.", "Excuse me / sorry.", "I'm sorry."], "greetings-daily"],
  ["What do you say when meeting someone for the first time?", ["はじめまして", "はじめましょう", "おげんきですか", "しつれいします"], 0, "はじめまして = how do you do.", ["(correct answer)", "Let's begin (classroom).", "How are you?", "Excuse me (entering / leaving)."], "greetings-meeting"],
  ["Which phrase ends a self-introduction?", ["どうぞよろしくおねがいします", "おねがいします", "はじめまして", "しつれいします"], 0, "どうぞよろしくおねがいします closes a self-introduction.", ["(correct answer)", "Please (a request).", "Opens, not closes, a first meeting.", "Excuse me."], "greetings-meeting"],
  ["Which means \"once more, please\"?", ["もういちどおねがいします", "ゆっくりおねがいします", "ちょっとまってください", "おねがいします"], 0, "もういちど = once more.", ["(correct answer)", "Slowly, please.", "Please wait a moment.", "Please."], "classroom"],
  ["Which means \"slowly, please\"?", ["ゆっくりおねがいします", "もういちどおねがいします", "みてください", "きいてください"], 0, "ゆっくり = slowly.", ["(correct answer)", "Once more, please.", "Please look.", "Please listen."], "classroom"],
  ["Which means \"I don't understand\"?", ["わかりません", "わかりました", "しつもんがあります", "すみません"], 0, "わかりません = I don't understand / I don't know.", ["(correct answer)", "I understand.", "I have a question.", "Excuse me."], "classroom"],
  ["Which means \"please write\"?", ["かいてください", "よんでください", "きいてください", "みてください"], 0, "かいてください = please write.", ["(correct answer)", "Please read.", "Please listen.", "Please look."], "classroom"],
  ["Which means \"please listen\"?", ["きいてください", "かいてください", "いってください", "みてください"], 0, "きいてください = please listen.", ["(correct answer)", "Please write.", "Please say (it).", "Please look."], "classroom"],
  ["Which means \"let's begin\"?", ["はじめましょう", "おわりましょう", "はじめまして", "おねがいします"], 0, "はじめましょう = let's begin; おわりましょう = let's finish.", ["(correct answer)", "Let's finish.", "How do you do.", "Please."], "classroom"],
  ["What do you say when leaving work before your colleagues?", ["おさきにしつれいします", "おつかれさまでした", "しつれいします", "さようなら"], 0, "おさきにしつれいします = excuse me for leaving before you.", ["(correct answer)", "Said to others for their hard work.", "Generic excuse me when entering / leaving.", "Too formal / final for colleagues."], "greetings-work"],
  ["How is the final は of こんにちは pronounced?", ["wa", "ha", "ba", "silent"], 0, "こんにちは ends in the particle は, pronounced wa.", ["(correct answer)", "は as a particle is never read ha.", "Not voiced.", "It is pronounced."], "greetings-daily"],
  ["Which means \"I have a question\"?", ["しつもんがあります", "しつれいします", "わかりません", "ちょっとまってください"], 0, "しつもん = question; があります = there is.", ["(correct answer)", "Excuse me.", "I don't understand.", "Please wait a moment."], "classroom"],
]);

/* ---------------- lessons ---------------- */
const HIRAGANA_WORDS_1 = [
  ["あさ", "asa", "morning"], ["いぬ", "inu", "dog"], ["ねこ", "neko", "cat"], ["うみ", "umi", "sea"], ["やま", "yama", "mountain"],
  ["かわ", "kawa", "river"], ["そら", "sora", "sky"], ["あめ", "ame", "rain"], ["ゆき", "yuki", "snow"], ["はな", "hana", "flower; nose"],
  ["き", "ki", "tree"], ["さかな", "sakana", "fish"], ["にく", "niku", "meat"], ["くるま", "kuruma", "car"], ["ひと", "hito", "person"],
  ["なまえ", "namae", "name"], ["ほん", "hon", "book"], ["つくえ", "tsukue", "desk"], ["いす", "isu", "chair"], ["へや", "heya", "room"],
];
const HIRAGANA_WORDS_2 = [
  ["がっこう", "gakkō", "school"], ["せんせい", "sensei", "teacher"], ["がくせい", "gakusei", "student"], ["ともだち", "tomodachi", "friend"], ["かぞく", "kazoku", "family"],
  ["おかあさん", "okāsan", "mother"], ["おとうさん", "otōsan", "father"], ["でんしゃ", "densha", "train"], ["たまご", "tamago", "egg"], ["ごはん", "gohan", "cooked rice; meal"],
  ["おちゃ", "ocha", "tea"], ["びょういん", "byōin", "hospital"], ["じかん", "jikan", "time"], ["きょう", "kyō", "today"], ["えんぴつ", "enpitsu", "pencil"],
  ["かばん", "kaban", "bag"], ["おおきい", "ōkii", "big"], ["ちいさい", "chiisai", "small"], ["ざっし", "zasshi", "magazine"], ["しゅくだい", "shukudai", "homework"],
];
const KATAKANA_WORDS_3 = [
  ["ホテル", "hoteru", "hotel"], ["レストラン", "resutoran", "restaurant"], ["カメラ", "kamera", "camera"], ["トイレ", "toire", "toilet"], ["ミルク", "miruku", "milk"],
  ["ワイン", "wain", "wine"], ["サラダ", "sarada", "salad"], ["テニス", "tenisu", "tennis"], ["クラス", "kurasu", "class"], ["テスト", "tesuto", "test"],
  ["アメリカ", "amerika", "America, USA"], ["カナダ", "kanada", "Canada"], ["フランス", "furansu", "France"], ["ネクタイ", "nekutai", "necktie"], ["テレビ", "terebi", "television"],
  ["バス", "basu", "bus"], ["パン", "pan", "bread"], ["ピアノ", "piano", "piano"], ["ペン", "pen", "pen"], ["ラジオ", "rajio", "radio"],
];
const KATAKANA_WORDS_4 = [
  ["コーヒー", "kōhī", "coffee"], ["コンビニ", "konbini", "convenience store"], ["スーパー", "sūpā", "supermarket"], ["デパート", "depāto", "department store"], ["タクシー", "takushī", "taxi"],
  ["コンピューター", "konpyūtā", "computer"], ["パソコン", "pasokon", "personal computer"], ["テーブル", "tēburu", "table"], ["ドア", "doa", "door"], ["ベッド", "beddo", "bed"],
  ["シャワー", "shawā", "shower"], ["エレベーター", "erebētā", "elevator"], ["ビル", "biru", "building"], ["アパート", "apāto", "apartment"], ["マンション", "manshon", "condominium (not a mansion)"],
  ["ジュース", "jūsu", "juice"], ["ビール", "bīru", "beer"], ["ケーキ", "kēki", "cake"], ["チョコレート", "chokorēto", "chocolate"], ["ハンバーガー", "hanbāgā", "hamburger"],
  ["サンドイッチ", "sandoitchi", "sandwich"], ["メニュー", "menyū", "menu"], ["シャツ", "shatsu", "shirt"], ["サッカー", "sakkā", "soccer"], ["ニュース", "nyūsu", "news"],
  ["ノート", "nōto", "notebook"], ["パーティー", "pātī", "party"], ["メール", "mēru", "email"], ["インターネット", "intānetto", "internet"], ["アルバイト", "arubaito", "part-time job (from German Arbeit)"],
];

const GREETINGS = [
  ["おはようございます", "ohayō gozaimasu", "Good morning (polite; おはよう among friends)"],
  ["こんにちは", "konnichiwa", "Hello / Good afternoon (は read wa)"],
  ["こんばんは", "konbanwa", "Good evening"],
  ["おやすみなさい", "oyasuminasai", "Good night (before sleeping / parting at night)"],
  ["さようなら", "sayōnara", "Goodbye (formal or long parting; friends say じゃあね / またね)"],
  ["ありがとうございます", "arigatō gozaimasu", "Thank you (ありがとうございました for a completed favour)"],
  ["どういたしまして", "dō itashimashite", "You're welcome"],
  ["すみません", "sumimasen", "Excuse me / Sorry / Thank you for the trouble"],
  ["ごめんなさい", "gomennasai", "I'm sorry (apology, personal)"],
  ["はじめまして", "hajimemashite", "How do you do (first meeting)"],
  ["どうぞよろしくおねがいします", "dōzo yoroshiku onegaishimasu", "Please treat me kindly (ends a self-introduction)"],
  ["おねがいします", "onegaishimasu", "Please (requesting a service / handing something over)"],
  ["いただきます", "itadakimasu", "Said before eating"],
  ["ごちそうさまでした", "gochisōsama deshita", "Said after eating / thanks for the meal"],
  ["いってきます", "ittekimasu", "I'm off (said when leaving home)"],
  ["いってらっしゃい", "itterasshai", "Take care / see you (reply to いってきます)"],
  ["ただいま", "tadaima", "I'm home"],
  ["おかえりなさい", "okaerinasai", "Welcome home"],
  ["おげんきですか", "ogenki desu ka", "How are you?"],
  ["はい、げんきです", "hai, genki desu", "Yes, I'm fine"],
  ["おつかれさまでした", "otsukaresama deshita", "Thank you for your hard work (end of work / class)"],
  ["しつれいします", "shitsurei shimasu", "Excuse me (entering / leaving a room, ending a call)"],
  ["おさきにしつれいします", "osaki ni shitsurei shimasu", "Excuse me for leaving before you"],
  ["はい / いいえ", "hai / iie", "Yes / No"],
  ["わかりました", "wakarimashita", "I understand / Understood"],
  ["わかりません", "wakarimasen", "I don't understand / I don't know"],
  ["もういちどおねがいします", "mō ichido onegaishimasu", "Once more, please"],
  ["ゆっくりおねがいします", "yukkuri onegaishimasu", "Slowly, please"],
  ["〜はにほんごでなんですか", "〜 wa nihongo de nan desu ka", "How do you say 〜 in Japanese?"],
  ["〜はどういういみですか", "〜 wa dō iu imi desu ka", "What does 〜 mean?"],
  ["ちょっとまってください", "chotto matte kudasai", "Please wait a moment"],
  ["しつもんがあります", "shitsumon ga arimasu", "I have a question"],
  ["みてください", "mite kudasai", "Please look"],
  ["きいてください", "kiite kudasai", "Please listen"],
  ["よんでください", "yonde kudasai", "Please read"],
  ["かいてください", "kaite kudasai", "Please write"],
  ["いってください", "itte kudasai", "Please say (it)"],
  ["おぼえてください", "oboete kudasai", "Please memorise"],
  ["はじめましょう", "hajimemashō", "Let's begin"],
  ["おわりましょう", "owarimashō", "Let's finish"],
];

const COUNTER_COLS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "?"];
const counterTable = (title, cells) => table(title, COUNTER_COLS, [cells]);

const lessons = [
  {
    id: "foundation-1",
    slug: "hiragana-basic",
    order: 1,
    kind: "hiragana",
    title: "Hiragana: the basic 46",
    summary: "The first script to master. The 46 basic characters (gojūon), how the rows and columns work, stroke-order tips, the ten pairs learners mix up, and 20 words to read.",
    minutes: 30,
    sections: [
      {
        heading: "What hiragana is for",
        blocks: [
          text(
            "Hiragana is used for native Japanese words, grammatical endings (okurigana), particles, and furigana (reading aids over kanji). It is the first script to master.",
            "Target: read every character in under one second and write all of them from memory within three to four days. Read the chart left to right (a, i, u, e, o); each row shares a consonant."
          ),
        ],
      },
      {
        heading: "The 46 basic characters (五十音 gojūon)",
        blocks: [
          chart("Gojūon chart", H_BASIC),
          callout("Irregular romaji", "し = shi (not si), ち = chi (not ti), つ = tsu (not tu), ふ = fu (not hu), を = wo / o.", "warn"),
          callout(
            "Particle pronunciation rules",
            "は as the topic particle is pronounced wa (わたしは = watashi wa). へ as the direction particle is pronounced e (とうきょうへ = tōkyō e). を is only used as the object particle and is pronounced o.",
            "accent"
          ),
        ],
      },
      {
        heading: "Stroke-order tips",
        blocks: [
          list("General rules that cover almost every character", [
            "Top before bottom. Whatever is highest is written first (あ: the short horizontal stroke, then the vertical, then the loop).",
            "Left before right. When strokes are side by side, write the left one first (い: left curve, then right dot; か: main hook first, then the short diagonal, then the right dot).",
            "Horizontal before vertical when they cross (き: two horizontals, then the vertical curve, then the bottom stroke. さ: horizontal, then the vertical curve, then the bottom).",
            "Enclosing or main frame first, then what sits inside or attached (ほ: left vertical first, then the two horizontals and the loop on the right. は: same idea).",
            "Vertical-through-centre strokes last (ま: the horizontals first, then the vertical that passes through. も is the exception: the vertical hook is written first, then the two horizontals).",
            "Loops are drawn in one continuous motion (あ, お, す, な, ぬ, ね, は, ほ, ま, む, よ, る). Never lift the pen inside a loop.",
            "Dots and dakuten / handakuten marks are written last, after the main body, top-left to bottom-right.",
            "Small kana (ゃ ゅ ょ っ) follow the same order as their full-size versions, just smaller and placed in the lower-right quadrant.",
          ]),
          table("Stroke counts", ["Strokes", "Characters"], [
            ["1", "く, し, そ, つ, て, の, ひ, へ, る, ろ, ん"],
            ["2", "い, う, え, こ, す, ち, と, ぬ, ね, み, め, ゆ, よ, ら, り, れ, わ"],
            ["3", "あ, お, か, け, さ, せ, に, は, ま, む, も, や, を"],
            ["4", "き, た, な, ふ, ほ"],
          ]),
          callout("Printed vs handwritten", "Printed and handwritten forms of さ, き, ふ, り differ slightly: in handwriting the last strokes of さ and き are usually disconnected. Both are correct.", "neutral"),
        ],
      },
      {
        heading: "Ten commonly confused pairs",
        blocks: [
          table("How to tell them apart", ["Pair", "How to tell them apart"], [
            ["さ / き", "き has TWO horizontal strokes on top; さ has ONE. Think: き (ki) = key with 2 teeth."],
            ["ぬ / め", "ぬ (nu) ends with a small loop at the bottom-right: \"nu has a noodle knot\". め (me) has no loop."],
            ["わ / ね / れ", "All start with a vertical stroke. わ (wa) ends in a wide open curve; ね (ne) ends with a loop (like a knot on a net); れ (re) ends by flicking outward to the right without a loop."],
            ["は / ほ", "ほ (ho) has an extra horizontal line on top of the right side; は (ha) has one horizontal only."],
            ["る / ろ", "る (ru) has a loop at the bottom; ろ (ro) does not: \"ru rolls up\"."],
            ["あ / お", "お (o) has a separate dot at the top right; あ (a) does not. あ is more angular with a bigger loop."],
            ["い / り", "い (i) has two short, separated, roughly equal strokes; り (ri) has a long right stroke sweeping down."],
            ["こ / に", "に (ni) has a vertical stroke on the left; こ (ko) is just the two horizontals."],
            ["ち / ら", "ち (chi) has a horizontal cross-bar and its curve opens to the left; ら (ra) starts with a short dot-like stroke and its curve opens to the right."],
            ["す / む", "Both have a loop on a vertical stroke. す (su) has a single horizontal and a simple loop; む (mu) has a loop plus a small extra stroke on the right."],
          ]),
          callout("Bonus confusions", "つ / っ (size), ゆ / よ, け / は, う / ら, そ / ぞ (dakuten easy to miss), ば / ぱ (dakuten vs handakuten: check whether it is two strokes or a circle).", "info"),
        ],
      },
      {
        heading: "Practice words",
        blocks: [
          text("Read aloud, cover the romaji, then cover the hiragana and write it from the meaning. Most of these words are normally written with kanji in real texts, but at this stage you read and write them in hiragana."),
          words("20 words using the basic 46", HIRAGANA_WORDS_1),
        ],
      },
    ],
    practiceQuestionIds: pick(hIds.basic, 20),
  },
  {
    id: "foundation-2",
    slug: "hiragana-dakuten-yoon",
    order: 2,
    kind: "hiragana",
    title: "Hiragana: dakuten, handakuten and combinations",
    summary: "The voiced marks ゛ and ゜ (が〜ぽ), the 36 contracted yōon sounds (きゃ, しゅ, ちょ…), the small っ, and how long vowels are spelled in hiragana.",
    minutes: 30,
    sections: [
      {
        heading: "Dakuten (゛) and handakuten (゜)",
        blocks: [
          text("Two small strokes (゛ dakuten) voice the consonant; a small circle (゜ handakuten) turns h into p. Total: 20 dakuten + 5 handakuten = 25 characters."),
          chart("Voiced and semi-voiced rows", H_DAKUTEN),
          callout("ぢ and づ", "ぢ and づ sound identical to じ and ず. They appear almost only in compound words (はなぢ nosebleed, つづく to continue) or after a doubled ち/つ (ちぢむ to shrink). じ is used in nearly all other cases (じかん time, じしょ dictionary).", "info"),
        ],
      },
      {
        heading: "Yōon (拗音): contracted sounds",
        blocks: [
          text("Take an i-row character (き, し, ち, に, ひ, み, り, ぎ, じ, ぢ, び, ぴ) and add a small や, ゆ, or よ (ゃ ゅ ょ). The small kana is written at roughly half size in the lower-right area of the square. Total: 36 combinations (21 unvoiced + 15 voiced / semi-voiced)."),
          chart("All 36 yōon", H_YOON),
          callout("Big vs small matters", "きよ (ki-yo, 2 beats) is not きょ (kyo, 1 beat). びよういん (beauty salon) is not びょういん (hospital).", "warn"),
        ],
      },
      {
        heading: "Small っ and other marks",
        blocks: [
          table("Marks used with hiragana", ["Mark", "Name", "Function", "Example"], [
            ["っ (small tsu)", "促音 sokuon", "Doubles the following consonant; occupies one full beat", "きって kitte (stamp), がっこう gakkō (school)"],
            ["ー", "長音符 chōonpu", "Long-vowel bar, used in katakana; in hiragana long vowels are written with an extra vowel instead", "おかあさん okāsan, おとうさん otōsan"],
            ["ゝ", "踊り字", "Repetition mark, obsolete; only in old texts or names", "—"],
          ]),
        ],
      },
      {
        heading: "Long vowels in hiragana",
        blocks: [
          table("Long vowel spelling", ["Long vowel", "Spelling", "Examples"], [
            ["ā", "add あ", "おかあさん, おばあさん"],
            ["ī", "add い", "おにいさん, おいしい"],
            ["ū", "add う", "くうき, ゆうびん"],
            ["ē", "usually add い; add え only in a few words", "せんせい, えいご, とけい; おねえさん, ええ"],
            ["ō", "usually add う; add お in a small set of words", "おとうさん, がっこう, きょう; おおきい, とおい, とお, こおり, おおい, とおる"],
          ]),
        ],
      },
      {
        heading: "Practice words",
        blocks: [
          words("20 words with voiced marks, yōon, small っ and long vowels", HIRAGANA_WORDS_2),
          callout("Spot the difference", "おばさん (aunt) / おばあさん (grandmother); きって (stamp, 3 beats) / きて (come, 2 beats); じゆう (freedom, 3 beats) / じゅう (ten, 2 beats); おじさん (uncle) / おじいさん (grandfather).", "accent"),
        ],
      },
    ],
    practiceQuestionIds: [...pick(hIds.dakuten, 9), ...pick(hIds.yoon, 11)],
  },
  {
    id: "foundation-3",
    slug: "katakana-basic",
    order: 3,
    kind: "katakana",
    title: "Katakana: the basic 46",
    summary: "The same 46 sounds in the angular script used for loanwords, foreign names and emphasis. Chart, stroke tips, the ten look-alike groups, and 20 words.",
    minutes: 25,
    sections: [
      {
        heading: "What katakana is for",
        blocks: [
          text(
            "Katakana represents exactly the same sounds as hiragana. It is used for loanwords (コーヒー), foreign names and places (アメリカ), onomatopoeia (ワンワン), scientific names, emphasis (like italics), and many company and product names.",
            "Learners often neglect katakana and then lose easy points on the N5–N2 vocabulary sections. Learn it to the same standard as hiragana."
          ),
        ],
      },
      {
        heading: "The 46 basic characters",
        blocks: [
          chart("Gojūon chart", K_BASIC),
          callout("ヲ", "ヲ appears almost only in old texts, in a few names, and in stylised writing; the particle を is always written in hiragana.", "neutral"),
        ],
      },
      {
        heading: "Stroke-order tips",
        blocks: [
          list("Katakana is angular", [
            "Top to bottom, left to right: the same universal rule as hiragana.",
            "Where hiragana loops, katakana uses corners. Do not add curves.",
            "Horizontal strokes before the vertical that crosses them (キ: two horizontals, then the diagonal; チ: short top stroke, horizontal, then the vertical hook).",
            "Short dots first, then long strokes, for characters made of dots plus a sweep (シ: dot, dot, then the long upward sweep from bottom-left; ツ: dot, dot, then the long downward sweep from top-right).",
            "Left-hand short strokes first (ソ: short left stroke, then the long sweep; ン: short left stroke, then the long upward sweep).",
            "Frames first, then the inside (ロ: left vertical, then the top and right in one stroke, then the bottom).",
            "Dakuten and handakuten last.",
            "ー is a single stroke written left to right.",
          ]),
          table("Stroke counts", ["Strokes", "Characters"], [
            ["1", "ノ, フ, ヘ, レ, ー"],
            ["2", "ア, イ, カ, ク, コ, ス, セ, ソ, ト, ナ, ニ, ヌ, ハ, ヒ, マ, ミ, ム, メ, ヤ, ユ, ラ, リ, ル, ワ, ン"],
            ["3", "ウ, エ, オ, キ, ケ, サ, シ, タ, チ, ツ, テ, モ, ヨ, ロ, ヲ"],
            ["4", "ネ, ホ"],
          ]),
        ],
      },
      {
        heading: "Ten commonly confused groups",
        blocks: [
          table("How to tell them apart", ["Group", "How to tell them apart"], [
            ["シ / ツ", "シ (shi): the two dots are stacked vertically on the left and the long stroke sweeps UP from bottom-left (like a smile). ツ (tsu): the two dots sit side by side on top and the long stroke sweeps DOWN from top-right. Same relation as hiragana し (curves up) vs つ (curves over)."],
            ["ン / ソ", "ン (n): one dot on the left, long stroke sweeps UP from bottom-left. ソ (so): one dot on top, long stroke sweeps DOWN. Same logic as シ/ツ."],
            ["ク / ケ / タ", "ク (ku): two strokes, open shape. ケ (ke): ク plus a horizontal bar across the middle. タ (ta): ク with a short stroke inside."],
            ["ワ / ウ / フ", "ワ (wa): a frame with a left vertical and a right hook. ウ (u): ワ with a dot on top. フ (fu): only the top-right hook, no left vertical."],
            ["ア / マ", "ア (a): horizontal, then a sweep down-left with a hook at the top-right. マ (ma): horizontal ending in a hook, then a short dot stroke at the bottom right."],
            ["ナ / メ", "ナ (na): a horizontal crossed by a long down-left diagonal (like a plus with a tail). メ (me): two crossing diagonals with no horizontal."],
            ["チ / テ", "チ (chi): short diagonal at top, horizontal, then a vertical with a hook to the left. テ (te): TWO horizontals, then the vertical hook."],
            ["コ / ユ / ヨ", "コ (ko): two strokes, open on the left. ユ (yu): horizontal + vertical hook and a long bottom line sticking out. ヨ (yo): three horizontals closed on the right."],
            ["ル / レ", "ル (ru): two strokes, the right one bending outward at the bottom. レ (re): one stroke, a simple check-mark shape."],
            ["ス / ヌ / ヲ", "ス (su): horizontal-hook then a short diagonal on the right. ヌ (nu): ス-like frame with the diagonal crossing through. ヲ (wo): two horizontals then a sweep."],
          ]),
          callout("Kanji look-alikes", "ニ (ni) vs the kanji 二 (two); カ (ka) vs 力 (power); エ (e) vs 工; ロ (ro) vs 口 (mouth); ト (to) vs 卜; ハ (ha) vs 八 (eight); タ (ta) vs 夕 (evening). In real text the surrounding script tells you which it is.", "info"),
        ],
      },
      {
        heading: "Practice words",
        blocks: [
          text("Most of these use only the basic 46. A few carry ゛ or ゜ marks (バ, ビ, パ, ピ, ペ, ジ): they work exactly as in hiragana and are covered fully in the next lesson."),
          words("20 common loanwords", KATAKANA_WORDS_3),
        ],
      },
    ],
    practiceQuestionIds: pick(kIds.basic, 20),
  },
  {
    id: "foundation-4",
    slug: "katakana-combinations",
    order: 4,
    kind: "katakana",
    title: "Katakana: combinations and loanword sounds",
    summary: "Voiced rows, the 36 yōon, the long-vowel bar ー, small ッ, and the extended combinations (ティ, ファ, ヴ…) invented for foreign sounds, plus 30 loanwords and the rules for guessing spellings.",
    minutes: 25,
    sections: [
      {
        heading: "Dakuten and handakuten",
        blocks: [chart("Voiced and semi-voiced rows (25 characters)", K_DAKUTEN)],
      },
      {
        heading: "Yōon: contracted sounds",
        blocks: [chart("All 36 yōon", K_YOON)],
      },
      {
        heading: "Long vowel mark ー (chōonpu)",
        blocks: [
          text("In katakana, a long vowel is written with a horizontal bar ー (vertical in vertical writing). It lengthens the previous vowel by one full beat."),
          table("Examples", ["Katakana", "Romaji", "Meaning", "Beats"], [
            ["コーヒー", "kōhī", "coffee", "4 (ko-o-hi-i)"],
            ["ケーキ", "kēki", "cake", "3"],
            ["スーパー", "sūpā", "supermarket", "4"],
            ["ノート", "nōto", "notebook", "3"],
            ["メール", "mēru", "email", "3"],
            ["ビール", "bīru", "beer", "3"],
            ["カー", "kā", "car", "2"],
          ]),
          callout("Do not confuse ー", "Do not confuse ー with the kanji 一 (one). In horizontal text ー is always a straight horizontal line following a kana.", "warn"),
        ],
      },
      {
        heading: "Small ッ (sokuon)",
        blocks: [
          text("Small ッ doubles the following consonant and takes one full beat of silence."),
          table("Examples", ["Katakana", "Romaji", "Meaning"], [
            ["ベッド", "beddo", "bed"], ["サッカー", "sakkā", "soccer"], ["カップ", "kappu", "cup"], ["バッグ", "baggu", "bag"],
            ["ポケット", "poketto", "pocket"], ["インターネット", "intānetto", "internet"], ["チケット", "chiketto", "ticket"], ["マッチ", "matchi", "match"],
          ]),
          callout("At the end of a word", "Small ッ can also appear at the end of a word in comics or onomatopoeia to show a sudden stop (アッ! \"Ah!\").", "neutral"),
        ],
      },
      {
        heading: "Extended katakana: foreign sounds",
        blocks: [
          text("These combinations were created to write sounds that do not exist in native Japanese. The second kana is written small."),
          table("Extended combinations", ["Combination", "Romaji", "Example", "Meaning"], [
            ["ヴァ", "va", "ヴァイオリン", "violin"], ["ヴィ", "vi", "ヴィザ (also ビザ)", "visa"], ["ヴ", "vu", "ヴ (used in names)", "—"], ["ヴェ", "ve", "ヴェネツィア", "Venice"], ["ヴォ", "vo", "ヴォリューム (also ボリューム)", "volume"],
            ["ファ", "fa", "ファミリー", "family"], ["フィ", "fi", "フィルム", "film"], ["フェ", "fe", "カフェ", "café"], ["フォ", "fo", "フォーク", "fork"], ["フュ", "fyu", "フュージョン", "fusion"],
            ["ティ", "ti", "パーティー", "party"], ["ディ", "di", "ディズニー", "Disney"], ["トゥ", "tu", "トゥース (rare)", "tooth"], ["ドゥ", "du", "ヒンドゥー", "Hindu"], ["テュ", "tyu", "テューバ (also チューバ)", "tuba"], ["デュ", "dyu", "デュエット", "duet"],
            ["ウィ", "wi", "ウィキペディア", "Wikipedia"], ["ウェ", "we", "ウェブ", "web"], ["ウォ", "wo", "ウォーター", "water"],
            ["シェ", "she", "シェフ", "chef"], ["ジェ", "je", "ジェット", "jet"], ["チェ", "che", "チェック", "check"],
            ["ツァ", "tsa", "モーツァルト", "Mozart"], ["ツィ", "tsi", "ツィター (rare)", "zither"], ["ツェ", "tse", "ツェッペリン", "Zeppelin"], ["ツォ", "tso", "カンツォーネ", "canzone"],
            ["イェ", "ye", "イェール", "Yale"], ["クァ / クヮ", "kwa", "クァルテット (also カルテット)", "quartet"], ["グァ", "gwa", "グァテマラ (also グアテマラ)", "Guatemala"],
          ]),
          list("Notes", [
            "Many words have two accepted spellings (ヴァイオリン / バイオリン). Both are read the same by native speakers; ヴ is usually pronounced as b.",
            "The letter l is always written with the R-row (ラ リ ル レ ロ): ロンドン London, ミルク milk.",
            "th becomes the サ/ス row: サンキュー thank you, スリー three.",
            "r at the end of an English syllable becomes ー: カー car (exception: ドア door has no bar).",
          ]),
        ],
      },
      {
        heading: "30 common loanwords",
        blocks: [
          words("Read aloud, then write from the English", KATAKANA_WORDS_4),
          list("Sound-change patterns that let you guess spellings", [
            "An English final consonant gets a vowel: bus → バス, milk → ミルク, cake → ケーキ.",
            "Final -er / -or / -ar → ー: computer → コンピューター, elevator → エレベーター.",
            "-ti- / -di- → ティ / ディ in modern words (パーティー) but チ / ジ in older loans (チケット, ラジオ).",
            "Shortened compounds are extremely common: パソコン (personal computer), エアコン (air conditioner), コンビニ (convenience store), スマホ (smartphone), アニメ (animation), デパート (department store).",
          ]),
        ],
      },
    ],
    practiceQuestionIds: [...pick(kIds.dakuten, 9), ...pick(kIds.yoon, 11)],
  },
  {
    id: "foundation-5",
    slug: "pronunciation",
    order: 5,
    kind: "pronunciation",
    title: "Pronunciation: mora, long vowels, double consonants and pitch",
    summary: "Why Japanese is counted in beats, how long vowels and small っ change meaning, and the four pitch-accent patterns of Tokyo Japanese with well-known minimal pairs.",
    minutes: 25,
    sections: [
      {
        heading: "Mora timing (拍 haku)",
        blocks: [
          text("Japanese is mora-timed, not syllable-timed. Every kana (except small ゃゅょ) is one beat of equal length. Clap once per kana."),
          table("Clap the beats", ["Word", "Kana", "Beats", "Clap pattern"], [
            ["Tokyo", "とうきょう", "4", "to-o-kyo-o"], ["Osaka", "おおさか", "4", "o-o-sa-ka"], ["Nippon", "にっぽん", "4", "ni-(pause)-po-n"], ["newspaper", "しんぶん", "4", "shi-n-bu-n"],
            ["teacher", "せんせい", "4", "se-n-se-e"], ["stamp", "きって", "3", "ki-(pause)-te"], ["hospital", "びょういん", "4", "byo-o-i-n"],
          ]),
          list("Rules", [
            "Each kana = 1 beat. きょ (contracted) = 1 beat. きよ = 2 beats.",
            "ん (syllabic n) is its own beat. ほん = 2 beats, not 1.",
            "Small っ is a full beat of silence.",
            "A long vowel (extra あいうえお or ー) adds one beat.",
            "Every mora gets roughly the same duration and the same stress. Do NOT stress one syllable as in English. Volume stays flat; only pitch changes.",
          ]),
          callout("Common learner error", "Pronouncing おばあさん (grandmother, 5 beats) as おばさん (aunt, 4 beats). Length is meaning.", "warn"),
        ],
      },
      {
        heading: "Pitch accent basics (高低アクセント)",
        blocks: [
          text("Japanese words have a pattern of HIGH (H) and LOW (L) pitch on each mora. The standard (Tokyo) dialect has four patterns."),
          table("The four patterns", ["Pattern", "Shape", "Description", "Example"], [
            ["平板 heiban (flat)", "L-H-H-H…", "Starts low, rises on the 2nd mora, stays high; the following particle is also high", "さかな (fish) L-H-H, さかなが = L-H-H-H"],
            ["頭高 atamadaka (head-high)", "H-L-L…", "First mora high, then drops", "はし (chopsticks) H-L; あめ (rain) H-L"],
            ["中高 nakadaka (mid-high)", "L-H-L…", "Rises then drops in the middle", "こころ (heart) L-H-L; おかし (sweets) L-H-L"],
            ["尾高 odaka (tail-high)", "L-H-H, particle L", "High through the end of the word, but the particle that follows drops", "はし (bridge) L-H, はしが = L-H-L"],
          ]),
          list("Well-known minimal pairs", [
            "あめ H-L = rain (雨) / あめ L-H = candy (飴)",
            "はし H-L = chopsticks (箸) / はし L-H (particle L) = bridge (橋) / はし L-H (particle H) = edge (端)",
            "かみ H-L = god (神) / かみ L-H = paper, hair (紙・髪)",
            "いま H-L = now (今) / いま L-H = living room (居間)",
          ]),
          list("Practical advice", [
            "The JLPT does not test pitch accent directly, but wrong pitch hurts listening comprehension because you will not recognise words spoken correctly.",
            "Learn the pitch of each new word by shadowing audio. Mark ↓ after the last high mora in your notes (あ↓め = rain).",
            "Rule of thumb: the first and second morae always differ in pitch. Once the pitch drops, it never rises again inside the same word.",
            "Most nouns of 3–4 morae and most loanwords are either flat or drop on the third-from-last mora (テ↓レビ, カ↓メラ, サ↓ラダ). Some very common loanwords are flat instead (アメリカ, コンビニ, パソコン), so always check the audio.",
          ]),
        ],
      },
      {
        heading: "Long vowels (長音)",
        blocks: [
          text("A long vowel is a vowel held for two beats."),
          table("Spelling", ["Long vowel", "Hiragana", "Katakana", "Examples"], [
            ["ā", "+ あ", "ー", "おかあさん (mother), おばあさん (grandmother), カー (car)"],
            ["ī", "+ い", "ー", "おにいさん (older brother), おいしい (delicious), ビール (beer)"],
            ["ū", "+ う", "ー", "くうき (air), ゆうびんきょく (post office), スーパー"],
            ["ē", "+ い (usual) / + え (few words)", "ー", "せんせい (teacher), えいご (English), とけい (clock); おねえさん (older sister), ええ (yes)"],
            ["ō", "+ う (usual) / + お (small fixed set)", "ー", "おとうさん (father), がっこう (school), きょう (today); おおきい (big), とおい (far), とお (ten), こおり (ice), おおい (many), とおる (pass through)"],
          ]),
          list("Meaning-changing pairs", [
            "おじさん (uncle) / おじいさん (grandfather)",
            "おばさん (aunt) / おばあさん (grandmother)",
            "ここ (here) / こうこう (high school)",
            "ゆき (snow) / ゆうき (courage)",
            "くろ (black) / くろう (hardship)",
            "ビル (building) / ビール (beer)",
            "とる (take) / とおる (pass through)",
            "しゅじん (husband) / しゅうじん (prisoner)",
          ]),
        ],
      },
      {
        heading: "Double consonants (促音: small っ / ッ)",
        blocks: [
          text("Small っ creates a one-beat pause before k, s, t, p (and sh, ch, ts). Hold your mouth in the position of the next consonant and wait one beat."),
          table("Examples", ["Word", "Reading", "Meaning", "Compare with"], [
            ["きって", "kit-te", "stamp", "きて (come)"], ["がっこう", "gak-kō", "school", "—"], ["ざっし", "zas-shi", "magazine", "—"], ["きっぷ", "kip-pu", "ticket", "—"],
            ["いっしょ", "is-sho", "together", "—"], ["まって", "mat-te", "wait (て-form)", "まて (imperative), また (again)"], ["おっと", "ot-to", "husband", "おと (sound)"], ["にっき", "nik-ki", "diary", "—"],
            ["ちょっと", "chot-to", "a little", "—"], ["いった", "it-ta", "went", "いた (was)"], ["かった", "kat-ta", "bought", "かた (shoulder; person)"], ["ロック", "rok-ku", "rock (music)", "ロク (six)"],
          ]),
          callout("Where っ never appears", "Small っ never appears before a vowel, n, m, r, y, or w in native words. Loanwords occasionally have ッ before other sounds: ベッド beddo, バッグ baggu.", "info"),
        ],
      },
    ],
    practiceQuestionIds: PRON_Q,
  },
  {
    id: "foundation-6",
    slug: "numbers-and-counters",
    order: 6,
    kind: "numbers",
    title: "Numbers and counters",
    summary: "Counting from 1 to 10,000 with every sound change (さんびゃく, ろっぴゃく, さんぜん…), and the twelve counters you need first, with all irregular readings marked.",
    minutes: 30,
    sections: [
      {
        heading: "Numbers 1–10",
        blocks: [
          table("Basic numbers", ["Number", "Kanji", "Reading (Sino-Japanese)", "Alternate", "Native reading (used with つ)"], [
            ["0", "〇 / 零", "ゼロ / れい", "—", "—"], ["1", "一", "いち", "—", "ひとつ"], ["2", "二", "に", "—", "ふたつ"], ["3", "三", "さん", "—", "みっつ"], ["4", "四", "よん", "し", "よっつ"],
            ["5", "五", "ご", "—", "いつつ"], ["6", "六", "ろく", "—", "むっつ"], ["7", "七", "なな", "しち", "ななつ"], ["8", "八", "はち", "—", "やっつ"], ["9", "九", "きゅう", "く", "ここのつ"], ["10", "十", "じゅう", "—", "とお"],
          ]),
          callout("4, 7 and 9", "Both readings exist; よん / なな / きゅう are the default in counting and with most counters. し / しち / く are used in fixed items: しがつ (April), しちがつ (July), くがつ (September), よじ (4 o'clock, uses よ), しちじ (7 o'clock), くじ (9 o'clock).", "accent"),
        ],
      },
      {
        heading: "Numbers 11–99",
        blocks: [
          text("Construct as: (tens digit) + じゅう + (units digit)."),
          table("Tens and teens", ["Number", "Reading", "Number", "Reading"], [
            ["11", "じゅういち", "20", "にじゅう"], ["12", "じゅうに", "21", "にじゅういち"], ["13", "じゅうさん", "30", "さんじゅう"], ["14", "じゅうよん", "40", "よんじゅう"], ["15", "じゅうご", "50", "ごじゅう"],
            ["16", "じゅうろく", "60", "ろくじゅう"], ["17", "じゅうなな", "70", "ななじゅう"], ["18", "じゅうはち", "80", "はちじゅう"], ["19", "じゅうきゅう", "90", "きゅうじゅう"], ["25", "にじゅうご", "99", "きゅうじゅうきゅう"],
          ]),
          callout("Watch", "40 is よんじゅう (never しじゅう in modern counting); 70 is ななじゅう; 90 is きゅうじゅう.", "warn"),
        ],
      },
      {
        heading: "Hundreds and thousands",
        blocks: [
          table("Hundreds", ["Number", "Kanji", "Reading", "Note"], [
            ["100", "百", "ひゃく", "no いち in front"], ["200", "二百", "にひゃく", ""], ["300", "三百", "さんびゃく", "sound change"], ["400", "四百", "よんひゃく", ""], ["500", "五百", "ごひゃく", ""],
            ["600", "六百", "ろっぴゃく", "sound change"], ["700", "七百", "ななひゃく", ""], ["800", "八百", "はっぴゃく", "sound change"], ["900", "九百", "きゅうひゃく", ""],
          ]),
          table("Thousands", ["Number", "Kanji", "Reading", "Note"], [
            ["1,000", "千", "せん", "no いち in front (いっせん only inside larger numbers such as 一万一千)"], ["2,000", "二千", "にせん", ""], ["3,000", "三千", "さんぜん", "sound change"], ["4,000", "四千", "よんせん", ""], ["5,000", "五千", "ごせん", ""],
            ["6,000", "六千", "ろくせん", ""], ["7,000", "七千", "ななせん", ""], ["8,000", "八千", "はっせん", "sound change"], ["9,000", "九千", "きゅうせん", ""], ["10,000", "一万", "いちまん", "いち IS required"],
          ]),
          list("Combine", [
            "350 = さんびゃくごじゅう, 618 = ろっぴゃくじゅうはち, 999 = きゅうひゃくきゅうじゅうきゅう.",
            "1,500 = せんごひゃく, 3,800 = さんぜんはっぴゃく, 6,543 = ろくせんごひゃくよんじゅうさん, 10,000 = いちまん.",
            "Beyond 10,000: 20,000 にまん, 100,000 じゅうまん, 1,000,000 ひゃくまん, 10,000,000 せんまん, 100,000,000 いちおく. Japanese groups by 10,000 (万), not by 1,000.",
          ]),
        ],
      },
      {
        heading: "Counters (助数詞)",
        blocks: [
          text("Japanese needs a counter word after a number. The number + counter comes after the noun and its particle: りんごを みっつ かいました (I bought three apples). Sound changes happen at 1, 3, 6, 8, 10 with counters starting with h/k/s/t/p. Irregular readings are listed exactly as you must say them."),
          counterTable("〜つ: general counter for things (native numbers, 1–10 only)", ["ひとつ", "ふたつ", "みっつ", "よっつ", "いつつ", "むっつ", "ななつ", "やっつ", "ここのつ", "とお", "いくつ"]),
          counterTable("〜人 (にん): people", ["ひとり", "ふたり", "さんにん", "よにん", "ごにん", "ろくにん", "しちにん / ななにん", "はちにん", "きゅうにん", "じゅうにん", "なんにん"]),
          counterTable("〜本 (ほん): long cylindrical things (pens, bottles, umbrellas, trees, films, phone calls)", ["いっぽん", "にほん", "さんぼん", "よんほん", "ごほん", "ろっぽん", "ななほん", "はっぽん", "きゅうほん", "じゅっぽん (じっぽん)", "なんぼん"]),
          counterTable("〜枚 (まい): flat things (paper, tickets, shirts, plates, CDs)", ["いちまい", "にまい", "さんまい", "よんまい", "ごまい", "ろくまい", "ななまい", "はちまい", "きゅうまい", "じゅうまい", "なんまい"]),
          counterTable("〜匹 (ひき): small animals (dogs, cats, fish, insects)", ["いっぴき", "にひき", "さんびき", "よんひき", "ごひき", "ろっぴき", "ななひき", "はっぴき", "きゅうひき", "じゅっぴき (じっぴき)", "なんびき"]),
          counterTable("〜個 (こ): small solid objects (apples, eggs, boxes, pieces)", ["いっこ", "にこ", "さんこ", "よんこ", "ごこ", "ろっこ", "ななこ", "はっこ", "きゅうこ", "じゅっこ (じっこ)", "なんこ"]),
          counterTable("〜冊 (さつ): bound volumes (books, notebooks, magazines)", ["いっさつ", "にさつ", "さんさつ", "よんさつ", "ごさつ", "ろくさつ", "ななさつ", "はっさつ", "きゅうさつ", "じゅっさつ (じっさつ)", "なんさつ"]),
          counterTable("〜台 (だい): machines and vehicles (cars, bicycles, computers, TVs, phones)", ["いちだい", "にだい", "さんだい", "よんだい", "ごだい", "ろくだい", "ななだい", "はちだい", "きゅうだい", "じゅうだい", "なんだい"]),
          counterTable("〜回 (かい): times, occurrences", ["いっかい", "にかい", "さんかい", "よんかい", "ごかい", "ろっかい", "ななかい", "はっかい", "きゅうかい", "じゅっかい (じっかい)", "なんかい"]),
          counterTable("〜階 (かい): floors of a building", ["いっかい", "にかい", "さんがい", "よんかい", "ごかい", "ろっかい", "ななかい", "はっかい (はちかい)", "きゅうかい", "じゅっかい (じっかい)", "なんがい (なんかい)"]),
          counterTable("〜歳 / 〜才 (さい): years of age", ["いっさい", "にさい", "さんさい", "よんさい", "ごさい", "ろくさい", "ななさい", "はっさい", "きゅうさい", "じゅっさい (じっさい)", "なんさい / おいくつ"]),
          counterTable("〜円 (えん): yen", ["いちえん", "にえん", "さんえん", "よえん", "ごえん", "ろくえん", "ななえん", "はちえん", "きゅうえん", "じゅうえん", "いくら"]),
          list("Notes", [
            "〜つ beyond 10: use plain numbers (じゅういち, じゅうに). いくつ also means \"how old\" for children; polite: おいくつですか.",
            "Large animals use 〜頭 とう; birds and rabbits use 〜羽 わ (N4 level).",
            "〜回: いっしゅうかんに さんかい (three times a week), もういっかい (once more).",
            "〜階: 3rd floor = さんがい, \"which floor\" = なんがい. Basement floors: ちか いっかい (B1).",
            "Age: 20 years old = はたち (二十歳). 18 = じゅうはっさい, 25 = にじゅうごさい, 30 = さんじゅっさい.",
            "Yen: 4 yen is よえん (not よんえん). 100円 ひゃくえん, 500円 ごひゃくえん, 1,000円 せんえん, 3,000円 さんぜんえん, 10,000円 いちまんえん. \"How much?\" = いくらですか.",
          ]),
        ],
      },
      {
        heading: "Summary of sound-change rules",
        blocks: [
          table("Where the number changes", ["Counter starts with", "1", "3", "6", "8", "10", "なん"], [
            ["h (ほん, ひき)", "いっp", "さんb", "ろっp", "はっp", "じゅっp", "なんb"],
            ["k (かい, こ)", "いっk", "(さんg for 階 only)", "ろっk", "はっk", "じゅっk", "(なんg for 階)"],
            ["s (さつ, さい)", "いっs", "—", "—", "はっs", "じゅっs", "—"],
            ["t / ch (〜丁, 〜着: N4)", "いっ", "—", "—", "はっ", "じゅっ", "—"],
            ["vowel / m / n / d / r / y", "no change", "—", "—", "—", "—", "—"],
          ]),
        ],
      },
    ],
    practiceQuestionIds: NUM_Q,
  },
  {
    id: "foundation-7",
    slug: "days-months-dates-time",
    order: 7,
    kind: "numbers",
    title: "Days, months, dates and time",
    summary: "Days of the week, the twelve months (with しがつ, しちがつ, くがつ), all 31 days of the month, clock time with よじ / しちじ / くじ and 〜ぷん, and the relative-time words you use every day.",
    minutes: 25,
    sections: [
      {
        heading: "Days of the week",
        blocks: [
          table("曜日", ["Day", "Kanji", "Reading"], [
            ["Monday", "月曜日", "げつようび"], ["Tuesday", "火曜日", "かようび"], ["Wednesday", "水曜日", "すいようび"], ["Thursday", "木曜日", "もくようび"],
            ["Friday", "金曜日", "きんようび"], ["Saturday", "土曜日", "どようび"], ["Sunday", "日曜日", "にちようび"], ["What day?", "何曜日", "なんようび"],
          ]),
        ],
      },
      {
        heading: "Months",
        blocks: [
          table("Month = number + がつ", ["Month", "Kanji", "Reading", "Month", "Kanji", "Reading"], [
            ["January", "一月", "いちがつ", "July", "七月", "しちがつ"], ["February", "二月", "にがつ", "August", "八月", "はちがつ"], ["March", "三月", "さんがつ", "September", "九月", "くがつ"],
            ["April", "四月", "しがつ", "October", "十月", "じゅうがつ"], ["May", "五月", "ごがつ", "November", "十一月", "じゅういちがつ"], ["June", "六月", "ろくがつ", "December", "十二月", "じゅうにがつ"],
          ]),
          callout("Irregular months", "April = しがつ, July = しちがつ, September = くがつ. What month? = 何月 なんがつ.", "warn"),
        ],
      },
      {
        heading: "Days of the month (all 31)",
        blocks: [
          table("Dates", ["Date", "Reading", "Date", "Reading", "Date", "Reading"], [
            ["1日", "ついたち", "11日", "じゅういちにち", "21日", "にじゅういちにち"], ["2日", "ふつか", "12日", "じゅうににち", "22日", "にじゅうににち"], ["3日", "みっか", "13日", "じゅうさんにち", "23日", "にじゅうさんにち"],
            ["4日", "よっか", "14日", "じゅうよっか", "24日", "にじゅうよっか"], ["5日", "いつか", "15日", "じゅうごにち", "25日", "にじゅうごにち"], ["6日", "むいか", "16日", "じゅうろくにち", "26日", "にじゅうろくにち"],
            ["7日", "なのか", "17日", "じゅうしちにち", "27日", "にじゅうしちにち"], ["8日", "ようか", "18日", "じゅうはちにち", "28日", "にじゅうはちにち"], ["9日", "ここのか", "19日", "じゅうくにち", "29日", "にじゅうくにち"],
            ["10日", "とおか", "20日", "はつか", "30日", "さんじゅうにち"], ["", "", "", "", "31日", "さんじゅういちにち"],
          ]),
          callout("Confusable pairs", "よっか (4th) / ようか (8th); ついたち (1st) / いちにち (one day); はつか (20th) / はたち (20 years old). What day of the month? = 何日 なんにち. Duration (\"for N days\") uses the same words: ふつか = 2 days, いつか = 5 days, except 1 day = いちにち.", "accent"),
          text("Years: year + 年 ねん. 2026年 = にせんにじゅうろくねん. What year? = 何年 なんねん. Duration: いちねん (1 year), にねん, さんねん, よねん (4 years), ごねん, ろくねん, ななねん (しちねん), はちねん, きゅうねん, じゅうねん."),
        ],
      },
      {
        heading: "Clock time",
        blocks: [
          table("Hours (〜時 じ)", ["1時", "2時", "3時", "4時", "5時", "6時", "7時", "8時", "9時", "10時", "11時", "12時", "?"], [
            ["いちじ", "にじ", "さんじ", "よじ", "ごじ", "ろくじ", "しちじ", "はちじ", "くじ", "じゅうじ", "じゅういちじ", "じゅうにじ", "なんじ"],
          ]),
          table("Minutes (〜分 ふん / ぷん)", ["1分", "2分", "3分", "4分", "5分", "6分", "7分", "8分", "9分", "10分", "?"], [
            ["いっぷん", "にふん", "さんぷん", "よんぷん", "ごふん", "ろっぷん", "ななふん", "はっぷん (はちふん)", "きゅうふん", "じゅっぷん (じっぷん)", "なんぷん"],
          ]),
          table("Common minute values", ["15分", "20分", "30分", "40分", "45分", "50分"], [
            ["じゅうごふん", "にじゅっぷん", "さんじゅっぷん / はん (half past)", "よんじゅっぷん", "よんじゅうごふん", "ごじゅっぷん"],
          ]),
          list("Examples and rules", [
            "7:30 = しちじはん, 4:15 = よじじゅうごふん, 9:45 = くじよんじゅうごふん, 12:10 = じゅうにじじゅっぷん.",
            "AM / PM: 午前 ごぜん (a.m.) and 午後 ごご (p.m.) go BEFORE the time: ごぜんくじ (9 a.m.), ごごさんじはん (3:30 p.m.).",
            "Duration: 〜時間 じかん (hours): いちじかん, にじかん, さんじかん, よじかん, ごじかん, ろくじかん, しちじかん (ななじかん), はちじかん, くじかん, じゅうじかん. Minutes duration uses 〜分 alone (さんじゅっぷん = 30 minutes) or 〜分間 ふんかん.",
          ]),
        ],
      },
      {
        heading: "Relative time expressions",
        blocks: [
          table("Past, present, future", ["Past", "Present", "Future"], [
            ["おととい (day before yesterday)", "きょう (today)", "あさって (day after tomorrow)"], ["きのう (yesterday)", "", "あした (tomorrow)"],
            ["せんしゅう (last week)", "こんしゅう (this week)", "らいしゅう (next week)"], ["せんせんしゅう (week before last)", "", "さらいしゅう (week after next)"],
            ["せんげつ (last month)", "こんげつ (this month)", "らいげつ (next month)"], ["きょねん (last year)", "ことし (this year)", "らいねん (next year)"],
            ["おととし (year before last)", "", "さらいねん (year after next)"], ["けさ (this morning)", "いま (now)", "こんばん (tonight)"], ["ゆうべ / きのうのよる (last night)", "", "あしたのあさ (tomorrow morning)"],
          ]),
          list("More time words", [
            "Parts of the day: あさ (morning), ひる (noon / daytime), ゆうがた (evening), ばん / よる (night), まいあさ (every morning), まいばん (every night).",
            "\"Every\": まいにち (every day), まいしゅう (every week), まいつき / まいげつ (every month), まいとし / まいねん (every year).",
            "Frequency: いつも (always), よく (often), ときどき (sometimes), たまに (occasionally), あまり〜ない (not often), ぜんぜん〜ない (never).",
            "Seasons: はる (spring), なつ (summer), あき (autumn), ふゆ (winter).",
          ]),
          callout("Word order for a date", "Year → month → day → day of week → time. 2026年9月15日（火）午前10時 = にせんにじゅうろくねん くがつ じゅうごにち かようび ごぜんじゅうじ.", "info"),
        ],
      },
    ],
    practiceQuestionIds: DATE_Q,
  },
  {
    id: "foundation-8",
    slug: "greetings-and-classroom-phrases",
    order: 8,
    kind: "greetings",
    title: "Greetings and classroom phrases",
    summary: "The 40 set phrases you will hear and use from day one: daily greetings, meeting people, home and meals, work, and everything you need to say in a Japanese class.",
    minutes: 20,
    sections: [
      { heading: "Daily greetings", blocks: [words("Morning to night", GREETINGS.slice(0, 9))] },
      { heading: "Meeting people", blocks: [words("First meetings and requests", GREETINGS.slice(9, 12)), callout("Self-introduction", "はじめまして。［name］です。どうぞよろしくおねがいします。 is the complete first-meeting formula.", "accent")] },
      { heading: "Home and meals", blocks: [words("Set phrases with fixed replies", GREETINGS.slice(12, 18)), callout("Pairs", "いってきます ↔ いってらっしゃい and ただいま ↔ おかえりなさい always come as pairs.", "info")] },
      { heading: "Wellbeing and work", blocks: [words("How are you, and leaving politely", GREETINGS.slice(18, 23))] },
      { heading: "Classroom phrases", blocks: [words("What you say and what the teacher says", GREETINGS.slice(23, 40))] },
    ],
    practiceQuestionIds: GREET_Q,
  },
];

/* ---------------- write ---------------- */
fs.mkdirSync(OUT_LESSONS, { recursive: true });
for (const l of lessons) {
  if (l.practiceQuestionIds.length !== 20) throw new Error(`${l.id} has ${l.practiceQuestionIds.length} practice questions`);
  fs.writeFileSync(path.join(OUT_LESSONS, `${l.id}.json`), JSON.stringify(l, null, 2) + "\n", "utf8");
}
fs.writeFileSync(OUT_QUESTIONS, JSON.stringify(questions, null, 2) + "\n", "utf8");
console.log(`Wrote ${lessons.length} lessons and ${questions.length} questions (hiragana ${Object.values(hIds).flat().length}, katakana ${Object.values(kIds).flat().length}, manual ${PRON_Q.length + NUM_Q.length + DATE_Q.length + GREET_Q.length}).`);
