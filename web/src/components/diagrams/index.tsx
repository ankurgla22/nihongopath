import type { Diagram as DiagramData } from "@/lib/content/schemas";
import { ConjugationTree } from "./ConjugationTree";
import { ComparisonTable } from "./ComparisonTable";
import { SentenceStructure } from "./SentenceStructure";
import { Transformation } from "./Transformation";
import { Scale } from "./Scale";

export { ConjugationTree, ComparisonTable, SentenceStructure, Transformation, Scale };

/** Dispatches a typed diagram from content JSON to its component. */
export function Diagram({ data }: { data: DiagramData }) {
  switch (data.kind) {
    case "conjugation-tree":
      return <ConjugationTree root={data.root} rootLabel={data.rootLabel} branches={data.branches} />;
    case "comparison":
      return <ComparisonTable title={data.title} columns={data.columns} rows={data.rows} />;
    case "sentence-structure":
      return <SentenceStructure parts={data.parts} translation={data.translation} />;
    case "transformation":
      return <Transformation steps={data.steps} />;
    case "scale":
      return <Scale title={data.title} items={data.items} />;
    default:
      return null;
  }
}
