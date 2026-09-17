import { pageMetadata } from "@/lib/seo/metadata";
import { requireUser } from "@/lib/auth/requireUser";
import { Container, PageTitle } from "@/components/ui";
import { ProfileClient } from "@/components/auth/ProfileClient";

export const metadata = pageMetadata({
  title: "Profile",
  description: "Your account, study settings and streak.",
  path: "/profile",
  noIndex: true,
});

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requireUser("/profile");
  return (
    <Container wide>
      <PageTitle eyebrow="Account" title="Profile" description="Your details, study settings and streak." />
      <ProfileClient sessionUser={user} />
    </Container>
  );
}
