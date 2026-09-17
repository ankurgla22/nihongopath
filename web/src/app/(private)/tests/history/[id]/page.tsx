import { pageMetadata } from "@/lib/seo/metadata";
import { requireUser } from "@/lib/auth/requireUser";
import { Breadcrumbs, Container } from "@/components/ui";
import { TestResultClient } from "@/components/progress/TestResultClient";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: { id: string } }) {
  return pageMetadata({
    title: "Test review",
    description: "Score, answers, explanations and what to review.",
    path: `/tests/history/${params.id}`,
    noIndex: true,
  });
}

export default async function TestResultPage({ params }: { params: { id: string } }) {
  const id = decodeURIComponent(params.id);
  await requireUser(`/tests/history/${params.id}`);
  return (
    <Container>
      <Breadcrumbs items={[{ name: "Test history", path: "/tests/history" }, { name: "Review" }]} />
      <TestResultClient id={id} />
    </Container>
  );
}
