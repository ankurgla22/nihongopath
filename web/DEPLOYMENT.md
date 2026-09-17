# Deployment: Firebase App Hosting

Target: Firebase project `opusify-japanese` (pinned in `.firebaserc`). The app is a Next.js 14 server (SSR + static pages) that App Hosting runs on Cloud Run. Firestore rules and indexes are deployed separately with the Firebase CLI.

All commands run from `web/` unless noted. Requires Firebase CLI 13.15+ (`firebase --version`, 15.x installed) and `firebase login`.

## 0. One-time prerequisites (owner)

1. **Blaze plan.** App Hosting requires pay-as-you-go. As of the last audit the project was still on Spark and `firebase apphosting:backends:list` fails with "must be on the Blaze plan". Upgrade at <https://console.firebase.google.com/project/opusify-japanese/usage/details>.
2. **Git repository on GitHub.** App Hosting builds from a connected GitHub repo. The repo root is the parent of `web/` (`japanese/`), so the backend's root directory must be `web`.
   ```bash
   cd ..            # japanese/
   git init -b main
   git add .
   git commit -m "Initial commit"
   gh repo create <org>/<repo> --private --source . --push
   ```
3. **Firestore database** exists (Native mode) in the region you want to use for the backend.
4. **Web app registered** in Firebase console > Project settings > General > Your apps. Note its config values (apiKey, appId, messagingSenderId, storageBucket).

## 1. Create the backend

Interactive (recommended the first time):

```bash
firebase use opusify-japanese
firebase init apphosting
```

Prompts: region (pick the Firestore region, e.g. `asia-northeast1` or `us-central1`), GitHub connection (authorizes the Firebase GitHub app), repository, **root directory: `web`**, live branch: `main`, backend id (e.g. `web`). Answer "yes" to linking the Firebase web app so `FIREBASE_WEBAPP_CONFIG` is injected automatically.

Non-interactive equivalent:

```bash
firebase apphosting:backends:create \
  --project opusify-japanese \
  --location us-central1 \
  --backend web \
  --app <FIREBASE_WEB_APP_ID> \
  --root-dir web \
  --branch main \
  --repo <github-owner>/<repo>
```

(Older CLIs use `--app-id`/`--repo` with slightly different flag names; run `firebase apphosting:backends:create --help`.) Creating the backend triggers the first rollout.

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

Every push to `main` triggers a rollout. Manual rollout of a branch or commit:

```bash
firebase apphosting:rollouts:create web --git-branch main
firebase apphosting:rollouts:create web --git-commit <sha>
```

Watch in the console under Build > App Hosting, or:

```bash
firebase apphosting:backends:get web
firebase apphosting:rollouts:list web
```

Before pushing, run locally:

```bash
npm run check && npm run build
```

Smoke test after a rollout: open `/` and `/japanese/n5/grammar`, `/robots.txt` and `/sitemap/0.xml` (URLs must use the production host), `/login` then sign in and open `/dashboard`.

## 6. Custom domain

1. Console > App Hosting > backend > **Domains** > Add custom domain; or `firebase apphosting:domains:create web <domain>` (CLI 13.x+; falls back to the console if unavailable).
2. Add the DNS records shown (A/AAAA or CNAME plus a TXT ownership record). Certificates are provisioned automatically.
3. Then: add the domain to Auth **Authorized domains**, set `NEXT_PUBLIC_SITE_URL=https://<domain>` in `apphosting.yaml`, commit, and let the rollout rebuild (SITE_URL is inlined at build time).

## 7. Rollback

App Hosting keeps previous builds. To roll back:

- Console > App Hosting > backend > Rollouts > pick an earlier successful rollout > **Roll back**.
- CLI: create a new rollout from the last good commit:
  ```bash
  firebase apphosting:rollouts:create web --git-commit <last-good-sha>
  ```
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
