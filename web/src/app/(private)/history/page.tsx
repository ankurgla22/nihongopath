import { pageMetadata } from "@/lib/seo/metadata";
import { requireUser } from "@/lib/auth/requireUser";
import { Container, PageTitle } from "@/components/ui";
import { HistoryClient } from "@/components/progress/HistoryClient";

export const metadata = pageMetadata({
  title: "Study history",
  description: "Every day you studied: time, topics and quiz scores.",
  path: "/history",
  noIndex: true,
});

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  await requireUser("/history");
  return (
    <Container>
      <PageTitle eyebrow="My learning" title="Study history" description="Each day you studied, with study time, topics and your quiz score. Open a day to see exactly what you covered." />
      <HistoryClient />
    </Container>
  );
}
