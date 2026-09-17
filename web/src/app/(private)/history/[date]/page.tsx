import { notFound } from "next/navigation";
import { pageMetadata } from "@/lib/seo/metadata";
import { requireUser } from "@/lib/auth/requireUser";
import { Breadcrumbs, Container, PageTitle } from "@/components/ui";
import { HistoryDayClient } from "@/components/progress/HistoryDayClient";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function longDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

export function generateMetadata({ params }: { params: { date: string } }) {
  return pageMetadata({
    title: DATE_RE.test(params.date) ? `Study history · ${longDate(params.date)}` : "Study history",
    description: "What you studied on this day.",
    path: `/history/${params.date}`,
    noIndex: true,
  });
}

export default async function HistoryDayPage({ params }: { params: { date: string } }) {
  const { date } = params;
  if (!DATE_RE.test(date)) notFound();
  await requireUser(`/history/${date}`);
  return (
    <Container>
      <Breadcrumbs items={[{ name: "Study history", path: "/history" }, { name: longDate(date) }]} />
      <PageTitle eyebrow="Study history" title={<time dateTime={date}>{longDate(date)}</time>} description="Sessions, lessons and quiz results from this day." />
      <HistoryDayClient date={date} />
    </Container>
  );
}
