# Deployment & Git Guide

End-to-end: from your laptop → GitHub → Railway (or Render). About 15 minutes total.

---

## Step 1 — Run it locally first (5 min)

```bash
cd "/Users/eliatimotheo/Documents/Claude/Projects/Design Hub"
npm install        # ~1–3 min, compiles better-sqlite3 natively
npm run dev        # opens dev server on http://localhost:3000
```

Sign in with `elia / changeme`. Click around, create a card, move it through stages, submit an idea. If anything looks broken, fix it before pushing — much faster than debugging on a remote.

---

## Step 2 — Initialize Git and push to GitHub (5 min)

There's already a `.git` folder in this repo from the scaffolding step, but its index is locked. Easiest path is to wipe it and start clean from your Mac terminal:

```bash
cd "/Users/eliatimotheo/Documents/Claude/Projects/Design Hub"

# Clear the partial git scaffold
rm -rf .git

# Start fresh
git init -b main
git config user.name  "Elia Timotheo"
git config user.email "elia@eafoods.com"
git add -A
git commit -m "Design Hub v1: kanban + ideas + projects"
```

### Create a private GitHub repo

**Option A — GitHub CLI** (fastest, requires `gh` installed):

```bash
gh auth login                                           # one-time
gh repo create design-hub --private --source=. --push
```

**Option B — Web UI**:

1. Go to <https://github.com/new>
2. Name: `design-hub` · Visibility: **Private** · Don't initialize with anything
3. Click *Create repository*
4. Copy the commands GitHub shows you, or run:

```bash
git remote add origin git@github.com:YOUR_GITHUB_USERNAME/design-hub.git
git push -u origin main
```

(Use the HTTPS URL `https://github.com/.../design-hub.git` if you don't have SSH keys set up.)

---

## Step 3 — Deploy to Railway (5 min) — **recommended**

Railway gives you a persistent disk, so the SQLite database survives restarts and redeploys. ~$5/month after the free trial credit.

1. Go to <https://railway.app> and sign in with GitHub.
2. **New Project → Deploy from GitHub repo → design-hub**.
3. Railway auto-detects Next.js. It will run `npm install` and `npm run build`, then `npm run start`. The included `railway.json` confirms this.
4. **Add a volume** (this is the important step — without it, the SQLite DB is wiped on every redeploy):
   - In the service → **Variables / Settings** → **Volumes** → **+ Add Volume**.
   - Mount path: `/app/data`
   - Size: 1 GB is plenty for v1.
5. **Generate a public domain**: Service → **Settings** → **Networking** → **Generate Domain**. You'll get something like `design-hub.up.railway.app`.
6. Open the URL. First load triggers schema creation and seeds the `elia / changeme` admin user. **Sign in and change the password immediately.**

### Updating the deployed app

```bash
git add -A
git commit -m "Tweak: …"
git push
```

Railway watches the `main` branch and redeploys automatically.

---

## Step 3 (alternative) — Deploy to Render

Render's blueprint config is already in `render.yaml`.

1. Go to <https://dashboard.render.com>, sign in with GitHub.
2. **New + → Blueprint → connect the design-hub repo**.
3. Render reads `render.yaml`, provisions the web service + 1 GB persistent disk at `/opt/render/project/src/data`, and starts the build.
4. Once green, open the URL and sign in with `elia / changeme`.

Note: Render's free tier doesn't include persistent disks — you need at least the **Starter** plan ($7/mo) for SQLite to survive restarts.

---

## What survives, what gets reset

| Thing | Survives redeploy? | Where it lives |
|---|---|---|
| User accounts, projects, cards, comments | **Yes** | `data/pm.db` on the persistent volume |
| Sessions (logged-in users) | Yes (cookies + DB sessions) | Cookies on user's browser |
| `node_modules/` | No (rebuilt on every deploy) | Build container |

**If you ever wipe the DB**, the seed runs again on next request and recreates the `elia / changeme` admin + the four default projects.

---

## Common gotchas

- **`better-sqlite3` build fails on the host** — Railway and Render both ship `python` and build tools, so the native compile usually works. If it doesn't, check that `engines.node` in `package.json` matches what the host installed.
- **First request after a cold start is slow** — that's the SQLite schema initializing on first DB access. Subsequent requests are instant.
- **Forgot the seed password** — SSH into the Railway shell (or use the Render shell) and delete `data/pm.db`. Next request reseeds.

---

## Sharing it with the team

Once deployed:

1. Send the team the URL.
2. Have each person hit `/register`, choose **Tech** or **Non-tech** as appropriate.
3. Non-tech folks should bookmark `/submit` — the friendliest entry point.
4. Tech folks live on `/board`.

Done. When this graduates into etasks, the steps will be: swap SQLite for Postgres in `lib/db.ts`, swap the auth module for etasks SSO, repoint the API routes. The UI stays.
