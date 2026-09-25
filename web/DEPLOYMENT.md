# Deployment: Firebase App Hosting

Target: Firebase project `opusify-japanese` (pinned in `.firebaserc`). The app is a Next.js 14 server (SSR + static pages) that App Hosting runs on Cloud Run. Firestore rules and indexes are deployed separately with the Firebase CLI.

All commands run from `web/` unless noted. Requires Firebase CLI 13.15+ (`firebase --version`, 15.x installed) and `firebase login`.

## Quick path: `npm run deploy`

`scripts/deploy.ps1` does a from-scratch build and deploy in one go (Windows PowerShell):

1. Preflight: CLI present, logged in, no `REPLACE-ME` values left in `apphosting.yaml`.
2. Clean: removes `.next`, `node_modules` and the tsc cache, then `npm ci`.
3. `npm run check` and a local `next build` (proves the tree compiles; the cloud rebuilds anyway).
4. `firebase deploy --only firestore:rules,firestore:indexes`.
5. Creates the App Hosting backend `web` (us-central1, linked to the web app) if it does not exist.
6. `firebase deploy --only apphosting`: uploads the **local working tree** (respecting `.gitignore` and the
   `ignore` list in `firebase.json`) and waits for the Cloud Build rollout. Uncommitted changes are deployed.
7. Prints the backend URL.

Flags: `-SkipChecks`, `-SkipLocalBuild`, `-SkipRules`, `-Region`, `-Backend`, `-Project`.

```bash
npm run deploy
npm run deploy -- -SkipChecks -SkipLocalBuild     # quick redeploy of a tree you just verified
```

The backend **is** connected to GitHub: a push to `main` triggers a Cloud Build rollout on its own
(build `3fb5c00c` fetched commit `b2c7e72` this way on 2026-09-25). `npm run deploy` is the second route
— it uploads the local working tree, so it also deploys uncommitted changes.
The live URL is <https://web--opusify-japanese.us-central1.hosted.app>.

Cloud Build applies a deadline to the whole rollout, and this site is large enough to hit it: a build that
prerendered all 15,401 pages died at roughly 6,500 with `context deadline exceeded`. Keep an eye on how many
pages `generateStaticParams` asks for. The vocabulary and kanji detail routes deliberately prerender only N5
and N4 and leave the rest to render on first request; see the comment in
`src/app/japanese/[level]/vocabulary/[slug]/page.tsx` before widening that.

## 0. One-time prerequisites (owner)

1. **Blaze plan.** App Hosting requires pay-as-you-go (done).
2. **Firestore database** exists (Native mode, `nam5`), hence the `us-central1` backend region.
3. **Web app registered** in Firebase console > Project settings > General > Your apps (`nihongopath`).

## 1. Create the backend

`npm run deploy` creates it on first run. Manual equivalent:

```bash
firebase apphosting:backends:create --project opusify-japanese --backend web   --primary-region us-central1 --root-dir . --app <FIREBASE_WEB_APP_ID> --non-interactive
```

GitHub-triggered rollouts are already set up (repo `ankurgla22-nihongopath`, root directory `web`), so a push
to `main` is the normal way to ship. `npm run deploy` stays useful for deploying a working tree that has not
been committed, and for the Firestore rules step.

## 2. Environment variables

`apphosting.yaml` (committed) declares everything the app reads. Edit the `value:` entries and commit:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | The public URL. After the first rollout use `https://<backend>--<project>.<region>.hosted.app`, later the custom domain. Must be `https` or the session cookie is not marked `Secure`. |
| `NEXT_PUBLIC_FIREBASE_API_KEY`, `..._APP_ID`, `..._MESSAGING_SENDER_ID`, `..._STORAGE_BUCKET`, `..._AUTH_DOMAIN`, `..._PROJECT_ID` | Web app config from Project settings. Public, not secrets. If the backend is linked to the web app these are optional: `next.config.mjs` derives them from the injected `FIREBASE_WEBAPP_CONFIG`. |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | **Leave unset.** The Admin SDK uses Application Default Credentials (the backend's service account, `firebase-app-hosting-compute@opusify-japanese.iam.gserviceaccount.com`). |

Only if you must override the Admin credentials, store it as a secret and reference it with `availability: [RUNTIME]` (the commented block in `apphosting.yaml`):

```bash
firebase apphosting:secrets:set firebase-service-account-json   # pastes the one-line JSON
firebase apphosting:secrets:grantaccess firebase-service-account-json --backend web
```

Admin SDK IAM: the backend service account needs **Firebase Authentication Admin** (session cookies) and **Cloud Datastore User** (Firestore reads). App Hosting grants the default roles when it creates the backend; if `/api/auth/session` returns 500 or private pages fail, check IAM in the Cloud console.

## 3. Firestore rules and indexes

Never deployed by App Hosting rollouts. Deploy (and re-deploy whenever they change):

```bash
npm run test:rules                                    # emulator tests, must be green
firebase deploy --only firestore:rules --dry-run      # compiles rules
firebase deploy --only firestore:rules,firestore:indexes
```

Index builds can take minutes; check Firestore > Indexes in the console.

## 4. Firebase Auth production settings (console, owner)

- **Authentication > Sign-in method**: enable Email/Password (and Google if used).
- **Authentication > Settings > Authorized domains**: add the `*.hosted.app` URL and every custom domain. Without this, sign-in from the deployed site fails with `auth/unauthorized-domain`.
- **Google Cloud > APIs & Services > OAuth consent screen** (only for Google sign-in): set app name, support email, and add the hosted/custom domain as an authorized domain; publish the consent screen for non-test users.
- **Email templates**: set the sender name and, optionally, a custom action URL on your domain.
- **API key restrictions** (optional hardening): in Google Cloud > Credentials, restrict the browser key to your domains and to the Identity Toolkit, Token Service and Firestore APIs.

## 5. Deploy / roll out

```bash
npm run deploy
```

Watch in the console under Build > App Hosting, or `firebase apphosting:backends:get web`.

Smoke test after a rollout: open `/` and `/japanese/n5/grammar`, `/robots.txt` and `/sitemap/0.xml` (URLs must use the production host), `/login` then sign in and open `/dashboard`.

## 5a. Content last-modified dates

`content/lastmod.json` maps every content id to the date its file last changed in git. The sitemap,
lesson schema and visible "Updated" dates read it. Regenerate and commit it whenever content changes:
`npm run content:lastmod` (the deploy script runs it; GitHub-triggered rollouts use the committed file).

## 5b. IndexNow (Bing, Yandex, Seznam, Naver)

`npm run seo:indexnow` submits every sitemap URL to IndexNow; `npm run deploy` runs it after a
successful rollout. Pass paths to submit only those: `npm run seo:indexnow -- /about /jlpt`.
The key is public by design (`src/lib/seo/indexnow.ts`, served from `public/<key>.txt`). Google does
not use IndexNow; submit the sitemap in Search Console instead.

## 6. Custom domain

The site is published at the apex domain `nihongopath.app`. `NEXT_PUBLIC_SITE_URL` in `apphosting.yaml`
already points at it, so canonical links, the sitemap and the Secure cookie flag are correct the moment DNS
resolves.

**The DNS values are issued per domain — take them from the console, never from this file.** Add the domain
in Console > App Hosting > backend `web` > Domains, and it prints the exact records to create. They are a
different A address, ownership token and ACME name from the ones the previous host used.

The shape of what it asks for, so the registrar work is predictable:

| Host | Type | Purpose |
|---|---|---|
| `@` | A | Points the apex at App Hosting. An apex cannot be a CNAME, so this is an address record; the console gives the address (and an AAAA if IPv6 is offered). |
| `@` | TXT | `fah-claim=…` ownership token, proving the domain is yours. |
| `_acme-challenge_…` | CNAME | Certificate issuance, pointing at `…authorize.certificatemanager.goog.` |

Optionally add `www` as a CNAME to the apex if you want `www.nihongopath.app` to work; App Hosting will
redirect it once the domain is attached.

Two things must happen alongside DNS or sign-in breaks:

- Add `nihongopath.app` (and `www.` if used) to Firebase Console > Authentication > Settings > **Authorized
  domains**. Without it Google sign-in and email links fail on the new host.
- Keep the `*.hosted.app` backend host authorized too, so a rollout can always be checked directly.

`.app` is on the HSTS preload list, so browsers will refuse plain HTTP to it outright. That is fine — App
Hosting serves HTTPS only — but it means the domain cannot be tested over http during propagation.

Check progress in Console > App Hosting > web > Domains: host, ownership and certificate states must all turn
green, and the certificate can take up to an hour after DNS propagates.

## 7. Rollback

App Hosting keeps previous builds. To roll back:

- Console > App Hosting > backend > Rollouts > pick an earlier successful rollout > **Roll back**.
- CLI: check out the last good commit and run `npm run deploy` again.
- Firestore rules are versioned separately: Firestore > Rules > history > restore, or `git checkout <sha> -- firestore.rules && firebase deploy --only firestore:rules`.

## 8. Tear down

```bash
firebase apphosting:backends:delete web
```

## Local production check

```bash
npm ci
npm run check          # validate:content + tsc + lint + vitest
npm run build          # works with no .env: public pages need no Firebase config
npm run test:ssr       # boots next on :3123 and checks SSR of public pages
```
