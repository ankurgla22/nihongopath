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

The backend is **not** connected to GitHub: pushes do not trigger rollouts, only `npm run deploy` does.
The live URL is <https://web--opusify-japanese.us-central1.hosted.app>.

## 0. One-time prerequisites (owner)

1. **Blaze plan.** App Hosting requires pay-as-you-go (done).
2. **Firestore database** exists (Native mode, `nam5`), hence the `us-central1` backend region.
3. **Web app registered** in Firebase console > Project settings > General > Your apps (`nihongopath`).

## 1. Create the backend

`npm run deploy` creates it on first run. Manual equivalent:

```bash
firebase apphosting:backends:create --project opusify-japanese --backend web   --primary-region us-central1 --root-dir . --app <FIREBASE_WEB_APP_ID> --non-interactive
```

To switch to GitHub-triggered rollouts instead, run `firebase init apphosting` and connect the repo with
root directory `web`; then set `alwaysDeployFromSource: false` in `firebase.json`.

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

## 6. Custom domain

`nihongopath.opusify.co.in` is registered on the backend (2026-09-23) and both it and the `*.hosted.app` host are
in Auth **Authorized domains**. What remains is DNS at the registrar (GoDaddy, `ns07/ns08.domaincontrol.com`).
The host currently CNAMEs to the old classic-Hosting site `opusify-japanese.web.app`; that record must go.

| Action | Host | Type | Value |
|---|---|---|---|
| Remove | `nihongopath` | CNAME | `opusify-japanese.web.app` |
| Add | `nihongopath` | A | `35.219.200.2` |
| Add | `nihongopath` | TXT | `fah-claim=002-02-2fd0db07-554b-4572-922a-537f5ab27058` |
| Add | `_acme-challenge_ug4slayg43ua4yap.nihongopath` | CNAME | `f6e304b5-7b44-4eb5-9f6c-a4bbd3be8b92.2.authorize.certificatemanager.goog.` |

Check progress in Console > App Hosting > web > Domains (host, ownership and certificate states must all turn
green; the certificate can take up to an hour after DNS propagates). The build already uses this domain for
`NEXT_PUBLIC_SITE_URL`, so canonical links and the sitemap are correct as soon as DNS is live.

If the values above ever change, the console Domains tab shows the current ones.

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
