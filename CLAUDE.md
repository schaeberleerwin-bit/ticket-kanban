@AGENTS.md

# TicketFlow – KI-Kanban-Board

## Stack
- Next.js **16** (App Router) – Breaking Changes gegenüber 15, Docs in `node_modules/next/dist/docs/` lesen
- Prisma **7** + SQLite (`prisma/dev.db`) via `@prisma/adapter-libsql`
- Tailwind **v4** (`@tailwindcss/postcss`)
- Zustand für Client-State (`src/store/ticket-store.ts`)
- Port: `3001` (`npm run dev`)

## Async Params (Next.js 16)
```ts
// RICHTIG – params ist ein Promise in Next.js 16
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
}
```

## Datenbank
```
DATABASE_URL="file:prisma/dev.db"
```
Nach Schema-Änderungen: `npx prisma migrate dev && npx prisma generate`

## GitHub-Sync
- `GITHUB_TOKEN` (Account: schaeberleerwin-bit) in `.env`
- Webhook HMAC-SHA256 Verifikation in `/api/github/webhook`
- Loop-Prevention: `_fromGitHub: true` beim Create, `reporter: "github"` auf Webhook-Tickets
- `NEXT_PUBLIC_APP_URL=http://localhost:3001`

## KI-Agenten
Alle Agents in `src/lib/agents/`. Registrierung in `src/lib/agents/index.ts`.

| Agent | ID | Stages |
|---|---|---|
| OpenClaw | `openclaw` | Feasibility, Develop, QA |
| Claude Code | `claude-code` | Feasibility, Develop, QA |
| Codex CLI | `codex` | Feasibility, Develop, QA |

Codex spawnt `codex exec --dangerously-bypass-approvals-and-sandbox` als Subprocess (OAuth-Login, kein API-Key).
Backlog-Generierung: `POST /api/agents/backlog` → 5–8 Tickets per KI.

## Agent-Icons (public/)
- `/openclaw.png` – OpenClaw
- `/claude-code.png` – Claude Code
- `/codex.png` – Codex

## Kanban-Spalten
`backlog → feasibility → progress → qa → done`

## Wichtige Lucide-Icons
`Github` existiert **nicht** → `GitBranch` verwenden.

## Git
Lokales Repo auf Branch `master`. Kein Remote konfiguriert (Stand 2026-06-25).
