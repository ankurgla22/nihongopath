import Link from "next/link";
import { Breadcrumbs, Container, PageTitle, Section } from "@/components/ui";
import { JsonLd } from "@/components/content/JsonLd";
import { UpdatedOn } from "@/components/content/UpdatedOn";
import { breadcrumbJsonLd, pageMetadata } from "@/lib/seo/metadata";
import { LAST_MODIFIED, SITE_NAME, SITE_OPERATOR, SITE_URL } from "@/lib/seo/site";

export const metadata = pageMetadata({
  title: "Terms of use",
  description: "The terms for using Nihongo Path: a free service, your account, what you may do with the content, what the site does not promise, and how to reach the operator.",
  path: "/terms",
});

export default function TermsPage() {
  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Terms", path: "/terms" },
  ];
  const sections: { id: string; title: string; body: string[] }[] = [
    {
      id: "service",
      title: "The service",
      body: [
        `${SITE_NAME} is a free Japanese-learning site operated by ${SITE_OPERATOR.name}. Lessons and guides can be read without an account. An account adds a personal study tracker. Using the site means accepting these terms.`,
      ],
    },
    {
      id: "account",
      title: "Your account",
      body: [
        "You are responsible for the email address and password on your account and for what is done with it. Give accurate details, keep your password to yourself, and tell us if you think someone else is using your account. One person, one account.",
      ],
    },
    {
      id: "use",
      title: "Acceptable use",
      body: [
        "Use the site to learn Japanese. Do not try to break it, overload it, scrape it at a rate that affects other users, or bypass access controls. Automated access for search and AI indexing is welcome and governed by robots.txt.",
      ],
    },
    {
      id: "content",
      title: "Content",
      body: [
        `The lessons, exercises, questions, audio scripts and site design belong to ${SITE_OPERATOR.name}. You may read them, quote short passages with a link to the source lesson, and use them for your own study. You may not republish the content as a whole or sell it.`,
        "Example sentences are original. The JLPT name and test format belong to the Japan Foundation and Japan Educational Exchanges and Services; this site is not affiliated with them, and mock exams here are practice material, not official tests.",
      ],
    },
    {
      id: "no-promise",
      title: "What the site does not promise",
      body: [
        "The site is provided as it is. We work to keep lessons accurate and the exam facts current, and we cite the official sources for them, but we do not guarantee that any content is error-free or that studying here will produce a particular result on the JLPT. Confirm test dates, fees and formats with the official JLPT site before registering.",
        "The site may be changed, paused or withdrawn, and accounts that break these terms may be closed. If the study tracker is ever discontinued, we will say so on the site in advance.",
      ],
    },
    {
      id: "privacy",
      title: "Privacy",
      body: ["How account data is handled is described on the privacy page, which forms part of these terms."],
    },
    {
      id: "contact",
      title: "Contact and changes",
      body: [
        `Questions about these terms go to ${SITE_OPERATOR.name} through its contact page. These terms are updated when the service changes; the date below is the date of the current version.`,
      ],
    },
  ];

  return (
    <Container>
      <JsonLd
        data={[
          breadcrumbJsonLd(crumbs),
          {
            "@context": "https://schema.org",
            "@type": "WebPage",
            "@id": `${SITE_URL}/terms`,
            url: `${SITE_URL}/terms`,
            name: `${SITE_NAME} terms of use`,
            inLanguage: "en",
            dateModified: LAST_MODIFIED,
            isPartOf: { "@id": `${SITE_URL}/#website` },
            publisher: { "@id": `${SITE_URL}/#organization` },
          },
        ]}
      />
      <Breadcrumbs items={[{ name: "Home", path: "/" }, { name: "Terms" }]} />
      <PageTitle title="Terms of use" description="Short, because the service is simple: free lessons, an optional account, and content you may study from but not republish." />

      <div className="max-w-content">
        {sections.map((s) => (
          <Section key={s.id} id={s.id} title={s.title}>
            {s.body.map((p) => (
              <p key={p} className="leading-relaxed text-ink-2 [&+&]:mt-4">
                {s.id === "privacy" ? (
                  <>
                    How account data is handled is described on the{" "}
                    <Link href="/privacy" className="text-accent hover:underline">
                      privacy page
                    </Link>
                    , which forms part of these terms.
                  </>
                ) : s.id === "contact" ? (
                  <>
                    Questions about these terms go to {SITE_OPERATOR.name} through its{" "}
                    <a href={`${SITE_OPERATOR.url}contact`} rel="noopener" target="_blank" className="font-medium text-accent hover:underline">
                      contact page
                    </a>
                    . These terms are updated when the service changes; the date below is the date of the current version.
                  </>
                ) : (
                  p
                )}
              </p>
            ))}
          </Section>
        ))}
        <UpdatedOn className="mt-8" />
      </div>
      <div className="h-12" />
    </Container>
  );
}
