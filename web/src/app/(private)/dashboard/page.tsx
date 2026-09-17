import { pageMetadata } from "@/lib/seo/metadata";
import { requireUser } from "@/lib/auth/requireUser";
import { getCurriculum } from "@/lib/content";
import { Container } from "@/components/ui";
import { DashboardClient, type DaySummary } from "@/components/dashboard/DashboardClient";

export const metadata = pageMetadata({
  title: "Dashboard",
  description: "Your 180-day progress, streak, study time and today's plan.",
  path: "/dashboard",
  noIndex: true,
});

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser("/dashboard");
  const curriculum = getCurriculum();
  const days: DaySummary[] = curriculum.days.map((d) => ({
    day: d.day,
    phase: d.phase,
    title: d.title,
    taskTypes: d.tasks.map((t) => t.type),
    plannedMinutes: d.tasks.reduce((n, t) => n + t.minutes, 0),
  }));
  const phases = curriculum.phases.map((p) => ({ id: p.id, name: p.name, startDay: p.startDay, endDay: p.endDay }));

  return (
    <Container wide>
      <DashboardClient sessionName={user.name} days={days} phases={phases} />
    </Container>
  );
}
