import { notFound } from "next/navigation";
import { LEVELS } from "@/lib/content/schemas";
import { isLevel } from "@/components/content/levels";
import { VocabularyIndex, vocabPageCount, vocabPageMetadata } from "@/components/content/VocabularyIndex";

type Params = { level: string; n: string };

/** Only the pre-rendered pages exist; anything else (including /page/1, whose canonical home is the base URL) is a 404. */
export const dynamicParams = false;

/** Pages 2..N for every level; page 1 is /japanese/[level]/vocabulary. */
export function generateStaticParams() {
  return LEVELS.flatMap((level) => {
    const pages = vocabPageCount(level);
    return Array.from({ length: Math.max(0, pages - 1) }, (_, i) => ({ level, n: String(i + 2) }));
  });
}

function parsePage(n: string): number | null {
  return /^\d+$/.test(n) ? Number(n) : null;
}

export function generateMetadata({ params }: { params: Params }) {
  const page = parsePage(params.n);
  if (!isLevel(params.level) || page === null) return {};
  return vocabPageMetadata(params.level, page);
}

export default function VocabularyPagedIndexPage({ params }: { params: Params }) {
  const page = parsePage(params.n);
  if (!isLevel(params.level) || page === null) notFound();
  return <VocabularyIndex level={params.level} page={page} />;
}
