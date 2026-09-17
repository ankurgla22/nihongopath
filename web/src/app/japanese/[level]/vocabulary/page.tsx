import { notFound } from "next/navigation";
import { LEVELS } from "@/lib/content/schemas";
import { isLevel } from "@/components/content/levels";
import { VocabularyIndex, vocabPageMetadata } from "@/components/content/VocabularyIndex";

type Params = { level: string };

export function generateStaticParams() {
  return LEVELS.map((level) => ({ level }));
}

export function generateMetadata({ params }: { params: Params }) {
  if (!isLevel(params.level)) return {};
  return vocabPageMetadata(params.level, 1);
}

/** Page 1 of the vocabulary index; pages 2+ live at /japanese/[level]/vocabulary/page/[n]. */
export default function VocabularyIndexPage({ params }: { params: Params }) {
  if (!isLevel(params.level)) notFound();
  return <VocabularyIndex level={params.level} page={1} />;
}
