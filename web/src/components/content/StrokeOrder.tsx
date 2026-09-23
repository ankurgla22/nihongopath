import fs from "node:fs";
import path from "node:path";

/**
 * Stroke-order diagram for one kanji, from KanjiVG (public/kanjivg/<codepoint>.svg, fetched by
 * scripts/fetch-kanjivg.mjs). Inlined so the strokes and numbers take the page's text colour in
 * both themes; an <img> would stay black on the dark background.
 *
 * KanjiVG is © Ulrich Apel, CC BY-SA 3.0 (https://kanjivg.tagaini.net); the caller shows the credit.
 */
export function strokeOrderSvg(character: string): { svg: string; strokes: number } | null {
  const file = `${character.codePointAt(0)!.toString(16).padStart(5, "0")}.svg`;
  try {
    let svg = fs.readFileSync(path.join(process.cwd(), "public", "kanjivg", file), "utf8");
    const strokes = (svg.match(/<path /g) ?? []).length;
    // Drop KanjiVG's fixed colours so CSS can set them; keep everything else (ids, stroke numbers).
    svg = svg
      .replace(/stroke:#000000;?/g, "")
      .replace(/fill:#808080;?/g, "")
      .replace(/<svg /, '<svg class="kanjivg" role="img" aria-hidden="true" focusable="false" ');
    return { svg, strokes };
  } catch {
    return null;
  }
}

export function StrokeOrder({ character }: { character: string }) {
  const data = strokeOrderSvg(character);
  if (!data) return null;
  return (
    <figure className="surface rounded-2xl p-5 sm:p-6">
      <div
        className="mx-auto w-40 h-40 sm:w-48 sm:h-48 text-ink [&_svg]:w-full [&_svg]:h-full [&_path]:stroke-current [&_path]:fill-none [&_text]:fill-muted"
        dangerouslySetInnerHTML={{ __html: data.svg }}
      />
      <figcaption className="mt-3 text-center text-sm text-muted">
        {data.strokes} {data.strokes === 1 ? "stroke" : "strokes"}, numbered in writing order. Data:{" "}
        <a href="https://kanjivg.tagaini.net" rel="noopener license" target="_blank" className="hover:text-accent">
          KanjiVG
        </a>{" "}
        (CC BY-SA 3.0).
      </figcaption>
    </figure>
  );
}
