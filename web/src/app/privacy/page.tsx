import Link from "next/link";
import { Breadcrumbs, Container, PageTitle, Section } from "@/components/ui";
import { JsonLd } from "@/components/content/JsonLd";
import { UpdatedOn } from "@/components/content/UpdatedOn";
import { SESSION_DAYS } from "@/lib/firebase/session";
import { breadcrumbJsonLd, pageMetadata } from "@/lib/seo/metadata";
import { LAST_MODIFIED, SITE_NAME, SITE_OPERATOR, SITE_URL } from "@/lib/seo/site";

export const metadata = pageMetadata({
  title: "Privacy policy",
  description:
    "What Nihongo Path stores when you create an account, which cookie it sets, which Google services it relies on, and how to have your data deleted. No advertising, no analytics.",
  path: "/privacy",
});

/**
 * Every statement here describes what the code actually does (see src/lib/firebase,
 * src/lib/firestore/types.ts and src/app/api/auth/session). Keep it that way: if a
 * behaviour changes, this page changes in the same commit.
 */
export default function PrivacyPage() {
  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Privacy", path: "/privacy" },
  ];
  return (
    <Container>
      <JsonLd
        data={[
          breadcrumbJsonLd(crumbs),
          {
            "@context": "https://schema.org",
            "@type": "WebPage",
            "@id": `${SITE_URL}/privacy`,
            url: `${SITE_URL}/privacy`,
            name: `${SITE_NAME} privacy policy`,
            inLanguage: "en",
            dateModified: LAST_MODIFIED,
            isPartOf: { "@id": `${SITE_URL}/#website` },
            publisher: { "@id": `${SITE_URL}/#organization` },
          },
        ]}
      />
      <Breadcrumbs items={[{ name: "Home", path: "/" }, { name: "Privacy" }]} />
      <PageTitle title="Privacy policy" description="Plain description of what the site collects, why, where it is kept and how to remove it." />

      <div className="max-w-content">
        <Section id="who" title="Who is responsible">
          <p className="leading-relaxed text-ink-2">
            {SITE_NAME} is operated by{" "}
            <a href={SITE_OPERATOR.url} rel="noopener" target="_blank" className="font-medium text-accent hover:underline">
              {SITE_OPERATOR.name}
            </a>
            , which is the data controller for everything described below &mdash; and, under Indian law, the Data Fiduciary. Questions, data requests and grievances all go
            through the{" "}
            <a href={`${SITE_OPERATOR.url}contact`} rel="noopener" target="_blank" className="font-medium text-accent hover:underline">
              {SITE_OPERATOR.name} contact page
            </a>
            .
          </p>
        </Section>

        <Section id="without-account" title="Reading lessons without an account">
          <p className="leading-relaxed text-ink-2">
            Every lesson, guide and index page can be read without signing in. On those pages the site sets no cookies, runs no analytics and shows no advertising. Two
            things still reach third parties: the page itself is served from Google&rsquo;s infrastructure (see &ldquo;Where data is kept&rdquo;), and the Japanese web
            font is fetched from Google Fonts, so Google receives your IP address and browser details as part of serving the font file.
          </p>
          <p className="mt-4 leading-relaxed text-ink-2">
            Your theme choice (light or dark) is stored in your browser&rsquo;s local storage. It never leaves your device.
          </p>
        </Section>

        <Section id="account" title="What an account stores">
          <p className="leading-relaxed text-ink-2">Creating an account adds a private study tracker. To run it the site stores, against your account:</p>
          <ul className="mt-3 space-y-1.5 text-ink-2 leading-relaxed">
            {[
              "Your email address, display name and, if you sign in with Google, the profile photo URL Google provides.",
              "Where you are in the daily plan: current day, phase and level, your streak and longest streak, total study minutes and lessons completed.",
              "A progress record for every grammar point, word, kanji, reading passage and listening exercise you have answered: attempts, correct and incorrect counts, and the spaced-review schedule derived from them.",
              "Daily progress, study sessions, quiz results and mock-exam results, including which answers you chose.",
              "Items you save, and your settings (daily minutes target, whether to show furigana).",
            ].map((t) => (
              <li key={t} className="flex gap-3">
                <span aria-hidden className="mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 leading-relaxed text-ink-2">
            This data exists to show you your own progress and to schedule your review. It is not used for advertising, not sold, and not shared with anyone other than the
            service providers named below.
          </p>
        </Section>

        <Section id="cookie" title="The one cookie">
          <p className="leading-relaxed text-ink-2">
            Signing in sets a single cookie, <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[13px]">__session</code>, which keeps you signed in for up to{" "}
            {SESSION_DAYS} days. It is marked HttpOnly and Secure, is sent only to this site, and holds nothing but a signed session token. Signing out deletes it. There are
            no analytics, advertising or tracking cookies.
          </p>
          <p className="mt-4 leading-relaxed text-ink-2">
            When you are signed in, the site also keeps an offline copy of your progress in your browser&rsquo;s IndexedDB so quizzes survive a dropped connection. Clearing site
            data in your browser removes it.
          </p>
        </Section>

        <Section id="providers" title="Where data is kept">
          <p className="leading-relaxed text-ink-2">
            The site runs on Google Cloud through Firebase: Firebase App Hosting serves the pages, Firebase Authentication handles sign-in, and Cloud Firestore stores the
            account data above. These services are provided by Google LLC and the data is stored in Google&rsquo;s us-central1 region in the United States. If you sign in with
            Google, Google shares your name, email address and profile photo with the site under Google&rsquo;s own privacy policy.
          </p>
          <p className="mt-4 leading-relaxed text-ink-2">
            That means your account data is processed outside the country you are reading from, including outside India. Google LLC processes it on {SITE_OPERATOR.name}&rsquo;s
            instructions to run the service, under Google&rsquo;s Cloud data processing terms; it is not transferred to anyone else. If you would rather your data were not
            stored in the United States, read the lessons without an account &mdash; nothing on this site requires one.
          </p>
        </Section>

        <Section id="rights" title="Downloading, resetting and deleting your data">
          <p className="leading-relaxed text-ink-2">
            Your profile page has a <strong className="text-ink">Your data</strong> section with three controls. <em>Download my data</em> gives you everything listed
            above as a JSON file. <em>Reset my progress</em> clears what you have studied, either entirely or for one level, and keeps your account. <em>Delete my
            account</em> removes your sign-in and every record permanently. Each asks you to confirm your identity first, and deletion cannot be undone, so download your
            data first if you want a copy. If you cannot reach the page for any reason, contact {SITE_OPERATOR.name} through the link at the top of this page from the
            email address on the account.
          </p>
        </Section>

        <Section id="india" title="If you are in India">
          <p className="leading-relaxed text-ink-2">
            {SITE_OPERATOR.name} is registered in India, so the Digital Personal Data Protection Act, 2023 applies to the account data described above. Under it{" "}
            {SITE_OPERATOR.name} is the Data Fiduciary and you are the Data Principal. You may ask what personal data is held about you and who it has been shared with, ask
            for it to be corrected or completed, ask for it to be erased, nominate someone to exercise these rights on your behalf if you die or become incapacitated, and
            raise a grievance about any of it.
          </p>
          <p className="mt-4 leading-relaxed text-ink-2">
            The three controls described above answer the common requests immediately and without asking anyone: <strong className="text-ink">Download my data</strong> for
            access, <strong className="text-ink">Reset my progress</strong> for partial erasure and <strong className="text-ink">Delete my account</strong> for full erasure.
            For anything those do not cover &mdash; a correction, a nomination, or a grievance &mdash; write to {SITE_OPERATOR.name} through its{" "}
            <a href={`${SITE_OPERATOR.url}contact`} rel="noopener" target="_blank" className="font-medium text-accent hover:underline">
              contact page
            </a>{" "}
            from the email address on your account, saying that the request concerns {SITE_NAME}. That is the route for grievance redressal; if you are not satisfied with the
            response you may complain to the Data Protection Board of India.
          </p>
        </Section>

        <Section id="children" title="Children">
          <p className="leading-relaxed text-ink-2">The service is not directed at children under 13, and we do not knowingly create accounts for them.</p>
        </Section>

        <Section id="changes" title="Changes">
          <p className="leading-relaxed text-ink-2">
            This page is updated whenever the site&rsquo;s behaviour changes; the date below is the date of the current version.{" "}
            <Link href="/terms" className="text-accent hover:underline">
              The terms of use
            </Link>{" "}
            describe the rest of the relationship.
          </p>
          <UpdatedOn className="mt-8" />
        </Section>
      </div>
      <div className="h-12" />
    </Container>
  );
}
