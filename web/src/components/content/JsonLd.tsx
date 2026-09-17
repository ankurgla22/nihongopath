/**
 * Serialises data for an inline <script type="application/ld+json"> block.
 * JSON.stringify alone is not safe inside <script>: a string containing "</script>"
 * would close the tag. Escaping <, >, & and the U+2028/9 line terminators as \uXXXX
 * keeps the output valid JSON while making it inert as HTML.
 */
const ESCAPES: [RegExp, string][] = [
  [/</g, "\\u003c"],
  [/>/g, "\\u003e"],
  [/&/g, "\\u0026"],
  [new RegExp("\\u2028", "g"), "\\u2028"],
  [new RegExp("\\u2029", "g"), "\\u2029"],
];

export function jsonLdString(data: unknown): string {
  let out = JSON.stringify(data);
  for (const [re, repl] of ESCAPES) out = out.replace(re, repl);
  return out;
}

/** Renders one or more JSON-LD objects as script tags. Server component. */
export function JsonLd({ data }: { data: object | object[] }) {
  const items = Array.isArray(data) ? data : [data];
  return (
    <>
      {items.map((d, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(d) }} />
      ))}
    </>
  );
}
