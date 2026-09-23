<#
.SYNOPSIS
  Fresh build and deploy of the site to Firebase (App Hosting + Firestore rules/indexes).

.DESCRIPTION
  Runs from web/. Steps:
    1. Preflight: Firebase CLI present and logged in, project pinned in .firebaserc.
    2. Clean: removes .next, node_modules and the tsc build cache, then `npm ci`.
    3. Verify: `npm run check` (content validation, tsc, eslint, vitest) and a local `next build`.
       The local build only proves the tree compiles; App Hosting rebuilds from source in Cloud Build.
    4. Deploy Firestore rules and indexes.
    5. Ensure the App Hosting backend exists (creates it on first run).
    6. `firebase deploy --only apphosting`: uploads the local source (honouring .gitignore and the
       ignore list in firebase.json) and waits for the rollout.
    7. Prints the backend URL.

.PARAMETER SkipChecks   Skip `npm run check` (still builds locally).
.PARAMETER SkipLocalBuild  Skip the local `next build` (App Hosting still builds in the cloud).
.PARAMETER SkipRules    Skip deploying Firestore rules and indexes.
.PARAMETER Region       App Hosting primary region. Firestore is in nam5, so us-central1 by default.

.EXAMPLE
  npm run deploy
  npm run deploy -- -SkipChecks
#>
[CmdletBinding()]
param(
  [switch]$SkipChecks,
  [switch]$SkipLocalBuild,
  [switch]$SkipRules,
  [string]$Project = "opusify-japanese",
  [string]$Backend = "web",
  [string]$Region = "us-central1",
  [string]$WebAppId = "1:962220484676:web:5951ef1a1669086577b411"
)

$ErrorActionPreference = "Stop"
$WebDir = Split-Path -Parent $PSScriptRoot
Set-Location $WebDir

function Step([string]$msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }

function Run([string]$cmd) {
  # Native commands: fail the script on a non-zero exit code.
  Write-Host "    $ $cmd" -ForegroundColor DarkGray
  Invoke-Expression $cmd
  if ($LASTEXITCODE -ne 0) { throw "Command failed (exit $LASTEXITCODE): $cmd" }
}

# ---------------------------------------------------------------- 1. preflight
Step "Preflight"
foreach ($tool in @("node", "npm", "firebase")) {
  if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { throw "$tool is not on PATH." }
}
Write-Host "    node $(node --version), firebase-tools $(firebase --version)"

$login = cmd /c "firebase login:list 2>&1" | Out-String
if ($login -match "No authorized accounts") { throw "Not logged in. Run: firebase login" }

if (Select-String -Path apphosting.yaml -Pattern "^\s*value:.*REPLACE-ME" -Quiet) {
  throw "apphosting.yaml still contains REPLACE-ME placeholders."
}

$dirty = git status --porcelain 2>$null
if ($dirty) { Write-Host "    Note: working tree has uncommitted changes; they WILL be deployed (local source deploy)." -ForegroundColor Yellow }

# ---------------------------------------------------------------- 2. clean
Step "Clean build artefacts and dependencies"
foreach ($p in @(".next", "node_modules", "tsconfig.tsbuildinfo", "out")) {
  if (-not (Test-Path $p)) { continue }
  Write-Host "    rm $p"
  if (Test-Path $p -PathType Container) {
    # rmdir is far more reliable than Remove-Item -Recurse on deep trees such as node_modules.
    # Retry: file watchers and antivirus scanners briefly hold entries open on Windows.
    for ($i = 1; $i -le 5 -and (Test-Path $p); $i++) {
      cmd /c "rmdir /s /q `"$p`" 2>nul"
      if (Test-Path $p) { Start-Sleep -Seconds (2 * $i) }
    }
    if (Test-Path $p) { throw "Could not remove $p (is a dev server or editor holding files open?)" }
  } else {
    Remove-Item -Force $p
  }
}
Run "npm ci --no-audit --no-fund"

Step "Refresh content last-modified dates from git"
Run "npm run content:lastmod"

# ---------------------------------------------------------------- 3. verify
if (-not $SkipChecks) {
  Step "Checks (content validation, typecheck, lint, unit tests)"
  Run "npm run check"
}

if (-not $SkipLocalBuild) {
  Step "Local production build"
  $env:NODE_ENV = "production"
  Run "npm run build"
  Remove-Item Env:NODE_ENV -ErrorAction SilentlyContinue
}

# ---------------------------------------------------------------- 4. firestore
if (-not $SkipRules) {
  Step "Deploy Firestore rules and indexes"
  Run "firebase deploy --only firestore:rules,firestore:indexes --project $Project --non-interactive --force"
}

# ---------------------------------------------------------------- 5. backend
Step "Ensure App Hosting backend '$Backend' exists"
# cmd merges stderr so spinner text on stderr is not turned into a terminating error by Stop mode.
$getOut = cmd /c "firebase apphosting:backends:get $Backend --project $Project 2>&1" | Out-String
if ($LASTEXITCODE -ne 0 -or $getOut -match 'not found') {
  Write-Host "    Backend not found; creating it in $Region (linked to web app $WebAppId)."
  Run "firebase apphosting:backends:create --project $Project --backend $Backend --primary-region $Region --root-dir . --app $WebAppId --non-interactive"
} else {
  Write-Host "    Backend exists."
}

# ---------------------------------------------------------------- 6. deploy
Step "Deploy source to App Hosting (Cloud Build does a fresh build)"
$deployOut = cmd /c "firebase deploy --only apphosting --project $Project --non-interactive --force 2>&1" | Out-String
Write-Host $deployOut
if ($LASTEXITCODE -ne 0) { throw "App Hosting deploy failed (exit $LASTEXITCODE)." }
if ($deployOut -match 'Skipping deployments|Rollout for backend .* failed') { throw "App Hosting deploy did not roll out; see output above." }

# ---------------------------------------------------------------- 7. notify search engines
Step "IndexNow: tell Bing and friends which URLs changed"
Run "npm run seo:indexnow"

# ---------------------------------------------------------------- 8. report
Step "Backend status"
firebase apphosting:backends:get $Backend --project $Project
Write-Host "`nDone. If this was the first rollout, add the *.hosted.app URL (and the custom domain) under" -ForegroundColor Green
Write-Host "Authentication > Settings > Authorized domains, and point nihongopath.opusify.co.in at the backend (Domains tab)." -ForegroundColor Green
