import Link from "next/link";
import type React from "react";
import { Arrow, Breadcrumbs, Button, Container, PageTitle, Section } from "@/components/ui";
import { JsonLd } from "@/components/content/JsonLd";
import { FaqSection } from "@/components/content/FaqSection";
import { VerbFilters } from "@/components/verbs/VerbFilters";
import { getVerbs, VERB_LEVELS, type Verb } from "@/lib/content/verbs";
import { classify, conjugate, looksIchidan, type FormKey } from "@/lib/content/conjugate";
import { toRomaji } from "@/lib/content/romaji";
import { LEVEL_LABEL } from "@/lib/content/schemas";
import { breadcrumbJsonLd, pageMetadata } from "@/lib/seo/metadata";
import { faqJsonLd, type Faq } from "@/lib/seo/faq";

const PATH = "/japanese/verbs";
const TABLE_ID = "verb-table";

export function generateMetadata() {
  const n = getVerbs().length;
  return pageMetadata({
    title: `Japanese verb conjugation list: ${n} N5 & N4 verbs with ます, て, ない and た forms`,
    description: `Every JLPT N5 and N4 verb with its reading, romaji, meaning and group, and its polite (ます), て, ない and た forms. Search and filter by level or group, with the rules and a full conjugation chart.`,
    path: PATH,
  });
}

/** The table's columns. `more` columns stay hidden until "More forms" is on. */
const COLUMNS: { key: FormKey; label: string; more?: boolean }[] = [
  { key: "polite", label: "Polite (ます)" },
  { key: "te", label: "て-form" },
  { key: "nai", label: "ない-form" },
  { key: "ta", label: "た-form" },
  { key: "politeNegative", label: "ません", more: true },
  { key: "politePast", label: "ました", more: true },
  { key: "politePastNegative", label: "ませんでした", more: true },
  { key: "nakatta", label: "なかった", more: true },
  { key: "ba", label: "ば-form", more: true },
];

const GRAMMAR = "/japanese/n5/grammar";
const FORM_GUIDE: { form: string; also: string; use: string; example: string; lesson: string }[] = [
  { form: "Dictionary form", also: "plain form", use: "Casual “do / will do”, and before patterns like 〜ことができる and 〜前に.", example: "食べる — eat", lesson: `${GRAMMAR}/23-dictionary-form` },
  { form: "Polite (ます) form", also: "ます-form", use: "Polite “do / will do”: the default with strangers, at work and in class.", example: "食べます — eat (polite)", lesson: `${GRAMMAR}/21-masu-masen` },
  { form: "て-form", also: "te-form", use: "Joins actions (“and then”), makes requests (〜てください) and the progressive (〜ています).", example: "食べて — eat and…", lesson: `${GRAMMAR}/24-te-form` },
  { form: "ない-form", also: "plain negative", use: "Casual “don't / won't do”, and 〜ないでください (please don't).", example: "食べない — don't eat", lesson: `${GRAMMAR}/25-nai-form` },
  { form: "た-form", also: "plain past", use: "Casual “did”, and 〜たことがある (have done).", example: "食べた — ate", lesson: `${GRAMMAR}/26-ta-form` },
];

/** One example per Group 1 ending, for the て-form table. */
const TE_EXAMPLES: [string, string][] = [
  ["買う", "かう"], ["待つ", "まつ"], ["取る", "とる"], ["飲む", "のむ"], ["遊ぶ", "あそぶ"], ["死ぬ", "しぬ"], ["書く", "かく"], ["泳ぐ", "およぐ"], ["話す", "はなす"], ["行く", "いく"],
];

const CHART: { key: FormKey; label: string; meaning: string }[] = [
  { key: "dictionary", label: "Dictionary", meaning: "do (plain)" },
  { key: "polite", label: "Polite", meaning: "do (polite)" },
  { key: "politeNegative", label: "Polite negative", meaning: "don't do" },
  { key: "politePast", label: "Polite past", meaning: "did" },
  { key: "politePastNegative", label: "Polite past negative", meaning: "didn't do" },
  { key: "mashou", label: "Let's (polite)", meaning: "let's do" },
  { key: "tai", label: "Want to", meaning: "want to do" },
  { key: "te", label: "て-form", meaning: "do and…, please do" },
  { key: "progressive", label: "Progressive", meaning: "is doing" },
  { key: "nai", label: "ない-form", meaning: "don't do (plain)" },
  { key: "ta", label: "た-form", meaning: "did (plain)" },
  { key: "nakatta", label: "Past negative", meaning: "didn't do (plain)" },
  { key: "potential", label: "Potential", meaning: "can do" },
  { key: "volitional", label: "Volitional", meaning: "let's do (plain), I'll do" },
  { key: "imperative", label: "Imperative", meaning: "do it! (blunt)" },
  { key: "ba", label: "Conditional ば", meaning: "if (you) do" },
  { key: "tara", label: "Conditional たら", meaning: "if / when (you) do" },
  { key: "passive", label: "Passive", meaning: "is done (to)" },
  { key: "causative", label: "Causative", meaning: "make / let do" },
];
const MODELS: [string, string, string][] = [
  ["書く", "かく", "Group 1"],
  ["食べる", "たべる", "Group 2"],
  ["する", "する", "Group 3"],
  ["来る", "くる", "Group 3"],
];

/** Doing it (を) vs it happening (が). */
const PAIRS: [string, string, string, string, string][] = [
  ["開ける", "開く", "ドアを開けます。", "ドアが開きます。", "I open the door. / The door opens."],
  ["閉める", "閉まる", "店を閉めます。", "店が閉まります。", "They close the shop. / The shop closes."],
  ["つける", "つく", "電気をつけます。", "電気がつきます。", "I turn on the light. / The light comes on."],
  ["消す", "消える", "火を消します。", "火が消えます。", "I put out the fire. / The fire goes out."],
  ["始める", "始まる", "授業を始めます。", "授業が始まります。", "I start the class. / The class starts."],
  ["止める", "止まる", "車を止めます。", "車が止まります。", "I stop the car. / The car stops."],
  ["入れる", "入る", "箱に本を入れます。", "箱に本が入っています。", "I put a book in the box. / There is a book in the box."],
  ["出す", "出る", "ごみを出します。", "熱が出ます。", "I put out the rubbish. / I get a fever."],
  ["壊す", "壊れる", "時計を壊しました。", "時計が壊れました。", "I broke the watch. / The watch broke."],
  ["並べる", "並ぶ", "椅子を並べます。", "人が並んでいます。", "I line up the chairs. / People are standing in line."],
];

const th = "px-3 py-2.5 font-medium text-xs uppercase tracking-wider whitespace-nowrap";
/**
 * Cell styles are set once here, not on each of the table's ~5,000 cells: Next sends every
 * attribute twice (in the HTML and again in the RSC payload), and per-cell classes made the page
 * 2.5 MB. Cells use short markers instead: .m = a "More forms" column, .w = wrapping text,
 * .r = secondary text, <small> = a reading or note under the cell's main text.
 */
const VERB_TABLE = [
  "w-full text-sm",
  "[&_th]:px-3 [&_th]:whitespace-nowrap [&_thead_th]:py-2.5 [&_thead_th]:font-medium [&_thead_th]:text-xs [&_thead_th]:uppercase [&_thead_th]:tracking-wider",
  "[&_td]:px-3 [&_td]:py-2 [&_td]:align-top [&_td]:whitespace-nowrap",
  "[&_tbody_th]:py-2 [&_tbody_th]:align-top [&_tbody_th]:text-left [&_tbody_th]:font-normal [&_tbody_th]:sticky [&_tbody_th]:left-0 [&_tbody_th]:z-10 [&_tbody_th]:bg-surface",
  "[&_thead_th:first-child]:sticky [&_thead_th:first-child]:left-0 [&_thead_th:first-child]:z-10 [&_thead_th:first-child]:bg-surface-2",
  // No zebra stripes: the sticky first column needs an opaque background, and a translucent
  // stripe behind the rest of the row made it a different shade.
  "[&_tbody_tr]:border-t [&_tbody_tr]:border-line",
  // One selector, not data-[more=true]:[&_.m]: stacked, Tailwind put the attribute on the cell.
  "[&_.m]:hidden [&[data-more=true]_.m]:table-cell",
  "[&_.w]:whitespace-normal [&_.w]:min-w-[12rem] [&_.w]:max-w-[18rem] [&_.r]:text-ink-2",
  "[&_small]:block [&_small]:text-xs [&_small]:text-muted [&_b]:text-base [&_b]:font-medium [&_a:hover]:text-accent",
].join(" ");

function SimpleTable({ head, rows, minWidth = "" }: { head: string[]; rows: React.ReactNode[][]; minWidth?: string }) {
  return (
    <div className="surface rounded-2xl overflow-x-auto">
      <table className={`w-full text-sm ${minWidth}`}>
        <thead className="text-left text-muted bg-surface-2">
          <tr>
            {head.map((h) => (
              <th key={h} scope="col" className={th}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&>tr:nth-child(even)]:bg-surface-2/50">
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-line">
              {r.map((c, j) => (
                <td key={j} className="px-3 py-2.5 align-top">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const Ja = ({ children }: { children: React.ReactNode }) => (
  <span lang="ja" className="ja">
    {children}
  </span>
);

export default function VerbsPage() {
  const verbs = [...getVerbs()].sort((a, b) => VERB_LEVELS.indexOf(a.level as (typeof VERB_LEVELS)[number]) - VERB_LEVELS.indexOf(b.level as (typeof VERB_LEVELS)[number]) || a.reading.localeCompare(b.reading, "ja"));
  const byWord = new Map(verbs.map((v) => [v.word, v]));
  const href = (v: Verb) => `/japanese/${v.level}/vocabulary/${v.slug}`;
  const count = (l: string) => verbs.filter((v) => v.level === l).length;
  const traps = verbs.filter((v) => v.cls === "godan" && looksIchidan(v.reading));

  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Learn Japanese", path: "/japanese" },
    { name: "Verbs", path: PATH },
  ];

  const faq: Faq[] = [
    {
      q: "How many verb groups are there in Japanese?",
      a: "Three. Group 1 (う-verbs or godan) is the largest: 書く, 飲む, 話す. Group 2 (る-verbs or ichidan) ends in -iru or -eru: 食べる, 見る. Group 3 is just two irregular verbs, する and 来る, plus every noun + する verb such as 勉強する.",
    },
    {
      q: "What is the difference between the dictionary form and the ます form?",
      a: "They mean the same thing at different levels of politeness. The dictionary form (食べる) is plain: used with friends and family and before many grammar patterns. The ます form (食べます) is polite: the default with people you don't know well, at work and in class.",
    },
    {
      q: "How do I know whether a verb ending in る is Group 1 or Group 2?",
      a: `Look at the sound before る. If it is a, u or o (作る, 終わる), the verb is Group 1. If it is i or e (見る, 食べる), it is usually Group 2, but a few common verbs are Group 1 anyway: ${traps
        .slice(0, 6)
        .map((v) => v.word)
        .join(", ")}. They have to be memorised.`,
    },
    {
      q: "Why is the て-form of 行く 行って and not 行いて?",
      a: "行く is the one exception to the く → いて rule. Every other verb ending in く follows it (書く → 書いて, 聞く → 聞いて), but 行く takes って like a verb ending in う, つ or る. Its た-form is 行った for the same reason.",
    },
  ];

  return (
    <Container wide>
      <JsonLd data={[breadcrumbJsonLd(crumbs), faqJsonLd(PATH, faq)]} />
      <Breadcrumbs items={crumbs.map((c, i) => (i === crumbs.length - 1 ? { name: c.name } : c))} />
      <PageTitle
        title={
          <>
            Japanese verbs <span className="text-muted font-normal tabular-nums">· {verbs.length}</span>
          </>
        }
        actions={
          <Button href="/quiz/verbs">
            Quiz yourself <Arrow />
          </Button>
        }
        description={
          <>
            Every verb in the {VERB_LEVELS.map((l) => LEVEL_LABEL[l]).join(" and ")} vocabulary ({VERB_LEVELS.map((l) => `${count(l)} ${LEVEL_LABEL[l]}`).join(", ")}) with its reading, meaning and group, and the forms you use most. Each form is built
            by the rules further down this page: learn the rules, then cover a column and produce it yourself.
          </>
        }
      />

      <VerbFilters tableId={TABLE_ID} total={verbs.length} />

      <div className="surface rounded-2xl overflow-x-auto mb-3">
        <table id={TABLE_ID} className={VERB_TABLE}>
          <thead className="text-left text-muted bg-surface-2">
            <tr>
              <th scope="col">Verb</th>
              <th scope="col">Romaji</th>
              <th scope="col">Meaning</th>
              <th scope="col" title="1 = う-verb, 2 = る-verb, 3 = する / 来る. 1* looks like Group 2 but is not.">
                Group
              </th>
              <th scope="col">Level</th>
              {COLUMNS.map((c) => (
                <th key={c.key} scope="col" className={c.more ? "m" : undefined}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {verbs.map((v) => (
              <tr key={v.id} data-level={v.level} data-group={v.group}>
                <th scope="row" lang="ja" className="ja">
                  <Link href={href(v)}>
                    <b>{v.word}</b>
                    {v.reading !== v.word && <small>{v.reading}</small>}
                  </Link>
                </th>
                <td className="r">{v.romaji}</td>
                <td className="w">
                  {v.meaning}
                  {v.fromNoun && <small>noun + する</small>}
                </td>
                <td>
                  {v.group}
                  {v.cls === "godan" && looksIchidan(v.reading) ? "*" : ""}
                </td>
                <td>{LEVEL_LABEL[v.level]}</td>
                {COLUMNS.map((c) => (
                  <td key={c.key} lang="ja" className={c.more ? "ja m" : "ja"}>
                    {v.forms[c.key]}
                    {v.readings && <small>{v.readings[c.key]}</small>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mb-14 text-xs text-muted">Group 1* = ends in -iru or -eru like a Group 2 verb, but is Group 1. Click a verb for its example sentences.</p>

      <div className="max-w-4xl">
        <Section id="forms" title="What each form is for">
          <SimpleTable
            head={["Form", "Also called", "Used for", "Example", "Lesson"]}
            minWidth="min-w-[40rem]"
            rows={FORM_GUIDE.map((f) => [
              <span key="f" className="font-medium whitespace-nowrap">
                {f.form}
              </span>,
              f.also,
              f.use,
              <Ja key="e">{f.example}</Ja>,
              <Link key="l" href={f.lesson} className="text-accent hover:underline whitespace-nowrap">
                N5 lesson
              </Link>,
            ])}
          />
          <p className="mt-4 text-sm leading-relaxed text-ink-2 max-w-prose">
            The polite form is the whole word (<Ja>食べます</Ja>). The <strong>ます-stem</strong> is what is left without ます (<Ja>食べ</Ja>, <Ja>飲み</Ja>): 〜たい (want to), 〜ながら (while) and 〜に行く (go to do) attach to it.
          </p>
        </Section>

        <Section id="groups" title="The three verb groups">
          <SimpleTable
            head={["Group", "How to recognise it", "What changes"]}
            minWidth="min-w-[36rem]"
            rows={[
              ["3 · irregular", <>Only する and 来る, and every noun + する verb (<Ja>勉強する</Ja>).</>, <>Memorise them. <Ja>来る</Ja> changes its reading: <Ja>来ます (きます)</Ja>, <Ja>来ない (こない)</Ja>.</>],
              ["2 · る-verbs", <>Ends in -iru or -eru (<Ja>食べる</Ja> tab<strong>e</strong>ru, <Ja>見る</Ja> m<strong>i</strong>ru).</>, <>Drop る and add the ending: <Ja>食べます, 食べて, 食べない, 食べた</Ja>.</>],
              ["1 · う-verbs", <>Everything else: any u-sound ending, or る after a, u or o (<Ja>作る</Ja>, <Ja>終わる</Ja>).</>, <>The last kana moves along its row: u → i for ます (<Ja>書きます</Ja>), u → a for ない (<Ja>書かない</Ja>). う becomes わ: <Ja>買わない</Ja>.</>],
            ]}
          />
        </Section>

        <Section id="te-form" title="Group 1: て-form and た-form endings" intro="The ending decides the て-form; the た-form is the same with て → た and で → だ.">
          <SimpleTable
            head={["Ends in", "て-form", "た-form", "Example"]}
            rows={TE_EXAMPLES.map(([w, r]) => {
              const f = conjugate(w, classify(w, r));
              const ending = w === "行く" ? "行く (exception)" : w.slice(-1);
              return [<Ja key="e">{ending}</Ja>, <Ja key="t">{f.te.slice(-2)}</Ja>, <Ja key="a">{f.ta.slice(-2)}</Ja>, <Ja key="x">{`${w} → ${f.te} / ${f.ta}`}</Ja>];
            })}
          />
        </Section>

        <Section id="exceptions" title="Group 1 verbs that look like Group 2" intro={`These end in -iru or -eru, so the rule says Group 2, but they are Group 1: 帰ります, not 帰ます. The ${traps.length} in this list are all marked 1* in the table.`}>
          <SimpleTable
            head={["Verb", "Meaning", "Polite", "て-form", "ない-form"]}
            rows={traps.map((v) => [
              <Link key="v" href={href(v)} className="hover:text-accent">
                <Ja>{v.word}</Ja> <span className="text-xs text-muted">{v.romaji}</span>
              </Link>,
              v.meaning,
              <Ja key="p">{v.forms.polite}</Ja>,
              <Ja key="t">{v.forms.te}</Ja>,
              <Ja key="n">{v.forms.nai}</Ja>,
            ])}
          />
          <p className="mt-4 text-sm text-ink-2 max-w-prose">
            Watch the pairs that sound the same: <Ja>着る</Ja> (kiru, wear) is Group 2 → <Ja>着ます</Ja>; <Ja>切る</Ja> (kiru, cut) is Group 1 → <Ja>切ります</Ja>.
          </p>
        </Section>

        <Section id="chart" title="Every form of four model verbs" intro="All the forms you meet up to N4, for one verb of each kind. Any verb in the table above follows its group's column.">
          <SimpleTable
            head={["Form", "Meaning", ...MODELS.map(([w, , g]) => `${w} (${g})`)]}
            minWidth="min-w-[44rem]"
            rows={CHART.map((c) => [
              <span key="l" className="font-medium whitespace-nowrap">
                {c.label}
              </span>,
              <span key="m" className="text-ink-2">
                {c.meaning}
              </span>,
              ...MODELS.map(([w, r]) => {
                const cls = classify(w, r);
                return (
                  <span key={w} className="whitespace-nowrap">
                    <Ja>{conjugate(w, cls)[c.key]}</Ja>
                    <span className="block text-xs text-muted">{toRomaji(conjugate(r, cls, w)[c.key])}</span>
                  </span>
                );
              }),
            ])}
          />
          <p className="mt-4 text-sm text-ink-2 max-w-prose">
            Group 1 uses one vowel of the last kana&apos;s row for each form: <strong>a</strong> for ない, passive and causative (<Ja>書か</Ja>), <strong>i</strong> for ます and たい (<Ja>書き</Ja>), <strong>e</strong> for potential, ば and the imperative (<Ja>書け</Ja>), <strong>o</strong> for the volitional (<Ja>書こう</Ja>).
          </p>
        </Section>

        <Section id="pairs" title="Doing it vs it happening" intro="Many actions come in pairs. The first verb takes を: someone does it. The second takes が: it happens by itself.">
          <SimpleTable
            head={["Someone does it (を)", "It happens (が)", "Example"]}
            minWidth="min-w-[36rem]"
            rows={PAIRS.map(([a, b, ja1, ja2, en]) => [
              ...[a, b].map((w) => {
                const v = byWord.get(w);
                return v ? (
                  <Link key={w} href={href(v)} className="hover:text-accent">
                    <Ja>{w}</Ja>
                  </Link>
                ) : (
                  <Ja key={w}>{w}</Ja>
                );
              }),
              <span key="x">
                <Ja>
                  {ja1} / {ja2}
                </Ja>
                <span className="block text-xs text-muted">{en}</span>
              </span>,
            ])}
          />
        </Section>

        <FaqSection items={faq} />
      </div>
      <div className="h-16" />
    </Container>
  );
}
