import { pageMetadata } from "@/lib/seo/metadata";
import { requireUser } from "@/lib/auth/requireUser";
import { Container, PageTitle } from "@/components/ui";
import { SavedClient } from "@/components/progress/SavedClient";

export const metadata = pageMetadata({
  title: "My saved items",
  description: "Grammar, vocabulary, kanji, reading passages and questions you bookmarked.",
  path: "/saved",
  noIndex: true,
});

export const dynamic = "force-dynamic";

export default async function SavedPage() {
  await requireUser("/saved");
  return (
    <Container>
      <PageTitle eyebrow="My learning" title="My saved items" description="Lessons and questions you bookmarked, grouped by type. Saved items sync to your account on every device." />
      <SavedClient />
    </Container>
  );
}
