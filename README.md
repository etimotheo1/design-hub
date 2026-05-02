# Design Hub

A lightweight, JIRA-style project management tool for **Design Thinking workflows**. Bridges non-tech ideators (who imagine the experience) and tech builders (who design and ship). Built as v1 of what will eventually live inside [etasks.com](https://etasks.com).

## What's inside (v1)

- **Kanban board** with four stages: **Idea → Design → Build → Ship**
- **Idea submission form** — a friendly entry point for non-tech teams to drop ideas without wading through a full project tool
- **Projects** — group cards by initiative (Tanzania, Kenya Expansion, Rice Pilot, etasks Platform are seeded by default)
- **Card detail** — description, "what we imagine" field, comments, attachment links, assignee, stage
- **Auth** — username + password with bcrypt hashing and session cookies (SQLite-backed)
- **Drag & drop** between columns plus arrow buttons for moving cards through stages

Built with Next.js 14 (App Router) + TypeScript + Tailwind + SQLite (`better-sqlite3`). Single repo, no external services, runs locally.

## Run locally

```bash
# 1. Install dependencies
npm install

# 2. Start the dev server
npm run dev

# 3. Open http://localhost:3000
```

On first run the app:
1. Creates `data/pm.db` (SQLite database).
2. Seeds four default projects.
3. Creates an admin user — **username:** `elia`  **password:** `changeme`.

Sign in, change the password later from the user menu (or by registering a new admin and removing the seed user).

## Where things live

```
Design Hub/
├── data/                    SQLite DB (gitignored)
├── src/
│   ├── app/
│   │   ├── login/           sign-in page
│   │   ├── register/        sign-up page
│   │   ├── board/           main kanban board
│   │   ├── submit/          friendly idea-submission form for non-tech
│   │   ├── projects/        project CRUD
│   │   └── api/             REST routes (auth, projects, cards, comments, attachments)
│   ├── components/          KanbanBoard, KanbanColumn, KanbanCard, CardModal, IdeaForm, etc.
│   └── lib/                 db.ts, auth.ts, types.ts
├── package.json
├── tailwind.config.ts
└── next.config.js
```

## How the workflow is meant to be used

1. **Non-tech** team members hit `/submit` — drop an idea with what they *imagine* the outcome looks like.
2. **Tech** team triages the Idea column on `/board`, moves promising cards into Design, then Build, then Ship.
3. Comments on each card replace the "where did this idea go?" question. Attachments link to Figma, GitHub, Box, Drive — anything pointing at the actual artifacts.
4. As code work moves to a real Git repo, link the repo/branch URL as an attachment so the card stays the source of truth.

## Roadmap toward etasks integration

The intentional shape of v1:

- **SQLite + REST API** — schema is small and straightforward to port to Postgres + Prisma when this moves into etasks.
- **`SessionUser` and the auth layer** are isolated in `src/lib/auth.ts` — swap for etasks SSO without touching components.
- **API routes under `/api/*`** are the contract; the UI is purely a consumer. The same routes can be re-pointed at the etasks backend.
- **No bundler-coupled native deps** in the client — `better-sqlite3` is server-only (configured in `next.config.js`).

Suggested next steps before merging into etasks:

1. Replace `better-sqlite3` with the etasks Postgres connection.
2. Swap `lib/auth.ts` for the etasks SSO/session module.
3. Add WebSocket/SSE for real-time card updates.
4. Add file upload (S3 or equivalent) — currently attachments are URL pointers.
5. Add roles/permissions per project (today every signed-in user can edit any card).
6. Notifications — email or in-app when a card is moved or commented on.

## Pushing to Git and deploying

See **[DEPLOY.md](./DEPLOY.md)** for the full guide — push to a private GitHub repo, then deploy to Railway (recommended) or Render in ~15 minutes total. The repo includes `railway.json` and `render.yaml` so the platforms auto-configure.

`.gitignore` already excludes `node_modules/` and the local SQLite database.

## Tech notes

- Next.js App Router with server components for protected page guards (`getCurrentUser()` in `lib/auth.ts`).
- API routes are `app/api/.../route.ts` and use the same SQLite singleton.
- Tailwind classes are deliberately simple — no design system dependency, easy to restyle when integrating with etasks' design language.
- Drag-and-drop uses native HTML5 (no `@dnd-kit` dependency for v1) — replace with a richer library when adding intra-column reordering.
# design-hub
